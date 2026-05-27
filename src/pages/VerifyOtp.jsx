import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const { projectUrl } = useTenantStore()

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${projectUrl}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      })
      const json = await res.json()

      if (!json.success) {
        if (json.error?.code === 'OTP_LOCKED') {
          setError('Too many incorrect attempts. Please request a new code.')
        } else {
          setError('Invalid or expired code. Please check and try again.')
        }
        return
      }

      navigate('/reset-password', {
        state: { email, otpTokenId: json.data.otpTokenId },
        replace: true,
      })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return <Link to="/forgot-password" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f0eeff' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src="/logo_login.svg" alt="FlowSentinel" className="h-20" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-7">
          <p className="text-center text-slate-500 text-sm mb-1">
            Enter verification code
          </p>
          <p className="text-center text-xs text-slate-400 mb-6">
            Sent to <strong className="text-slate-600">{email}</strong>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-800">
                6-digit code
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                className="block w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono text-center tracking-[0.4em] text-slate-800 placeholder:text-slate-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
              <p className="text-xs text-slate-400">Code expires in 15 minutes</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-2">
            <Link
              to="/forgot-password"
              className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
            >
              Resend code
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
