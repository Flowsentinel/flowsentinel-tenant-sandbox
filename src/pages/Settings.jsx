import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Clock, Bell, Save, RefreshCw, CheckCircle2 } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFn } from '@/lib/tenantApi'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
].map(tz => ({ value: tz, label: tz }))

function licenseStatusBadge(status) {
  const map = {
    ACTIVE: 'success', INACTIVE: 'neutral',
    LICENSE_EXPIRED: 'danger', SUSPENDED: 'danger',
  }
  return <Badge variant={map[status] ?? 'neutral'}>{status}</Badge>
}

export default function Settings() {
  const qc = useQueryClient()
  const { profile } = useAuthStore()
  const canEdit = ['SUPER_ADMIN', 'ADMIN'].includes(profile?.role)
  const [form, setForm] = useState({ token_expiry_warning_days: 14, digest_timezone: 'UTC' })
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [renewOpen,    setRenewOpen]    = useState(false)
  const [newLicenseKey, setNewLicenseKey] = useState('')
  const [applyError,    setApplyError]    = useState('')
  const [applyResult,   setApplyResult]   = useState(null)

  const { data: config, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const { data, error } = await getTenantClient()
        .from('tenant_config')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (config) {
      setForm({
        token_expiry_warning_days: config.token_expiry_warning_days ?? 14,
        digest_timezone: config.digest_timezone ?? 'UTC',
      })
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: () => callTenantFn('settings-update', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] })
      qc.invalidateQueries({ queryKey: ['tenant-quota-mailboxes'] })
      qc.invalidateQueries({ queryKey: ['tenant-quota-users'] })
      setSaved(true)
      setSaveError('')
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (e) => setSaveError(e.message),
  })

  const applyMutation = useMutation({
    mutationFn: () => callTenantFn('license-apply', { license_key: newLicenseKey.trim() }),
    onSuccess: (data) => {
      setApplyResult(data)
      setApplyError('')
      qc.invalidateQueries({ queryKey: ['tenant-settings'] })
      qc.invalidateQueries({ queryKey: ['tenant-quota-mailboxes'] })
      qc.invalidateQueries({ queryKey: ['tenant-quota-users'] })
    },
    onError: (e) => setApplyError(e.message),
  })

  function openRenew() {
    setNewLicenseKey('')
    setApplyError('')
    setApplyResult(null)
    setRenewOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
      </div>
    )
  }

  const expiresAt = config?.expires_at ? new Date(config.expires_at) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt - new Date()) / 86400000) : null

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tenant configuration and license information</p>
      </div>

      <div className="space-y-6">
        {/* License Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">License</h2>
              </div>
              <Button variant="outline" size="sm" onClick={openRenew}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Renew License
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Company</dt>
                <dd className="text-slate-900 mt-0.5 font-medium">{config?.company_name}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Status</dt>
                <dd className="mt-0.5">{licenseStatusBadge(config?.status)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">License Type</dt>
                <dd className="text-slate-900 mt-0.5">{config?.license_type}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Expires</dt>
                <dd className="mt-0.5">
                  <span className="text-slate-900">{expiresAt?.toLocaleDateString() ?? '—'}</span>
                  {daysLeft !== null && (
                    <span className={`ml-2 text-xs ${daysLeft <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                      ({daysLeft > 0 ? `${daysLeft}d left` : 'Expired'})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Max Mailboxes</dt>
                <dd className="text-slate-900 mt-0.5">{config?.max_mailboxes}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Max Users</dt>
                <dd className="text-slate-900 mt-0.5">{config?.max_users}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Activated</dt>
                <dd className="text-slate-900 mt-0.5">
                  {config?.activated_at ? new Date(config.activated_at).toLocaleDateString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs font-medium uppercase tracking-wide">Company Code</dt>
                <dd className="text-slate-900 mt-0.5 font-mono text-xs">{config?.company_code}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 pb-4">
              <Bell className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Alert Preferences</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="warn-days">Token Expiry Warning (days before)</Label>
                <Input
                  id="warn-days"
                  type="number"
                  min={1}
                  max={60}
                  value={form.token_expiry_warning_days}
                  onChange={e => setForm(p => ({ ...p, token_expiry_warning_days: Number(e.target.value) }))}
                  className="max-w-xs"
                  disabled={!canEdit}
                />
                <p className="text-xs text-slate-400">
                  Send token expiry alerts this many days before the token expires (1–60)
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="timezone">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Digest Timezone
                  </span>
                </Label>
                <Select
                  id="timezone"
                  value={form.digest_timezone}
                  onChange={e => setForm(p => ({ ...p, digest_timezone: e.target.value }))}
                  options={TIMEZONES}
                  className="max-w-xs"
                  disabled={!canEdit}
                />
                <p className="text-xs text-slate-400">
                  Weekly and monthly digest emails use this timezone for date calculations
                </p>
              </div>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}

              {canEdit && (
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => { setSaveError(''); saveMutation.mutate() }}
                    loading={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-1.5" />
                    Save Settings
                  </Button>
                  {saved && (
                    <span className="text-sm text-green-600 font-medium">Saved!</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Renew / Update License Modal */}
      <Modal open={renewOpen} onClose={() => setRenewOpen(false)} title="Apply New License">
        <div className="space-y-4">

          {/* Current license summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Current License</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-slate-500">Company code</span>
              <span className="text-slate-900 font-mono font-medium">{config?.company_code ?? '—'}</span>
              <span className="text-slate-500">Type</span>
              <span className="text-slate-900">{config?.license_type ?? '—'}</span>
              <span className="text-slate-500">Max mailboxes</span>
              <span className="text-slate-900">{config?.max_mailboxes ?? '—'}</span>
              <span className="text-slate-500">Max users</span>
              <span className="text-slate-900">{config?.max_users ?? '—'}</span>
              <span className="text-slate-500">Expires</span>
              <span className={`font-medium ${daysLeft !== null && daysLeft <= 30 ? 'text-amber-600' : 'text-slate-900'}`}>
                {expiresAt?.toLocaleDateString() ?? '—'}
                {daysLeft !== null && (
                  <span className="ml-1">({daysLeft > 0 ? `${daysLeft}d left` : 'Expired'})</span>
                )}
              </span>
            </div>
          </div>

          {/* Success state */}
          {applyResult ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-semibold text-green-800">License applied successfully</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-green-700">Type</span>
                <span className="text-green-900 font-medium">{applyResult.license_type}</span>
                <span className="text-green-700">Max mailboxes</span>
                <span className="text-green-900 font-medium">{applyResult.max_mailboxes}</span>
                <span className="text-green-700">Max users</span>
                <span className="text-green-900 font-medium">{applyResult.max_users}</span>
                <span className="text-green-700">Expires</span>
                <span className="text-green-900 font-medium">
                  {new Date(applyResult.expires_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-end mt-3">
                <Button onClick={() => setRenewOpen(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Input */}
              <div className="space-y-1.5">
                <Label htmlFor="new-license-key">New License Key</Label>
                <textarea
                  id="new-license-key"
                  rows={4}
                  placeholder="Paste your new license key here..."
                  value={newLicenseKey}
                  onChange={e => { setNewLicenseKey(e.target.value); setApplyError('') }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-slate-400">
                  Obtain a new license key from your FlowSentinel account manager. The key will update
                  your mailbox limit, user limit, and expiry date.
                </p>
              </div>

              {applyError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {applyError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => { setApplyError(''); applyMutation.mutate() }}
                  loading={applyMutation.isPending}
                  disabled={!newLicenseKey.trim()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Apply License
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
