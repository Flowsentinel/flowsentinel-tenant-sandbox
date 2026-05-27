import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { initTenantClient, clearTenantClient } from '@/lib/supabase'

export const useTenantStore = create(
  persist(
    (set, get) => ({
      companyCode: null,
      tenantName: null,
      projectUrl: null,
      anonKey: null,
      isResolved: false,

      setTenant: ({ companyCode, companyName, projectUrl, anonKey }) => {
        initTenantClient(projectUrl, anonKey)
        set({ companyCode, tenantName: companyName, projectUrl, anonKey, isResolved: true })
      },

      clearTenant: () => {
        clearTenantClient()
        set({ companyCode: null, tenantName: null, projectUrl: null, anonKey: null, isResolved: false })
      },

      rehydrateClient: () => {
        const { projectUrl, anonKey, isResolved } = get()
        if (isResolved && projectUrl && anonKey) {
          initTenantClient(projectUrl, anonKey)
        }
      },
    }),
    {
      name: 'ap-tenant-config',
      partialize: (state) => ({
        companyCode: state.companyCode,
        tenantName: state.tenantName,
        projectUrl: state.projectUrl,
        anonKey: state.anonKey,
        isResolved: state.isResolved,
      }),
    },
  ),
)
