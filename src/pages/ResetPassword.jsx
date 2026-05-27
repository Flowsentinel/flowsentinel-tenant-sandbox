import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'
import { validatePassword } from '@/lib/validation'

export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const otpTokenId = location.state?.otpTokenId || ''
  const { projectUrl } = useTenantStore()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pwErrors = validatePassword(password)
  const isValid = pwErrors.length === 0 && password === confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isValid) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${projectUrl}/functions/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otpTokenId,
          newPassword: password,
        }),
      })
      const json = await res.json()

      if (!json.success) {
        if (json.error?.code === 'OTP_EXPIRED' || json.error?.code === 'OTP_INVALID') {
          setError('Your reset session has expired. Please start the process again.')
        } else if (json.error?.code === 'PASSWORD_TOO_WEAK') {
          setError('Password does not meet the requirements. Please choose a stronger password.')
        } else {
          setError('Failed to update password. Please try again.')
        }
        return
      }

      navigate('/login', {
        state: { message: 'Password updated successfully. Please sign in with your new password.' },
        replace: true,
      })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!email || !otpTokenId) {
    navigate('/forgot-password', { replace: true })
    return null
  }

  const requirements = [
    { label: '12+ characters',    ok: password.length >= 12 },
    { label: 'Uppercase letter',  ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',  ok: /[a-z]/.test(password) },
    { label: 'Number',            ok: /[0-9]/.test(password) },
    { label: 'Special character', ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0eeff' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_login.svg" alt="FlowSentinel" className="h-20" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-7">
          <p className="text-center text-slate-500 text-sm mb-6">
            Set a new password
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="block w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {password && (
                <ul className="mt-2 space-y-1">
                  {requirements.map(({ label, ok }) => (
                    <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-slate-400'}`}>
                      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                Confirm password
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className={`block w-full border rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 transition ${
                  confirm && password !== confirm
                    ? 'border-red-300 focus:ring-red-400 focus:border-red-400'
                    : 'border-slate-200 focus:ring-violet-500 focus:border-violet-500'
                }`}
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
