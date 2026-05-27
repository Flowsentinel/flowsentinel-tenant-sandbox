import { forwardRef } from 'react'

export const Input = forwardRef(({ className = '', error, ...props }, ref) => (
  <input
    ref={ref}
    className={`flex h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 ${
      error
        ? 'border-red-400 focus-visible:ring-red-400'
        : 'border-slate-200 focus-visible:ring-indigo-500'
    } ${className}`}
    {...props}
  />
))
Input.displayName = 'Input'
