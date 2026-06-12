const REGISTRY_URL = import.meta.env.VITE_REGISTRY_EDGE_URL
const REGISTRY_ANON_KEY = import.meta.env.VITE_REGISTRY_ANON_KEY

async function callRegistry(fn, body) {
  const res = await fetch(`${REGISTRY_URL}/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REGISTRY_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw Object.assign(new Error(json.error?.message ?? 'Unknown error'), { code: json.error?.code })
  return json.data
}

export async function resolveTenant(companyCode) {
  return callRegistry('resolve-tenant', { company_code: companyCode })
}

export async function activateTenant({ companyCode, licenseKey, projectUrl, anonKey, superAdminEmail }) {
  return callRegistry('tenant-activate', {
    company_code:      companyCode,
    license_key:       licenseKey,
    project_url:       projectUrl,
    anon_key:          anonKey,
    super_admin_email: superAdminEmail ?? null,
  })
}
