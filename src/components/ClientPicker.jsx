export default function ClientPicker({ clients, selectedId, onSelect }) {
  if (!clients.length) return (
    <div style={{ margin:'0 16px 16px', padding:'10px 14px', background:'var(--amber-light)', borderRadius:'var(--r-sm)', fontSize:13, color:'var(--amber-text)' }}>
      No clients yet — add one on the Clients tab first.
    </div>
  )

  const statusLabel = { paused: ' (paused)', deactivated: ' (deactivated)' }

  return (
    <div style={{ padding:'0 16px 12px' }}>
      <select className="form-select" value={selectedId || ''} onChange={e => onSelect(e.target.value || null)}>
        <option value="">Select a client…</option>
        {clients
          .filter(c => c.status !== 'deleted')
          .sort((a, b) => {
            const order = { active: 0, paused: 1, deactivated: 2 }
            return (order[a.status] ?? 0) - (order[b.status] ?? 0) || a.name.localeCompare(b.name)
          })
          .map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{statusLabel[c.status] || ''}
            </option>
          ))}
      </select>
    </div>
  )
}
