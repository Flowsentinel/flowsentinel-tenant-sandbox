import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { TenantLayout } from '@/components/layout/TenantLayout'
import CompanyCode from '@/pages/CompanyCode'
import Activate from '@/pages/Activate'
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import VerifyOtp from '@/pages/VerifyOtp'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Mailboxes from '@/pages/Mailboxes'
import Alerts from '@/pages/Alerts'
import Users from '@/pages/Users'
import Settings from '@/pages/Settings'
import Profile from '@/pages/Profile'
import Support from '@/pages/Support'

export const router = createBrowserRouter([
  // Public — pre-auth
  { path: '/',                element: <CompanyCode /> },
  { path: '/activate',        element: <Activate /> },
  { path: '/login',           element: <Login /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/verify-otp',      element: <VerifyOtp /> },
  { path: '/reset-password',  element: <ResetPassword /> },

  // Protected — all post-auth pages live under TenantLayout
  {
    path: '/*',
    element: <ProtectedRoute><TenantLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'alerts',    element: <Alerts /> },
      { path: 'mailboxes', element: <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN', 'READ_ONLY']}><Mailboxes /></ProtectedRoute> },
      { path: 'users',     element: <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}><Users /></ProtectedRoute> },
      { path: 'settings',  element: <ProtectedRoute requiredRoles={['SUPER_ADMIN', 'ADMIN']}><Settings /></ProtectedRoute> },
      { path: 'profile',   element: <Profile /> },
      { path: 'support',   element: <Support /> },
      { path: '*',         element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
