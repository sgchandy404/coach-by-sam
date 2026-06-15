import { getInitials, avatarColor } from '../lib/utils.js'

export default function ClientPicker({ clients, selectedId, onSelect }) {
  if (!clients.length) return (
    <div style={{ margin:'0 16px 16px', padding:'10px 14px', background:'var(--amber-light)', borderRadius:'var(--r-sm)', fontSize:13, color:'var(--amber-text)' }}>
      No clients yet — add one on the Clients tab first.
    </div>
  )

  const sorted = [...clients]
    .filter(c => c.status !== 'deleted')
    .sort((a, b) => {
      const order = { active: 0, paused: 1, deactivated: 2 }
      return (order[a.status] ?? 0) - (order[b.status] ?? 0) || a.name.localeCompare(b.name)
    })

  return (
    <div style={{ padding:'0 16px 14px', overflowX:'auto', display:'flex', gap:10, scrollbarWidth:'none' }}>
      {sorted.map(c => {
        const selected = c.id === selectedId
        const color    = avatarColor(c.name)
        const inactive = c.status !== 'active'
        return (
          <button
            key={c.id}
            onClick={() => onSelect(selected ? null : c.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 2px', opacity: inactive ? 0.5 : 1,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: selected ? color : `${color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              color: selected ? '#fff' : color,
              boxShadow: selected ? `0 0 0 3px ${color}55, 0 2px 8px ${color}40` : 'none',
              transition: 'all 0.15s ease',
            }}>
              {getInitials(c.name)}
            </div>
            {/* Name */}
            <span style={{
              fontSize: 11, fontWeight: selected ? 700 : 500,
              color: selected ? 'var(--text)' : 'var(--text-3)',
              maxWidth: 52, textAlign: 'center',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}>
              {c.name.split(' ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
