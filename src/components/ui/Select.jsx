export function Select({ id, value, onChange, options = [], className = '', ...props }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className={`block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}
