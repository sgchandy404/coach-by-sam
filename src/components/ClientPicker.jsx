import { useState, useRef, useEffect } from 'react'
import { getInitials, avatarColor } from '../lib/utils.js'

const shortName = (name) => {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

const statusLabel = { paused: 'Paused', deactivated: 'Deactivated' }

export default function ClientPicker({ clients, selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  const selected = sorted.find(c => c.id === selectedId)

  return (
    <div ref={ref} style={{ padding:'0 16px 14px', position:'relative', zIndex:10 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', display:'flex', alignItems:'center', gap:10,
          padding:'10px 14px', borderRadius:12,
          background:'var(--surface)', border:'1px solid var(--border)',
          cursor:'pointer', textAlign:'left',
        }}
      >
        {selected ? (
          <>
            <div style={{
              width:32, height:32, borderRadius:'50%', flexShrink:0,
              background: avatarColor(selected.name),
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:700, color:'#fff',
            }}>
              {getInitials(selected.name)}
            </div>
            <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--bg)', flexShrink:0 }} />
            <span style={{ flex:1, fontSize:14, color:'var(--text-3)' }}>Select a client…</span>
          </>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
          style={{ flexShrink:0, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% - 6px)', left:16, right:16,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,0.12)',
          maxHeight:280, overflowY:'auto', zIndex:100,
        }}>
          {sorted.map((c, i) => {
            const isSelected = c.id === selectedId
            const color      = avatarColor(c.name)
            const inactive   = c.status !== 'active'
            return (
              <div
                key={c.id}
                onClick={() => { onSelect(c.id); setOpen(false) }}
                style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', cursor:'pointer',
                  background: isSelected ? `${color}12` : 'transparent',
                  borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: inactive ? 0.6 : 1,
                  transition:'background 0.1s',
                }}
              >
                <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background: color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700, color:'#fff',
                }}>
                  {getInitials(c.name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:14, fontWeight:600, color: isSelected ? color : 'var(--text)' }}>
                    {c.name}
                  </p>
                  <p style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                    {statusLabel[c.status] || 'Active'}
                  </p>
                </div>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ flexShrink:0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
