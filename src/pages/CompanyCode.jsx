import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ArrowRight } from 'lucide-react'
import { resolveTenant } from '@/lib/registry'
import { useTenantStore } from '@/stores/tenantStore'
import { useAuthStore } from '@/stores/authStore'

export default function CompanyCode() {
  const navigate = useNavigate()
  const { setTenant, isResolved } = useTenantStore()
  const { isAuthenticated } = useAuthStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (isResolved && isAuthenticated) {
    navigate('/dashboard', { replace: true })
    return null
  }
  if (isResolved) {
    navigate('/login', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await resolveTenant(code.trim().toUpperCase())

      if (data.status === 'PENDING_ACTIVATION') {
        navigate('/activate', {
          replace: true,
          state: { companyCode: data.company_code, companyName: data.company_name },
        })
        return
      }

      setTenant({
        companyCode: data.company_code,
        companyName: data.company_name,
        projectUrl: data.project_url,
        anonKey: data.anon_key,
      })
      navigate('/login', { replace: true })
    } catch (e) {
      if (e.code === 'TENANT_SUSPENDED') {
        setError('This account has been suspended. Please contact support.')
      } else if (e.code === 'TENANT_INACTIVE') {
        setError('This account is inactive. Please contact support.')
      } else if (e.code === 'LICENSE_EXPIRED') {
        setError('Your subscription has expired. Please contact your administrator.')
      } else if (e.code === 'NO_LICENSE') {
        setError('No active license found. Please contact your administrator.')
      } else if (e.code === 'NOT_FOUND') {
        setError('Company code not found. Please check and try again.')
      } else {
        setError('Unable to connect. Please check your company code and try again.')
      }
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

          <p className="text-center text-slate-500 text-sm mb-6">
            Enter your company code to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Company code
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="E.G. ACEK"
                  className="block w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest uppercase text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                />
              </div>
              <p className="text-xs text-slate-400">4-character code provided during setup</p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || code.trim().length < 2}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
            >
              {loading ? 'Connecting...' : (
                <>Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">New customer?</p>
            <button
              onClick={() => navigate('/activate')}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
            >
              Activate a license key
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
