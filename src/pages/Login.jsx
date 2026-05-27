import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFnWithToken } from '@/lib/tenantApi'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'

export default function Login() {
  const navigate = useNavigate()
  const { setSession, isAuthenticated } = useAuthStore()
  const { tenantName, clearTenant } = useTenantStore()

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const client = getTenantClient()
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authError) {
        setError('Invalid email or password.')
        return
      }

      const accessToken = data.session.access_token

      let profile = null
      try {
        const result = await callTenantFnWithToken('user-bootstrap', {}, accessToken)
        profile = result.profile
      } catch {
        // Non-fatal
      }

      const { data: { session: freshSession } } = await client.auth.refreshSession()
      setSession(freshSession ?? data.session, profile)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleChangeCompany() {
    clearTenant()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <img src="/logo_login.svg" alt="FlowSentinel" className="h-16" />
            {tenantName && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-sm font-medium text-violet-700 bg-violet-50 px-3 py-0.5 rounded-full border border-violet-100">
                  {tenantName}
                </span>
                <button
                  onClick={handleChangeCompany}
                  className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-slate-500 text-sm mb-6">
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="block w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="text-center">
              <Link
                to="/forgot-password"
                className="text-sm text-violet-600 hover:text-violet-700 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

        </div>
      </div>
    </div>
  )
}
