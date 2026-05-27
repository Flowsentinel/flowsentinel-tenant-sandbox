import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, UserX, UserCheck, Trash2, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { callTenantFn } from '@/lib/tenantApi'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

const ROLE_OPTIONS = [
  { value: 'ADMIN',     label: 'Admin' },
  { value: 'AUDIT',     label: 'Audit' },
  { value: 'READ_ONLY', label: 'Read Only' },
]

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

const EMPTY_FORM = { email: '', full_name: '', role: 'ADMIN', password: '' }

export default function Users() {
  const qc = useQueryClient()
  const { profile: myProfile } = useAuthStore()
  const isSuperAdmin = myProfile?.role === 'SUPER_ADMIN'

  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [deleteUser, setDeleteUser] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPw, setShowPw] = useState(false)
  const [formError, setFormError] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await getTenantClient()
        .from('users')
        .select('id, auth_user_id, email, full_name, role, is_active, created_at')
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: config } = useQuery({
    queryKey: ['tenant-quota-users'],
    queryFn: async () => {
      const { data } = await getTenantClient()
        .from('tenant_config')
        .select('max_users')
        .single()
      return data
    },
  })

  const createMutation = useMutation({
    mutationFn: (body) => callTenantFn('user-create', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); closeAdd() },
    onError: (e) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: (body) => callTenantFn('user-update', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); closeEdit() },
    onError: (e) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => callTenantFn('user-delete', { user_id: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteUser(null) },
    onError: (e) => setFormError(e.message),
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError('')
    setShowPw(false)
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
    setFormError('')
  }

  function openEdit(u) {
    setEditUser(u)
    setForm({ ...EMPTY_FORM, role: u.role })
    setFormError('')
  }

  function closeEdit() {
    setEditUser(null)
    setFormError('')
  }

  function handleAddSubmit(e) {
    e.preventDefault()
    const checks = pwChecks(form.password)
    if (!checks.every(c => c.ok)) {
      setFormError('Password does not meet all requirements.')
      return
    }
    createMutation.mutate({
      email: form.email,
      full_name: form.full_name,
      role: form.role,
      password: form.password,
    })
  }

  function handleEditSubmit(e) {
    e.preventDefault()
    updateMutation.mutate({
      user_id: editUser.id,
      role: form.role,
    })
  }

  function toggleActive(u) {
    setFormError('')
    updateMutation.mutate({ user_id: u.id, is_active: !u.is_active })
  }

  const checks = pwChecks(form.password)
  const pwValid = checks.every(c => c.ok)

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {users.length} / {config?.max_users ?? '—'} users
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add User
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Added</th>
                {isSuperAdmin && <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => {
                const isMe = u.id === myProfile?.id
                const roleInfo = ROLE_LABELS[u.role] ?? { label: u.role, variant: 'neutral' }
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{u.full_name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active
                        ? <Badge variant="success">Active</Badge>
                        : <Badge variant="neutral">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!isMe && u.role !== 'SUPER_ADMIN' && (
                            <>
                              <button
                                onClick={() => toggleActive(u)}
                                title={u.is_active ? 'Deactivate' : 'Activate'}
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                {u.is_active
                                  ? <UserX className="h-4 w-4" />
                                  : <UserCheck className="h-4 w-4 text-green-500" />}
                              </button>
                              <button
                                onClick={() => openEdit(u)}
                                title="Change Role"
                                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors text-xs font-medium px-2"
                              >
                                Role
                              </button>
                              <button
                                onClick={() => { setDeleteUser(u); setFormError('') }}
                                title="Delete"
                                className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {isMe && (
                            <span className="text-xs text-slate-400 px-2">You</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      <Modal open={addOpen} onClose={closeAdd} title="Add User">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="u-name">Full Name</Label>
            <Input id="u-name" required placeholder="Jane Smith"
              value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" required placeholder="jane@company.com"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="u-role">Role</Label>
            <Select
              id="u-role"
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              options={ROLE_OPTIONS}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="u-password">Password</Label>
            <div className="relative">
              <Input
                id="u-password"
                type={showPw ? 'text' : 'password'}
                required
                placeholder="Min 12 characters"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                className="pr-10"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.password && (
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

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeAdd}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending} disabled={!pwValid}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal open={!!editUser} onClose={closeEdit} title="Change Role" size="sm">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Changing role for <strong className="text-slate-900">{editUser?.full_name}</strong>
          </p>
          <div className="space-y-1">
            <Label htmlFor="edit-role">New Role</Label>
            <Select
              id="edit-role"
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              options={ROLE_OPTIONS}
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Save Role</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteUser} onClose={() => setDeleteUser(null)} title="Delete User" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong className="text-slate-900">{deleteUser?.full_name}</strong>?
            They will be permanently removed and can no longer sign in.
          </p>
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteUser.id)}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
