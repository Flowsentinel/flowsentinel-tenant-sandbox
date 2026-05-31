import { useQuery } from '@tanstack/react-query'
import { Inbox, AlertTriangle, Users, ShieldCheck } from 'lucide-react'
import { getTenantClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const colors = {
    slate:  'bg-slate-100 text-slate-600',
    amber:  'bg-amber-100 text-amber-600',
    red:    'bg-red-100 text-red-600',
    green:  'bg-green-100 text-green-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const SEVERITY_VARIANT = {
  CRITICAL: 'danger', HIGH: 'danger', WARNING: 'warning', INFO: 'info',
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const client = getTenantClient()
      const [mailboxRes, alertRes, userRes, configRes] = await Promise.all([
        client.from('mailboxes').select('id', { count: 'exact', head: true }).eq('is_active', true),
        client.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
        client.from('users').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
        client.from('tenant_config').select('company_name, license_type, max_mailboxes, expires_at').single(),
      ])
      return {
        mailboxes: mailboxRes.count ?? 0,
        openAlerts: alertRes.count ?? 0,
        users: userRes.count ?? 0,
        config: configRes.data,
      }
    },
  })

  const { data: recentAlerts = [] } = useQuery({
    queryKey: ['recent-alerts'],
    queryFn: async () => {
      const { data } = await getTenantClient()
        .from('alerts')
        .select('id, alert_type, severity, title, mailbox_email, status, created_at')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {stats?.config?.company_name ?? 'Loading...'} — FlowSentinel
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={Inbox}
              label="Active Mailboxes"
              value={stats?.mailboxes}
              sub={`of ${stats?.config?.max_mailboxes ?? '?'} max`}
              color="slate"
            />
            <StatCard
              icon={AlertTriangle}
              label="Alerts"
              value={stats?.openAlerts}
              color={stats?.openAlerts > 0 ? 'amber' : 'green'}
            />
            <StatCard
              icon={Users}
              label="Users"
              value={stats?.users}
              color="slate"
            />
            <StatCard
              icon={ShieldCheck}
              label="License"
              value={stats?.config?.license_type ?? '—'}
              sub={stats?.config?.expires_at
                ? `Expires ${new Date(stats.config.expires_at).toLocaleDateString()}`
                : undefined}
              color="green"
            />
          </div>

          {recentAlerts.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Open Alerts</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Alert</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Mailbox</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAlerts.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{a.title}</td>
                      <td className="px-4 py-3 text-slate-500">{a.mailbox_email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={SEVERITY_VARIANT[a.severity] ?? 'neutral'}>{a.severity}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {recentAlerts.length === 0 && stats?.openAlerts === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <ShieldCheck className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">All clear — no open alerts.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
