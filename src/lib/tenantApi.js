import { getTenantClient } from './supabase'
import { useTenantStore } from '@/stores/tenantStore'

function getBase() {
  const { projectUrl, anonKey } = useTenantStore.getState()
  return { projectUrl, anonKey }
}

async function post(fn, body, token) {
  const { projectUrl, anonKey } = getBase()
  const res = await fetch(`${projectUrl}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey,
    },
    body: JSON.stringify(body ?? {}),
  })
  const json = await res.json()
  if (!json.success) {
    throw Object.assign(new Error(json.error?.message ?? 'Unknown error'), {
      code: json.error?.code,
    })
  }
  return json.data
}

/** Call a tenant Edge Function using the current session token. */
export async function callTenantFn(fn, body = {}) {
  const { data: { session } } = await getTenantClient().auth.getSession()
  const { anonKey } = getBase()
  return post(fn, body, session?.access_token ?? anonKey)
}

/** Call a tenant Edge Function using only the anon key (pre-login setup calls). */
export async function callTenantFnAnon(fn, body = {}) {
  const { anonKey } = getBase()
  return post(fn, body, anonKey)
}

/** Call a tenant Edge Function with an explicit access token (e.g., right after login). */
export async function callTenantFnWithToken(fn, body = {}, accessToken) {
  return post(fn, body, accessToken)
}
