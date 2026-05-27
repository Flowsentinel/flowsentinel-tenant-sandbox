import { createClient } from '@supabase/supabase-js'

let _tenantClient = null

/**
 * Call this once after company-code resolution to initialise
 * the tenant-specific Supabase client.
 */
export function initTenantClient(projectUrl, anonKey) {
  _tenantClient = createClient(projectUrl, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'ap-tenant-supabase',
    },
  })
  return _tenantClient
}

export function getTenantClient() {
  if (!_tenantClient) throw new Error('Tenant Supabase client not initialised. Resolve company code first.')
  return _tenantClient
}

export function clearTenantClient() {
  _tenantClient = null
}
