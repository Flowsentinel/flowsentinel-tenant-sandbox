export function Button({ children, variant = 'default', size = 'default', className = '', disabled, loading, type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-600',
    outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:ring-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
    link: 'text-slate-900 underline-offset-4 hover:underline p-0 h-auto',
  }
  const sizes = {
    default: 'h-10 px-4 text-sm',
    sm: 'h-8 px-3 text-xs',
    lg: 'h-12 px-6 text-base',
  }
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
