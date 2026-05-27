import { HelpCircle, Mail, ExternalLink } from 'lucide-react'

export default function Support() {
  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Support</h1>
        <p className="text-sm text-slate-500 mt-0.5">Get help with FlowSentinel</p>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Email Support</h2>
              <p className="text-sm text-slate-500 mb-3">
                Contact your FlowSentinel account manager for licensing, billing, or technical issues.
              </p>
              <a
                href="mailto:support@flowsentinel.io"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                support@flowsentinel.io
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <HelpCircle className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Documentation</h2>
              <p className="text-sm text-slate-500 mb-3">
                Read the setup guide and troubleshooting articles for FlowSentinel.
              </p>
              <a
                href="https://docs.flowsentinel.io"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                docs.flowsentinel.io
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
