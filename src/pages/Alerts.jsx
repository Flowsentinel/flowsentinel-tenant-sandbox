import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  CheckCircle2, ChevronLeft, ChevronRight, Download,
  FileText, Info, CalendarRange,
} from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFn } from '@/lib/tenantApi'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'

const MAX_ALERTS  = 200
const PAGE_SIZE   = 10

const SEVERITY_VARIANT = {
  CRITICAL: 'danger', HIGH: 'danger', WARNING: 'warning', INFO: 'info',
}

const STATUS_VARIANT = {
  OPEN: 'danger', RESOLVED: 'success', CLOSED: 'neutral', SUPPRESSED: 'neutral',
}

const TYPE_LABELS = {
  STALE_MAIL:                 'Stale Mail',
  TOKEN_EXPIRY:               'Token Expiry',
  TOKEN_EXPIRED:              'Token Expired',
  TOKEN_INVALID:              'Token Invalid',
  AUTH_FAILURE:               'Auth Failure',
  CONNECTION_FAILURE:         'Connection Failure',
  DIGEST_FAILURE:             'Digest Failure',
  TAMPER_DETECTED:            'Tamper Detected',
  LICENSE_VALIDATION_FAILURE: 'License Validation',
  LICENSE_EXPIRING:           'License Expiring',
}

const SEVERITY_FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO']
const TYPE_OPTIONS     = ['ALL', ...Object.keys(TYPE_LABELS)]

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(alerts) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = ['Created', 'Severity', 'Type', 'Title', 'Message', 'Mailbox', 'Status']
  const rows = alerts.map(a => [
    new Date(a.created_at).toLocaleString(),
    a.severity,
    TYPE_LABELS[a.alert_type] ?? a.alert_type,
    esc(a.title),
    esc(a.message),
    a.mailbox_email ?? '',
    a.status,
  ].join(','))
  const csv  = [header.join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `alerts-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Default date range helpers ────────────────────────────────────────────────
function todayStr()    { return new Date().toISOString().slice(0, 10) }
function sixMonthsAgo() {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d.toISOString().slice(0, 10)
}

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [mailboxFilter,  setMailboxFilter]  = useState('ALL')
  const [typeFilter,     setTypeFilter]     = useState('ALL')
  const [page,           setPage]           = useState(0)

  // Request report modal
  const [reportOpen,  setReportOpen]  = useState(false)
  const [reportFrom,  setReportFrom]  = useState(sixMonthsAgo)
  const [reportTo,    setReportTo]    = useState(todayStr)
  const [reportSent,  setReportSent]  = useState(false)
  const [reportError, setReportError] = useState('')

  function changeFilter(setter) {
    return (val) => { setter(val); setPage(0) }
  }

  function openReport() {
    setReportFrom(sixMonthsAgo())
    setReportTo(todayStr())
    setReportSent(false)
    setReportError('')
    setReportOpen(true)
  }

  // Mailboxes for filter dropdown
  const { data: mailboxes = [] } = useQuery({
    queryKey: ['mailboxes-list'],
    queryFn: async () => {
      const { data } = await getTenantClient()
        .from('mailboxes')
        .select('mailbox_email')
        .order('mailbox_email')
      return data ?? []
    },
  })

  // Fetch last MAX_ALERTS matching alerts, get total count for banner
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', severityFilter, mailboxFilter, typeFilter],
    queryFn: async () => {
      let q = getTenantClient()
        .from('alerts')
        .select('id, alert_type, severity, title, message, mailbox_email, status, resolved_at, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(MAX_ALERTS)

      if (severityFilter !== 'ALL') q = q.eq('severity',      severityFilter)
      if (mailboxFilter  !== 'ALL') q = q.eq('mailbox_email', mailboxFilter)
      if (typeFilter     !== 'ALL') q = q.eq('alert_type',    typeFilter)

      const { data, count, error } = await q
      if (error) throw error
      return { alerts: data ?? [], total: count ?? 0 }
    },
  })

  const reportMutation = useMutation({
    mutationFn: () => callTenantFn('alert-report', { from_date: reportFrom, to_date: reportTo }),
    onSuccess: () => { setReportSent(true); setReportError('') },
    onError:   (e) => setReportError(e.message),
  })

  const allAlerts  = alertsData?.alerts ?? []
  const total      = alertsData?.total  ?? 0
  const hasMore    = total > MAX_ALERTS    // true when there are older alerts beyond our window

  // Client-side pagination within the fetched set
  const totalPages = Math.max(1, Math.ceil(allAlerts.length / PAGE_SIZE))
  const pageAlerts = allAlerts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const hasPrev    = page > 0
  const hasNext    = page < totalPages - 1

  return (
    <div className="p-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Alert History</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {allAlerts.length} alert{allAlerts.length !== 1 ? 's' : ''} loaded
            {hasMore && <span className="text-amber-600 font-medium"> · showing latest {MAX_ALERTS} of {total}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportCSV(allAlerts)} disabled={allAlerts.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button onClick={openReport}>
            <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
            Request Report
          </Button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Severity pill group */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {SEVERITY_FILTERS.map(f => (
            <button key={f} onClick={() => changeFilter(setSeverityFilter)(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                severityFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {f === 'ALL' ? 'All Severity' : f}
            </button>
          ))}
        </div>

        {/* Mailbox dropdown */}
        <select
          value={mailboxFilter}
          onChange={e => changeFilter(setMailboxFilter)(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">All Mailboxes</option>
          {mailboxes.map(mb => (
            <option key={mb.mailbox_email} value={mb.mailbox_email}>{mb.mailbox_email}</option>
          ))}
        </select>

        {/* Alert type dropdown */}
        <select
          value={typeFilter}
          onChange={e => changeFilter(setTypeFilter)(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{t === 'ALL' ? 'All Types' : TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* ── Older-alerts notice ───────────────────────────────────────────── */}
      {hasMore && (
        <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 text-sm">
          <Info className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
          <span className="text-indigo-800">
            Only the latest <strong>{MAX_ALERTS}</strong> alerts are displayed. To access older alert data,
            use <button className="underline font-medium hover:text-indigo-600" onClick={openReport}>Request Report</button> to
            receive a full date-range report by email.
          </span>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        </div>
      ) : allAlerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No alerts match the current filters.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Severity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Mailbox</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageAlerts.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant={SEVERITY_VARIANT[a.severity] ?? 'neutral'}>{a.severity}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {TYPE_LABELS[a.alert_type] ?? a.alert_type}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{a.message}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{a.mailbox_email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[a.status] ?? 'neutral'}>{a.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, allAlerts.length)} of {allAlerts.length}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={!hasPrev} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />Previous
              </Button>
              <span className="px-2 font-medium text-slate-700">{page + 1} / {totalPages}</span>
              <Button variant="outline" disabled={!hasNext} onClick={() => setPage(p => p + 1)}>
                Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Request Report Modal ───────────────────────────────────────────── */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Request Alert Report">
        <div className="space-y-4">
          {reportSent ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-800">Report request received!</p>
                <p className="text-xs text-green-700 mt-1">
                  Your alert report for <strong>{reportFrom}</strong> to <strong>{reportTo}</strong> will be emailed to you shortly.
                </p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setReportOpen(false)}>Close</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Select a date range to receive a full alert history report by email. The report includes all alerts
                regardless of current filters.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="report-from">From</Label>
                  <input
                    id="report-from"
                    type="date"
                    value={reportFrom}
                    max={reportTo}
                    onChange={e => { setReportFrom(e.target.value); setReportError('') }}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-to">To</Label>
                  <input
                    id="report-to"
                    type="date"
                    value={reportTo}
                    min={reportFrom}
                    max={todayStr()}
                    onChange={e => { setReportTo(e.target.value); setReportError('') }}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-500">
                  The report will be sent to your registered email address and includes severity, type, title,
                  mailbox, status, and timestamps for every alert in the selected range.
                </p>
              </div>

              {reportError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {reportError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => { setReportError(''); reportMutation.mutate() }}
                  loading={reportMutation.isPending}
                  disabled={!reportFrom || !reportTo}
                >
                  <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
                  Send Report
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
