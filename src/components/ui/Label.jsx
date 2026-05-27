export function Label({ children, className = '', ...props }) {
  return (
    <label
      className={`block text-sm font-medium text-slate-700 mb-1 ${className}`}
      {...props}
    >
      {children}
    </label>
  )
}
