const variants = {
  success:  'bg-green-100 text-green-700',
  warning:  'bg-amber-100 text-amber-700',
  danger:   'bg-red-100 text-red-700',
  info:     'bg-blue-100 text-blue-700',
  neutral:  'bg-slate-100 text-slate-600',
}

export function Badge({ children, variant = 'neutral' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant] ?? variants.neutral}`}>
      {children}
    </span>
  )
}
