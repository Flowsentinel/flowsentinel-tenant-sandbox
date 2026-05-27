import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'

const ROLE_LABELS = {
  SUPER_ADMIN: { label: 'Super Admin', variant: 'info' },
  ADMIN:       { label: 'Admin',       variant: 'success' },
  AUDIT:       { label: 'Audit',       variant: 'neutral' },
  READ_ONLY:   { label: 'Read Only',   variant: 'neutral' },
}

function pwChecks(p) {
  return [
    { label: '12+ characters',    ok: p.length >= 12 },
    { label: 'Uppercase letter',  ok: /[A-Z]/.test(p) },
    { label: 'Lowercase letter',  ok: /[a-z]/.test(p) },
    { label: 'Number',            ok: /[0-9]/.test(p) },
    { label: 'Special character', ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ]
}

export default function Profile() {
  const { profile, user, session, setSession } = useAuthStore()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const checks = pwChecks(newPw)
  const pwValid = checks.every(c => c.ok)
  const canSubmit = currentPw.trim() && pwValid

  const roleInfo = ROLE_LABELS[profile?.role] ?? { label: profile?.role ?? '—', variant: 'neutral' }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const client = getTenantClient()

      // Verify current password by re-signing in
      const { error: signInErr } = await client.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPw,
      })
      if (signInErr) {
        setError('Current password is incorrect.')
        return
      }

      // Update to new password
      const { error: updateErr } = await client.auth.updateUser({ password: newPw })
      if (updateErr) {
        setError(updateErr.message)
        return
      }

      setSuccess('Password updated successfully.')
      setCurrentPw('')
      setNewPw('')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your account information</p>
      </div>

      <div className="space-y-6">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900 pb-4">Account Details</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Name</dt>
                <dd className="text-slate-900 font-medium">{profile?.full_name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-900">{user?.email ?? '—'}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Role</dt>
                <dd><Badge variant={roleInfo.variant}>{roleInfo.label}</Badge></dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900 pb-4">Change Password</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="current-pw">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    placeholder="Enter your current password"
                    className="pr-10"
                    required
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-pw">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNew ? 'text' : 'password'}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="Min 12 characters"
                    className="pr-10"
                    required
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPw && (
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

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              {success && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
              )}

              <Button type="submit" disabled={!canSubmit} loading={loading}>
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
