import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getTenantClient } from '@/lib/supabase'
import { useTenantStore } from './tenantStore'
import { resolveTenant } from '@/lib/registry'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      isAuthenticated: false,
      isLoading: true,

      setSession: (session, profile = null) => {
        set({
          session,
          user: session?.user ?? null,
          profile,
          isAuthenticated: !!session,
        })
      },

      setProfile: (profile) => set({ profile }),

      logout: async () => {
        try {
          const client = getTenantClient()
          await client.auth.signOut()
        } catch {
          // client may not be initialised — still clear state
        }
        localStorage.removeItem('fs-last-active')
        useTenantStore.getState().clearTenant()
        set({ session: null, user: null, profile: null, isAuthenticated: false })
      },

      init: async () => {
        useTenantStore.getState().rehydrateClient()

        // If the window was closed and reopened after 15 min of inactivity, treat
        // it as an expired session — don't restore even if the Supabase token is
        // still technically valid.
        const lastActive = localStorage.getItem('fs-last-active')
        if (lastActive && Date.now() - Number(lastActive) > 15 * 60 * 1000) {
          localStorage.removeItem('fs-last-active')
          try { await getTenantClient().auth.signOut() } catch { /* ignore */ }
          useTenantStore.getState().clearTenant()
          set({ session: null, user: null, profile: null, isAuthenticated: false, isLoading: false })
          return
        }

        try {
          const client = getTenantClient()
          const { data: { session } } = await client.auth.getSession()

          if (session) {
            // Try to load profile from users table
            const { data: profile } = await client
              .from('users')
              .select('id, auth_user_id, email, full_name, role, is_active')
              .eq('auth_user_id', session.user.id)
              .single()

            // Auto-setup tenant_config if missing (e.g., existing tenant before Phase 7)
            try {
              const { count: configCount } = await client
                .from('tenant_config')
                .select('id', { count: 'exact', head: true })

              if (!configCount || configCount === 0) {
                const { companyCode, projectUrl, anonKey } = useTenantStore.getState()
                if (companyCode) {
                  const tenantData = await resolveTenant(companyCode)
                  if (tenantData.license_id) {
                    const { callTenantFnAnon } = await import('@/lib/tenantApi')
                    await callTenantFnAnon('tenant-setup', {
                      company_code: tenantData.company_code,
                      company_name: tenantData.company_name,
                      license_id: tenantData.license_id,
                      license_key: tenantData.license_key,
                      license_type: tenantData.license_type,
                      max_mailboxes: tenantData.max_mailboxes,
                      max_users: tenantData.max_users,
                      expires_at: tenantData.expires_at,
                    })
                  }
                }
              }
            } catch {
              // Non-fatal: settings page will show empty state
            }

            set({
              session,
              user: session.user,
              profile: profile ?? null,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            set({ session: null, user: null, profile: null, isAuthenticated: false, isLoading: false })
          }

          client.auth.onAuthStateChange((_event, newSession) => {
            if (!newSession) {
              set({ session: null, user: null, profile: null, isAuthenticated: false })
            } else {
              set({ session: newSession, user: newSession.user, isAuthenticated: true })
            }
          })
        } catch {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'fs-tenant-auth',
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
