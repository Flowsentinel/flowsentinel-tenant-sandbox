import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useTenantStore } from '@/stores/tenantStore'

export function ProtectedRoute({ children, requiredRoles }) {
  const { isAuthenticated, isLoading, profile } = useAuthStore()
  const { isResolved } = useTenantStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-900 border-t-transparent" />
      </div>
    )
  }

  if (!isResolved) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && profile?.role && !requiredRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
