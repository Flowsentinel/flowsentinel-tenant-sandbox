import { Component } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

/**
 * Catches any unhandled render errors in the tree below it.
 * Without this, a crash anywhere produces a blank white screen.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log for debugging — never exposes user data
    console.error('[FlowSentinel] Render error:', error.message, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-1.5">Something went wrong</h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            An unexpected error occurred. If this keeps happening, please contact{' '}
            <a
              href="mailto:support@flowsentinel.cloud"
              className="text-violet-600 hover:underline"
            >
              support@flowsentinel.cloud
            </a>
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
