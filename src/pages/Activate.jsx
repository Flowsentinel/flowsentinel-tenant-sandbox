import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { activateTenant } from '@/lib/registry'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFnAnon } from '@/lib/tenantApi'

function pwChecks(p) {
  return [
    { label: '12+ characters',    ok: p.length >= 12 },
    { label: 'Uppercase letter',  ok: /[A-Z]/.test(p) },
    { label: 'Lowercase letter',  ok: /[a-z]/.test(p) },
    { label: 'Number',            ok: /[0-9]/.test(p) },
    { label: 'Special character', ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ]
}

export default function Activate() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setTenant } = useTenantStore()

  const companyCode = location.state?.companyCode
  const companyName = location.state?.companyName

  const [form, setForm] = useState({
    licenseKey: '', projectUrl: '', anonKey: '',
    adminEmail: '', adminPassword: '',
  })
  const [showLicense, setShowLicense] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!companyCode) {
    navigate('/', { replace: true })
    return null
  }

  const checks = pwChecks(form.adminPassword)
  const pwValid = checks.every(c => c.ok)
  const canSubmit = form.licenseKey.trim() && form.projectUrl.trim() &&
    form.anonKey.trim() && form.adminEmail.trim() && pwValid

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    try {
      // 1. Validate license + store project details in registry
      const data = await activateTenant({
        companyCode,
        licenseKey: form.licenseKey.trim(),
        projectUrl: form.projectUrl.trim(),
        anonKey: form.anonKey.trim(),
      })

      // 2. Initialize tenant Supabase client
      setTenant({
        companyCode: data.company_code,
        companyName: data.company_name,
        projectUrl: data.project_url,
        anonKey: data.anon_key,
      })

      // 3. Bootstrap tenant database config (idempotent)
      try {
        await callTenantFnAnon('tenant-setup', {
          company_code: data.company_code,
          company_name: data.company_name,
          license_id: data.license_id,
          license_key: data.license_key,
          license_type: data.license_type,
          max_mailboxes: data.max_mailboxes,
          max_users: data.max_users,
          expires_at: data.expires_at,
        })
      } catch {
        // Non-fatal: tenant_config will be set up on first login if this fails
      }

      // 4. Create first admin account in tenant Supabase project
      const { error: signUpErr } = await getTenantClient().auth.signUp({
        email: form.adminEmail.trim().toLowerCase(),
        password: form.adminPassword,
      })

      if (signUpErr) {
        setError(`Account created but user setup failed: ${signUpErr.message}. You can log in if email confirmation was sent.`)
        return
      }

      navigate('/login', { replace: true })
    } catch (e) {
      if (e.code === 'INVALID_LICENSE' || e.code === 'LICENSE_MISMATCH') {
        setError('Invalid license key. Please check and try again.')
      } else if (e.code === 'LICENSE_EXPIRED') {
        setError('This license key has expired. Contact your administrator.')
      } else if (e.code === 'LICENSE_ALREADY_USED') {
        setError('This license key has already been activated.')
      } else if (e.code === 'ALREADY_ACTIVATED') {
        setError('This company is already activated. Go back to login.')
      } else {
        setError(e.message ?? 'Activation failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center mb-4 border border-white/20">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">FlowSentinel</h1>
          <p className="text-slate-400 text-sm mt-0.5">Activate your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">Account Activation</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Company: <span className="font-medium text-slate-700">{companyName}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* License Key */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">License Key</label>
              <div className="relative">
                <input
                  required type={showLicense ? 'text' : 'password'}
                  value={form.licenseKey}
                  onChange={e => setForm(f => ({ ...f, licenseKey: e.target.value }))}
                  placeholder="eyJ..."
                  className="block w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowLicense(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showLicense ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">Provided by your FlowSentinel administrator</p>
            </div>

            {/* Project URL */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Supabase Project URL</label>
              <input
                required type="url"
                value={form.projectUrl}
                onChange={e => setForm(f => ({ ...f, projectUrl: e.target.value }))}
                placeholder="https://xxxx.supabase.co"
                className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Anon Key */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Supabase Anon Key</label>
              <input
                required
                value={form.anonKey}
                onChange={e => setForm(f => ({ ...f, anonKey: e.target.value }))}
                placeholder="eyJ..."
                className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Create Admin Account</p>

              {/* Admin Email */}
              <div className="space-y-1 mb-3">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  required type="email"
                  value={form.adminEmail}
                  onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                  placeholder="admin@company.com"
                  className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Admin Password */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <input
                    required type={showPw ? 'text' : 'password'}
                    value={form.adminPassword}
                    onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                    placeholder="Min 12 characters"
                    className="block w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.adminPassword && (
                  <ul className="mt-1.5 space-y-0.5">
                    {checks.map(({ label, ok }) => (
                      <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                        {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit" disabled={loading || !canSubmit}
              className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Activating...' : 'Activate & Create Account'}
            </button>

            <button type="button" onClick={() => navigate('/', { replace: true })}
              className="w-full text-sm text-slate-400 hover:text-slate-600 text-center">
              ← Back to company code
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
