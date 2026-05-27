import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { router } from './router'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Force-logout when any query or mutation receives an UNAUTHORIZED response.
// Supabase auto-refreshes tokens, so this is a safety net for edge cases only.
function handleUnauthorized(error) {
  if (error?.code === 'UNAUTHORIZED' || error?.code === 'USER_DISABLED') {
    useAuthStore.getState().logout()
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry auth errors
        if (error?.code === 'UNAUTHORIZED' || error?.code === 'FORBIDDEN') return false
        return failureCount < 1
      },
      staleTime: 30_000,
    },
  },
})

function App() {
  React.useEffect(() => { useAuthStore.getState().init() }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
