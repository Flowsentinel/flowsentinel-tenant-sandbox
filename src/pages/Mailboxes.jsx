import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Bell, Mail, Inbox, ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFn } from '@/lib/tenantApi'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Modal } from '@/components/ui/Modal'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MAILBOX_COLUMNS = `
  id, mailbox_email, ms_tenant_id, ms_client_id,
  stale_threshold_minutes, is_active,
  connection_status, token_status, token_expiry_date,
  last_synced_at, last_error, created_at, updated_at,
  alert_recipients(id, email)
`

const AVATAR_COLORS = [
  'bg-green-100 text-green-600', 'bg-blue-100 text-blue-600',
  'bg-violet-100 text-violet-600', 'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600', 'bg-cyan-100 text-cyan-600',
]

const EMPTY_FORM = {
  mailbox_email: '', ms_tenant_id: '', ms_client_id: '',
  refresh_token: '', token_expiry_date: '',
  stale_threshold_minutes: 60, alert_recipients: '',
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function avatarColor(email) {
  const n = email.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function statusChip(status) {
  if (status === 'ACTIVE')
    return <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="h-3 w-3" />Connected</span>
  if (status === 'FAILED')
    return <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200"><XCircle className="h-3 w-3" />Error</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Unknown</span>
}

function tokenNeedsAction(status) {
  return ['EXPIRING_SOON', 'EXPIRED', 'INVALID', 'REVOKED'].includes(status)
}

function getTokenHealth(expiryDate) {
  if (!expiryDate) return null
  const daysRemaining = Math.ceil((new Date(expiryDate) - new Date()) / 86400000)
  const pct  = Math.min(100, Math.max(0, (daysRemaining / 90) * 100))
  const bar  = daysRemaining <= 7 ? 'bg-red-500' : daysRemaining <= 30 ? 'bg-amber-500' : 'bg-green-500'
  const text = daysRemaining <= 7 ? 'text-red-600' : daysRemaining <= 30 ? 'text-amber-600' : 'text-slate-600'
  return { daysRemaining, pct, bar, text }
}

function formatSync(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString()
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Mailboxes() {
  const navigate    = useNavigate()
  const qc          = useQueryClient()
  const { profile } = useAuthStore()
  const canEdit     = ['SUPER_ADMIN', 'ADMIN'].includes(profile?.role)

  // modal state
  const [addOpen,       setAddOpen]       = useState(false)
  const [editMailbox,   setEditMailbox]   = useState(null)
  const [tokenMailbox,  setTokenMailbox]  = useState(null)  // Mark as Complete
  const [regenMailbox,  setRegenMailbox]  = useState(null)  // Regen (generate from stored)
  const [deleteMailbox, setDeleteMailbox] = useState(null)
  const [inboxMailbox,  setInboxMailbox]  = useState(null)

  // forms
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [tokenForm, setTokenForm] = useState({ refresh_token: '', token_expiry_date: '' })

  // per-modal step: 'idle' | 'validating' | 'saving' | 'done'
  const [addStep,   setAddStep]   = useState('idle')
  const [editStep,  setEditStep]  = useState('idle')
  const [tokenStep, setTokenStep] = useState('idle')

  // regen modal: 'idle' | 'generating' | 'done'
  const [regenStep,    setRegenStep]    = useState('idle')
  const [regenToken,   setRegenToken]   = useState('')     // new token from Microsoft
  const [regenCopied,  setRegenCopied]  = useState(false)
  const [regenError,   setRegenError]   = useState('')

  // errors
  const [addError,    setAddError]    = useState('')
  const [editError,   setEditError]   = useState('')
  const [tokenError,  setTokenError]  = useState('')
  const [deleteError, setDeleteError] = useState('')

  // inbox state machine: 'idle' | 'loading' | 'done' | 'error'
  const [inboxState,      setInboxState]      = useState('idle')
  const [inboxResult,     setInboxResult]     = useState(null)
  const [inboxFetchError, setInboxFetchError] = useState('')
  const [inboxPage,       setInboxPage]       = useState(0)
  const INBOX_PAGE_SIZE = 10

  // â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const { data: mailboxes = [], isLoading } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: async () => {
      const { data, error } = await getTenantClient()
        .from('mailboxes').select(MAILBOX_COLUMNS).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: config } = useQuery({
    queryKey: ['tenant-quota-mailboxes'],
    queryFn: async () => {
      const { data } = await getTenantClient()
        .from('tenant_config').select('max_mailboxes')
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
      return data
    },
  })


  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const createMutation = useMutation({
    mutationFn: (body) => callTenantFn('mailbox-create', body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); closeAdd() },
    onError:    (e) => { setAddError(e.message); setAddStep('idle') },
  })

  const updateMutation = useMutation({
    mutationFn: (body) => callTenantFn('mailbox-update', body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); closeEdit() },
    onError:    (e) => { setEditError(e.message); setEditStep('idle') },
  })

  const tokenMutation = useMutation({
    mutationFn: (body) => callTenantFn('mailbox-token-update', body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); setTokenStep('done') },
    onError:    (e) => { setTokenError(e.message); setTokenStep('idle') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => callTenantFn('mailbox-delete', { mailbox_id: id }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['mailboxes'] }); setDeleteMailbox(null) },
    onError:    (e) => { setDeleteError(e.message) },
  })

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function openAdd()  { setForm(EMPTY_FORM); setAddError(''); setAddStep('idle'); setAddOpen(true) }
  function closeAdd() { setAddOpen(false); setAddError(''); setAddStep('idle') }

  function openEdit(mb) {
    setEditMailbox(mb)
    setForm({
      mailbox_email:           mb.mailbox_email,
      ms_tenant_id:            mb.ms_tenant_id ?? '',
      ms_client_id:            mb.ms_client_id ?? '',
      refresh_token:           '',
      token_expiry_date:       '',
      stale_threshold_minutes: mb.stale_threshold_minutes,
      alert_recipients:        mb.alert_recipients?.map(r => r.email).join(', ') ?? '',
    })
    setEditError(''); setEditStep('idle')
  }
  function closeEdit() { setEditMailbox(null); setEditError(''); setEditStep('idle') }

  function openToken(mb) {
    setTokenMailbox(mb)
    setTokenForm({ refresh_token: '', token_expiry_date: '' })
    setTokenError(''); setTokenStep('idle')
  }

  function openRegen(mb) {
    setRegenMailbox(mb)
    setRegenStep('idle')
    setRegenToken('')
    setRegenCopied(false)
    setRegenError('')
  }

  function closeRegen() {
    setRegenMailbox(null)
    setRegenStep('idle')
    setRegenToken('')
    setRegenCopied(false)
    setRegenError('')
  }

  async function handleRegen() {
    setRegenError('')
    setRegenStep('generating')
    try {
      // Mode C: mailbox_id only — uses stored token, returns new one if rotated
      const result = await callTenantFn('graph-validate', { mailbox_id: regenMailbox.id })
      setRegenToken(result.new_refresh_token ?? '')
      setRegenStep('done')
    } catch (e) {
      setRegenError(e.message)
      setRegenStep('idle')
    }
  }

  function copyRegenToken() {
    if (!regenToken) return
    navigator.clipboard.writeText(regenToken).then(() => {
      setRegenCopied(true)
      setTimeout(() => setRegenCopied(false), 2500)
    })
  }

  function openInbox(mb) {
    setInboxMailbox(mb)
    setInboxState('idle')
    setInboxResult(null)
    setInboxFetchError('')
    setInboxPage(0)
  }

  async function fetchInbox() {
    setInboxState('loading')
    setInboxFetchError('')
    setInboxPage(0)
    try {
      const data = await callTenantFn('graph-inbox', { mailbox_id: inboxMailbox.id })
      setInboxResult(data)
      setInboxState('done')
    } catch (e) {
      setInboxFetchError(e.message)
      setInboxState('error')
    }
  }

  function formatAge(minutes) {
    if (minutes < 60)   return `${minutes} min`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
  }

  function formatArrival(iso) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC'
  }

  function f(key) {
    return { value: form[key], onChange: (e) => setForm(p => ({ ...p, [key]: e.target.value })) }
  }

  // â”€â”€ Submit handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleAddSubmit(e) {
    e.preventDefault()
    setAddError('')
    const recipients = form.alert_recipients.split(',').map(s => s.trim()).filter(Boolean)
    if (recipients.length === 0) { setAddError('At least one alert recipient is required.'); return }

    // Step 1 — Validate credentials with Microsoft
    setAddStep('validating')
    let validatedToken = form.refresh_token

    try {
      const result = await callTenantFn('graph-validate', {
        ms_tenant_id:  form.ms_tenant_id,
        ms_client_id:  form.ms_client_id,
        refresh_token: form.refresh_token,
        mailbox_email: form.mailbox_email,
      })
      // Use rotated token if Microsoft returned one
      if (result.new_refresh_token) validatedToken = result.new_refresh_token
      // Note: result.token_expiry is access token TTL (~1h), not used here.
      // token_expiry_date defaults to 90 days in mailbox-create.
    } catch (e) {
      setAddError(`Microsoft rejected the credentials: ${e.message}`)
      setAddStep('idle')
      return
    }

    // Step 2 — Save
    setAddStep('saving')
    createMutation.mutate({
      mailbox_email:           form.mailbox_email,
      ms_tenant_id:            form.ms_tenant_id,
      ms_client_id:            form.ms_client_id,
      refresh_token:           validatedToken,
      token_expiry_date:       form.token_expiry_date || undefined, // user-provided only
      stale_threshold_minutes: Number(form.stale_threshold_minutes),
      alert_recipients:        recipients,
    })
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setEditError('')
    const recipients = form.alert_recipients.split(',').map(s => s.trim()).filter(Boolean)
    if (recipients.length === 0) { setEditError('At least one alert recipient is required.'); return }

    const tenantChanged = form.ms_tenant_id !== editMailbox?.ms_tenant_id
    const clientChanged = form.ms_client_id !== editMailbox?.ms_client_id
    const tokenChanged  = form.refresh_token.trim().length > 0
    const credsChanged  = tenantChanged || clientChanged || tokenChanged

    // If creds changed, a token is required
    if (credsChanged && !form.refresh_token.trim()) {
      setEditError('You changed the Tenant ID or Client ID. Provide a new refresh token to match.')
      return
    }

    let validatedToken = form.refresh_token.trim() || undefined
    let tokenExpiry    = form.token_expiry_date || undefined

    // Validate only when credentials change
    if (credsChanged && form.refresh_token.trim()) {
      setEditStep('validating')
      try {
        const result = await callTenantFn('graph-validate', {
          ms_tenant_id:  form.ms_tenant_id,
          ms_client_id:  form.ms_client_id,
          refresh_token: form.refresh_token,
          mailbox_email: editMailbox.mailbox_email,
        })
        if (result.new_refresh_token) validatedToken = result.new_refresh_token
        // result.token_expiry is access token TTL — not used for token_expiry_date
      } catch (e) {
        setEditError(`Microsoft rejected the credentials: ${e.message}`)
        setEditStep('idle')
        return
      }
    }

    setEditStep('saving')
    const payload = {
      mailbox_id:              editMailbox.id,
      ms_tenant_id:            form.ms_tenant_id,
      ms_client_id:            form.ms_client_id,
      stale_threshold_minutes: Number(form.stale_threshold_minutes),
      alert_recipients:        recipients,
    }
    if (validatedToken) payload.refresh_token     = validatedToken
    if (tokenExpiry)    payload.token_expiry_date = tokenExpiry
    updateMutation.mutate(payload)
  }

  function handleTokenSubmit(e) {
    e.preventDefault()
    setTokenError('')
    if (!tokenForm.refresh_token.trim()) { setTokenError('Please paste the new refresh token.'); return }
    setTokenStep('saving')
    // mailbox-token-update validates against Graph internally before saving
    tokenMutation.mutate({
      mailbox_id:        tokenMailbox.id,
      refresh_token:     tokenForm.refresh_token,
      token_expiry_date: tokenForm.token_expiry_date || undefined,
    })
  }

  // â”€â”€ Step labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const addBtnLabel = addStep === 'validating' ? 'Validating with Microsoft...'
    : addStep === 'saving' ? 'Saving...' : 'Connect Mailbox'

  const editBtnLabel = editStep === 'validating' ? 'Validating with Microsoft...'
    : editStep === 'saving' ? 'Saving...' : 'Save Changes'

  const tokenBtnLabel = tokenStep === 'saving' ? 'Validating & saving...' : undefined

  const activeCount = mailboxes.filter(m => m.is_active).length

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold text-slate-900">Mailboxes</h1>
        {canEdit && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />Add Mailbox
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6">Manage ReadSoft approval mailboxes and token health.</p>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Mail className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No mailboxes yet</p>
          <p className="text-slate-400 text-xs mt-1">Add one to start monitoring.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 mb-4">{activeCount} active · {config?.max_mailboxes ?? '—'} max</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {mailboxes.map(mb => {
              const health     = getTokenHealth(mb.token_expiry_date)
              const needsToken = tokenNeedsAction(mb.token_status)
              const ac         = avatarColor(mb.mailbox_email)
              return (
                <div key={mb.id} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:border-slate-300 transition-colors">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${ac}`}>
                      <Mail className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{mb.mailbox_email}</p>
                        {statusChip(mb.connection_status)}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono">{mb.ms_client_id?.slice(0, 8)}...</p>
                    </div>
                  </div>

                  {/* Error panel */}
                  {mb.last_error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 line-clamp-2">{mb.last_error}</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-slate-400">Stale threshold</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{mb.stale_threshold_minutes} min</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-slate-400">Last sync</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{formatSync(mb.last_synced_at)}</p>
                    </div>
                  </div>

                  {/* Token health */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">Token Health</span>
                      {health ? (
                        <span className={`font-medium ${health.text}`}>
                          {health.daysRemaining > 0 ? `${health.daysRemaining} days remaining` : 'Expired'}
                        </span>
                      ) : (
                        <span className="text-slate-400">No expiry set</span>
                      )}
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      {health && <div className={`h-full rounded-full ${health.bar}`} style={{ width: `${health.pct}%` }} />}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 pt-1 border-t border-slate-100">
                    <button onClick={() => navigate('/alerts')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-colors">
                      <Bell className="h-3.5 w-3.5" /><span>Alerts</span>
                    </button>
                    {canEdit && (
                      <button onClick={() => openRegen(mb)} title="Regenerate token using stored credentials"
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          needsToken ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium' : 'text-slate-500 hover:bg-slate-100'
                        }`}>
                        <RefreshCw className="h-3.5 w-3.5" /><span>Regen</span>
                      </button>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => openInbox(mb)} title="View Inbox"
                      className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-lg transition-colors">
                      <Inbox className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <button onClick={() => openEdit(mb)} title="Edit mailbox"
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => openToken(mb)} title="Mark as Complete — save new token"
                        className={`p-1.5 rounded-lg transition-colors ${needsToken ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => { setDeleteError(''); setDeleteMailbox(mb) }} title="Delete mailbox"
                        className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ADD MAILBOX MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={addOpen} onClose={addStep === 'idle' ? closeAdd : undefined} title="Connect New Mailbox" size="lg">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Credentials are validated against Microsoft before saving.
              The refresh token is encrypted at rest and never exposed after storage.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="mb-email">Mailbox Email</Label>
            <Input id="mb-email" type="email" placeholder="ap@company.com" required disabled={addStep !== 'idle'} {...f('mailbox_email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="ms-tenant">Microsoft Tenant ID</Label>
              <Input id="ms-tenant" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required disabled={addStep !== 'idle'} {...f('ms_tenant_id')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ms-client">Microsoft Client ID</Label>
              <Input id="ms-client" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required disabled={addStep !== 'idle'} {...f('ms_client_id')} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="add-refresh-token">Refresh Token</Label>
            <textarea id="add-refresh-token" required
              placeholder="Paste the OAuth2 refresh token from Microsoft"
              value={form.refresh_token} disabled={addStep !== 'idle'}
              onChange={e => setForm(p => ({ ...p, refresh_token: e.target.value }))}
              rows={3}
              className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="add-threshold">Stale Threshold (minutes)</Label>
              <Input id="add-threshold" type="number" min={1} max={10080} required disabled={addStep !== 'idle'} {...f('stale_threshold_minutes')} />
              <p className="text-xs text-slate-400">Alert if email older than this threshold exists</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-recipients">Alert Recipients</Label>
              <Input id="add-recipients" placeholder="a@co.com, b@co.com" required disabled={addStep !== 'idle'} {...f('alert_recipients')} />
              <p className="text-xs text-slate-400">Comma-separated emails</p>
            </div>
          </div>
          {addError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeAdd} disabled={addStep !== 'idle'}>Cancel</Button>
            <Button type="submit" disabled={addStep !== 'idle'} loading={addStep !== 'idle'}>
              {addBtnLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          EDIT MAILBOX MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!editMailbox} onClose={editStep === 'idle' ? closeEdit : undefined} title="Edit Mailbox" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Leave the token blank to keep the existing value.
              If you change Tenant ID or Client ID, a new refresh token is required and will be validated with Microsoft before saving.
            </p>
          </div>

          <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{editMailbox?.mailbox_email}</span>
            <span className="ml-2 text-xs text-slate-400">(email cannot be changed)</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="edit-ms-tenant">Microsoft Tenant ID</Label>
              <Input id="edit-ms-tenant" required disabled={editStep !== 'idle'} {...f('ms_tenant_id')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-ms-client">Microsoft Client ID</Label>
              <Input id="edit-ms-client" required disabled={editStep !== 'idle'} {...f('ms_client_id')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="edit-threshold">Stale Threshold (minutes)</Label>
              <Input id="edit-threshold" type="number" min={1} max={10080} required disabled={editStep !== 'idle'} {...f('stale_threshold_minutes')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-recipients">Alert Recipients</Label>
              <Input id="edit-recipients" placeholder="a@co.com, b@co.com" required disabled={editStep !== 'idle'} {...f('alert_recipients')} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-token">
              New Refresh Token{' '}
              <span className={`font-normal text-xs ${
                (form.ms_tenant_id !== editMailbox?.ms_tenant_id || form.ms_client_id !== editMailbox?.ms_client_id)
                  ? 'text-amber-600 font-medium'
                  : 'text-slate-400'
              }`}>
                {(form.ms_tenant_id !== editMailbox?.ms_tenant_id || form.ms_client_id !== editMailbox?.ms_client_id)
                  ? '(required — Tenant/Client ID changed)'
                  : '(optional — leave blank to keep current)'}
              </span>
            </Label>
            <textarea id="edit-token"
              placeholder="Leave blank to keep existing token"
              value={form.refresh_token} disabled={editStep !== 'idle'}
              onChange={e => setForm(p => ({ ...p, refresh_token: e.target.value }))}
              rows={3}
              className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-50" />
          </div>

          {form.refresh_token.trim() && (
            <div className="space-y-1">
              <Label htmlFor="edit-expiry">Token Expiry Date <span className="text-slate-400 font-normal">(optional — auto-detected by Microsoft)</span></Label>
              <Input id="edit-expiry" type="date" disabled={editStep !== 'idle'}
                value={form.token_expiry_date ?? ''}
                onChange={e => setForm(p => ({ ...p, token_expiry_date: e.target.value }))} />
            </div>
          )}

          {editError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeEdit} disabled={editStep !== 'idle'}>Cancel</Button>
            <Button type="submit" disabled={editStep !== 'idle'} loading={editStep !== 'idle'}>
              {editBtnLabel}
            </Button>
          </div>
        </form>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          UPDATE TOKEN MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!tokenMailbox} onClose={tokenStep === 'saving' ? undefined : () => setTokenMailbox(null)}
        title={tokenStep === 'done' ? 'Token Updated' : 'Update Refresh Token'}>
        {tokenStep === 'done' ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <p className="font-semibold text-slate-900">Token validated and saved</p>
              <p className="text-xs text-slate-500">
                Microsoft confirmed the new token for <strong>{tokenMailbox?.mailbox_email}</strong>.
                Connection status is now Active.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-semibold text-blue-900">Reminder — make sure you've also:</p>
              <div className="flex items-start gap-2 text-xs text-blue-800">
                <ArrowRight className="h-3 w-3 shrink-0 mt-0.5" />
                <span>Updated ReadSoft's backend config with the same refresh token</span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setTokenMailbox(null)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`border rounded-lg p-3 text-sm space-y-1.5 ${
              tokenNeedsAction(tokenMailbox?.token_status)
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <p className="font-medium flex items-center gap-1.5">
                {tokenNeedsAction(tokenMailbox?.token_status) ? <AlertTriangle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                {tokenNeedsAction(tokenMailbox?.token_status) ? 'Token Update Required' : 'Rotate Refresh Token'}
              </p>
              <p className="text-xs">For <strong>{tokenMailbox?.mailbox_email}</strong>:</p>
              <ol className="text-xs list-decimal list-inside space-y-0.5 ml-1">
                <li>Re-authenticate in your Microsoft / ReadSoft portal to get a new token</li>
                <li>Update ReadSoft's backend config with the new token</li>
                <li>Paste the same token below — it will be <strong>validated with Microsoft</strong> before saving</li>
              </ol>
            </div>
            <form onSubmit={handleTokenSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-token">New Refresh Token</Label>
                <textarea id="new-token" required
                  placeholder="Paste the new OAuth2 refresh token"
                  value={tokenForm.refresh_token} disabled={tokenStep === 'saving'}
                  onChange={e => setTokenForm(p => ({ ...p, refresh_token: e.target.value }))}
                  rows={4}
                  className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-50" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="token-expiry">Token Expiry Date <span className="text-slate-400 font-normal">(optional — auto-detected)</span></Label>
                <Input id="token-expiry" type="date" disabled={tokenStep === 'saving'}
                  value={tokenForm.token_expiry_date}
                  onChange={e => setTokenForm(p => ({ ...p, token_expiry_date: e.target.value }))} />
              </div>
              {tokenError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{tokenError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setTokenMailbox(null)} disabled={tokenStep === 'saving'}>Cancel</Button>
                <Button type="submit" disabled={tokenStep === 'saving'} loading={tokenStep === 'saving'}>
                  {tokenBtnLabel ?? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Save New Token</>}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          REGEN TOKEN MODAL
          Generates a new token using the stored one — does NOT save to DB.
          Admin copies the new token, updates ReadSoft, then uses âœ“ to save.
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!regenMailbox} onClose={regenStep === 'generating' ? undefined : closeRegen}
        title="Regenerate Refresh Token">
        <div className="space-y-4">
          {regenStep !== 'done' ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-slate-800">How token regeneration works</p>
                <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
                  <li>Click <strong>Generate</strong> — we use the stored token to get a new one from Microsoft</li>
                  <li>Copy the new token and update it in <strong>ReadSoft</strong></li>
                  <li>Come back and click <strong>âœ“ Mark as Complete</strong> to save the new token here</li>
                </ol>
              </div>

              <p className="text-xs text-slate-500">
                Mailbox: <span className="font-medium text-slate-700">{regenMailbox?.mailbox_email}</span>
              </p>

              {regenError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {regenError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeRegen} disabled={regenStep === 'generating'}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleRegen} disabled={regenStep === 'generating'} loading={regenStep === 'generating'}>
                  {regenStep === 'generating' ? 'Contacting Microsoft...' : <><RefreshCw className="h-4 w-4 mr-1.5" />Generate New Token</>}
                </Button>
              </div>
            </>
          ) : (
            <>
              {regenToken ? (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-800 font-medium">New token generated successfully</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label>New Refresh Token</Label>
                      <button type="button" onClick={copyRegenToken}
                        className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                          regenCopied
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}>
                        {regenCopied ? 'âœ“ Copied!' : 'Copy'}
                      </button>
                    </div>
                    <textarea readOnly value={regenToken} rows={4}
                      className="block w-full border border-slate-200 bg-slate-50 rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none select-all" />
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-900">Next steps:</p>
                    <ol className="text-xs text-amber-800 list-decimal list-inside space-y-0.5">
                      <li>Copy the token above</li>
                      <li>Paste it into ReadSoft's configuration</li>
                      <li>Close this and click <strong>âœ“</strong> on the mailbox card to save it here</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-800 mb-1">Token validated — no rotation needed</p>
                  <p className="text-xs text-blue-700">
                    Microsoft confirmed the stored token is working but did not issue a new one.
                    This is normal for recently-issued tokens. Try again in a few days, or manually
                    obtain a new token from Microsoft if needed.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button type="button" onClick={closeRegen}>Close</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW INBOX MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!inboxMailbox} onClose={() => setInboxMailbox(null)}
        title="Inbox Viewer" size="lg">

        {/* Idle — show Fetch button */}
        {inboxState === 'idle' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Inbox className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Check what's in the inbox</p>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">
              Fetches all emails in the inbox and shows their age.
              Emails beyond the <strong>{inboxMailbox?.stale_threshold_minutes}-minute</strong> threshold are highlighted in red.
            </p>
            <p className="text-xs font-mono text-slate-400 mb-6">{inboxMailbox?.mailbox_email}</p>
            <Button onClick={fetchInbox}>
              <RefreshCw className="h-4 w-4 mr-1.5" />Fetch Inbox
            </Button>
          </div>
        )}

        {/* Loading */}
        {inboxState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-900 border-t-transparent mb-4" />
            <p className="text-sm text-slate-500">Connecting to mailbox...</p>
          </div>
        )}

        {/* Error */}
        {inboxState === 'error' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm font-medium text-red-700">Failed to fetch inbox</p>
            <p className="text-xs text-slate-500 text-center max-w-sm">{inboxFetchError}</p>
            <Button variant="outline" onClick={fetchInbox}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Try again
            </Button>
          </div>
        )}

        {/* Results */}
        {inboxState === 'done' && inboxResult && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-medium text-slate-700">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {inboxResult.total} email{inboxResult.total !== 1 ? 's' : ''} in inbox
              </div>
              {inboxResult.staleCount > 0 ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs font-medium text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {inboxResult.staleCount} stale (beyond {inboxResult.threshold} min threshold)
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No stale emails — inbox looks healthy
                </div>
              )}
              <button onClick={fetchInbox}
                className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />Refresh
              </button>
            </div>

            {/* Empty inbox */}
            {inboxResult.total === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">Inbox is empty</p>
                <p className="text-xs text-slate-500">No emails waiting. Mobile Approval is processing correctly.</p>
              </div>
            ) : (
              /* Email table */
              (() => {
                const totalPages = Math.max(1, Math.ceil(inboxResult.emails.length / INBOX_PAGE_SIZE))
                const pageEmails = inboxResult.emails.slice(
                  inboxPage * INBOX_PAGE_SIZE,
                  (inboxPage + 1) * INBOX_PAGE_SIZE,
                )
                return (
                  <>
                    <div className="rounded-lg border border-slate-200 overflow-x-auto">
                      <table className="w-full text-sm border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">From</th>
                            <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Arrived</th>
                            <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Age</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageEmails.map((email, i) => (
                            <tr key={inboxPage * INBOX_PAGE_SIZE + i} className={`border-b border-slate-100 last:border-0 ${
                              email.isStale ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}>
                              <td className="px-3 py-2.5 max-w-[180px]">
                                <div className="flex items-center gap-1.5">
                                  {email.isStale && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                                  <span className={`text-xs truncate ${email.isStale ? 'text-red-700 font-medium' : 'text-slate-700'}`}>
                                    {email.subject}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 hidden sm:table-cell">
                                <span className="text-xs text-slate-500 truncate max-w-[140px] block">{email.from}</span>
                              </td>
                              <td className="px-3 py-2.5 hidden md:table-cell">
                                <span className="text-xs text-slate-500 whitespace-nowrap">{formatArrival(email.arrivedAt)}</span>
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <span className={`text-xs font-semibold whitespace-nowrap ${email.isStale ? 'text-red-600' : 'text-slate-600'}`}>
                                  {formatAge(email.ageMinutes)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          {inboxPage * INBOX_PAGE_SIZE + 1}â€“{Math.min((inboxPage + 1) * INBOX_PAGE_SIZE, inboxResult.emails.length)} of {inboxResult.emails.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" disabled={inboxPage === 0}
                            onClick={() => setInboxPage(p => p - 1)}>
                            Previous
                          </Button>
                          <span className="font-medium text-slate-700">{inboxPage + 1} / {totalPages}</span>
                          <Button variant="outline" disabled={inboxPage >= totalPages - 1}
                            onClick={() => setInboxPage(p => p + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()
            )}
          </div>
        )}
      </Modal>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          DELETE CONFIRMATION MODAL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!deleteMailbox} onClose={() => setDeleteMailbox(null)} title="Delete Mailbox" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <strong className="text-slate-900">{deleteMailbox?.mailbox_email}</strong>?
            This removes all associated alerts and cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteMailbox(null)}>Cancel</Button>
            <Button variant="destructive" loading={deleteMutation.isPending}
              onClick={() => { setDeleteError(''); deleteMutation.mutate(deleteMailbox.id) }}>
              <XCircle className="h-4 w-4 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
