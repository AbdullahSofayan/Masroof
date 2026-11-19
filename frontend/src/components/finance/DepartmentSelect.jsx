export default function DepartmentSelect({ departments, value, onChange, allLabel = 'All departments' }) {
  return <label className="flex items-center gap-2 text-xs text-zinc-500">Department
    <select className="input min-h-9 w-auto py-1.5 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{allLabel}</option>
      {departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
  </label>;
}
