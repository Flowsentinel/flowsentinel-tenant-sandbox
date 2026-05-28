import { useState, useEffect } from 'react'
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, Mailbox, Users, Settings, LogOut,
  Bell, UserCircle, HelpCircle, TriangleAlert, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'
import { getTenantClient } from '@/lib/supabase'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { IdleWarningModal } from '@/components/IdleWarningModal'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',     roles: null },
  { to: '/mailboxes',  icon: Mailbox,          label: 'Mailboxes',     roles: ['SUPER_ADMIN', 'ADMIN', 'READ_ONLY'] },
  { to: '/alerts',     icon: Bell,             label: 'Alert History', roles: null },
  { to: '/users',      icon: Users,            label: 'Users',   roles: ['SUPER_ADMIN'] },
  { to: '/settings',   icon: Settings,         label: 'Settings',      roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/profile',    icon: UserCircle,       label: 'My Profile',    roles: null },
]

export function TenantLayout() {
  const { user, logout, profile } = useAuthStore()
  const { tenantName, clearTenant } = useTenantStore()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Lightweight query just for the license expiry banner
  const { data: licenseInfo } = useQuery({
    queryKey: ['license-expiry-banner'],
    queryFn: async () => {
      const { data } = await getTenantClient()
        .from('tenant_config')
        .select('expires_at, status')
        .single()
      return data
    },
    staleTime: 5 * 60 * 1000,
  })

  const expiresAt  = licenseInfo?.expires_at ? new Date(licenseInfo.expires_at) : null
  const daysLeft   = expiresAt ? Math.ceil((expiresAt - new Date()) / 86400000) : null
  const showBanner = daysLeft !== null && daysLeft <= 30

  async function handleLogout() {
    await logout()
    clearTenant()
    navigate('/', { replace: true })
  }

  const { showWarning, secondsLeft, keepAlive } = useIdleTimer({ onLogout: handleLogout })

  const displayName = profile?.full_name ?? user?.email ?? ''
  const initials    = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const visibleNav  = navItems.filter(({ roles }) => !roles || roles.includes(profile?.role))

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">

      {/* ── Mobile backdrop ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0
          transition-transform duration-300 ease-in-out
          md:relative md:w-56 md:z-auto md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: '#0d1526' }}
      >
        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/icon.svg" alt="FlowSentinel" className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm leading-tight tracking-tight">FlowSentinel</p>
              <p className="text-[10px] text-indigo-300/70 leading-tight truncate">
                Workflow Continuity Monitor
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden shrink-0 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900'
                    : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Help link */}
        <div className="px-2.5 pb-1 border-t border-white/5 pt-2">
          <a
            href="https://help.flowsentinel.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-white/[0.07] hover:text-slate-200 transition-all duration-150"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help &amp; Docs
          </a>
        </div>

        {/* User footer */}
        <div className="border-t border-white/5 px-2.5 py-3">
          <div className="flex items-center gap-2.5 px-2">
            <Link to="/profile" className="shrink-0">
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                {initials || '?'}
              </div>
            </Link>
            <Link to="/profile" className="min-w-0 flex-1 group">
              <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-indigo-300 transition-colors">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 truncate leading-tight">
                {profile?.role?.replace('_', ' ').toLowerCase() ?? ''}
              </p>
            </Link>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="ml-auto shrink-0 text-slate-500 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 shrink-0 border-b border-white/5" style={{ background: '#0d1526' }}>
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="FlowSentinel" className="h-7 w-7" />
            <span className="font-semibold text-white text-sm">FlowSentinel</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* License expiry banner */}
        {showBanner && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2.5 shrink-0">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-xs md:text-sm">
                Your license {daysLeft > 0
                  ? `expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now to avoid interruption.`
                  : 'has expired. Please renew immediately.'}
              </span>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="shrink-0 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Renew
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* Inactivity warning */}
      {showWarning && (
        <IdleWarningModal
          secondsLeft={secondsLeft}
          onKeepAlive={keepAlive}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}
