import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTenantStore } from '@/stores/tenantStore'

export default function ForgotPassword() {
  const { projectUrl } = useTenantStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${projectUrl}/functions/v1/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const json = await res.json()

      if (!json.success && json.error?.code === 'RATE_LIMITED') {
        setError('Too many requests. Please wait before trying again.')
        return
      }

      setSent(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src="/logo_login.svg" alt="FlowSentinel" className="h-16" />
          </div>
          {!sent ? (
            <>
              <p className="text-center text-slate-500 text-sm mb-6">
                Reset your password
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-800">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="block w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                  />
                  <p className="text-xs text-slate-400">We'll send a 6-digit verification code</p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
                >
                  {loading ? 'Sending...' : 'Send reset code'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Check your email</h2>
                <p className="text-sm text-slate-500 mt-1">
                  If an account exists for <strong>{email}</strong>, a 6-digit code has been sent.
                </p>
              </div>
              <Link to="/verify-otp" state={{ email }}>
                <button className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                  Enter verification code
                </button>
              </Link>
            </div>
          )}

          <div className="mt-5 text-center">
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
