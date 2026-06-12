import { Clock } from 'lucide-react'

function pad(n) { return String(n).padStart(2, '0') }

function fmt(totalSecs) {
  const m = Math.floor(totalSecs / 60)
  const s = totalSecs % 60
  return `${pad(m)}:${pad(s)}`
}

/**
 * Shown after 10 minutes of inactivity.
 * Counts down 5 minutes — auto-logout fires when it reaches 0.
 * Any activity (or clicking "Stay Logged In") resets everything.
 */
export function IdleWarningModal({ secondsLeft, onKeepAlive, onLogout }) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / (5 * 60)) * 100))

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Backdrop — intentionally not clickable to dismiss (requires explicit action) */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center">

        {/* Icon */}
        <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-amber-50 flex items-center justify-center">
          <Clock className="h-7 w-7 text-amber-500" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 mb-1.5">Still there?</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          You've been inactive for 10 minutes.<br />
          You'll be logged out automatically in:
        </p>

        {/* Countdown */}
        <div className="text-5xl font-mono font-bold text-slate-900 mb-5 tabular-nums tracking-tight">
          {fmt(secondsLeft)}
        </div>

        {/* Progress bar — drains left to right */}
        <div className="h-1.5 bg-slate-100 rounded-full mb-7 overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onKeepAlive}
            className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Stay Logged In
          </button>
          <button
            onClick={onLogout}
            className="w-full py-2.5 px-4 text-slate-400 hover:text-slate-700 font-medium text-sm transition-colors rounded-xl hover:bg-slate-50"
          >
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  )
}
