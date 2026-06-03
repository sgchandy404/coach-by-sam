import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getClients, getMeasurements, addMeasurement, deleteMeasurement } from '../lib/firestore.js'
import { DEFAULT_MEASUREMENTS } from '../data/exercises.js'
import ClientPicker from '../components/ClientPicker.jsx'
import PageLoader from '../components/PageLoader.jsx'

export default function MeasurementsPage({ clientId, setClientId }) {
  const [clients, setClients] = useState([])
  const [entries, setEntries] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { getClients().then(setClients) }, [])
  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getMeasurements(clientId).then(d => { setEntries(d); setLoading(false) })
  }, [clientId])

  const handleDelete = async (id) => {
    if (!confirm('Delete this measurement entry?')) return
    await deleteMeasurement(clientId, id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  const getDelta = (fieldId, idx) => {
    const curr = entries[idx]?.values?.[fieldId]
    const prev = entries[idx + 1]?.values?.[fieldId]
    if (curr == null || prev == null) return null
    const d = (curr - prev).toFixed(1)
    return Number(d) > 0 ? `+${d}` : d
  }

  return (
    <>
      <div className="page-header">
        <h1>Measurements</h1>
        <p>Body measurements over time</p>
      </div>
      <ClientPicker clients={clients} selectedId={clientId} onSelect={setClientId} />

      {clientId ? (
        loading ? <PageLoader label="Loading measurements…" /> :
        entries.length === 0 ? <div className="empty"><p>No measurements yet.{'\n'}Tap + to add the first entry.</p></div> :
        entries.map((entry, idx) => (
          <div className="section" key={entry.id}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span className="section-title">{entry.date}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(entry.id)} style={{ color:'var(--text-3)' }}>
                <TrashIcon />
              </button>
            </div>
            <div className="card" style={{ padding:0 }}>
              {DEFAULT_MEASUREMENTS.map(m => {
                const val = entry.values?.[m.id]
                if (val == null) return null
                const delta = getDelta(m.id, idx)
                const isWeight = m.id === 'weight'
                const dColor = delta == null ? null
                  : isWeight ? (parseFloat(delta) > 0 ? 'var(--coral)' : 'var(--teal)')
                             : (parseFloat(delta) > 0 ? 'var(--teal)' : 'var(--coral)')
                return (
                  <div key={m.id} className="list-row" style={{ padding:'10px 16px' }}>
                    <span style={{ flex:1, fontSize:13, color:'var(--text-2)' }}>{m.label}</span>
                    <span style={{ fontWeight:600 }}>{val} {m.unit}</span>
                    {delta && <span style={{ fontSize:11, fontWeight:600, color:dColor, minWidth:36, textAlign:'right' }}>{delta}</span>}
                  </div>
                )
              }).filter(Boolean)}
            </div>
          </div>
        ))
      ) : (
        <NoClientPrompt
          icon={<RulerEmptyIcon />}
          message="Select a client above to view their body measurements."
        />
      )}

      {clientId && <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add measurements">+</button>}

      {showAdd && (
        <AddMeasurementsModal onClose={() => setShowAdd(false)}
          onSave={async (data) => {
            const ref = await addMeasurement(clientId, data)
            setEntries(e => [{ id: ref.id, ...data }, ...e])
            setShowAdd(false)
          }} />
      )}
    </>
  )
}

function AddMeasurementsModal({ onClose, onSave }) {
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (id, val) => setValues(v => ({ ...v, [id]: val === '' ? undefined : Number(val) }))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Log measurements</p>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>Leave blank any measurements not taken today.</p>
        {DEFAULT_MEASUREMENTS.map(m => (
          <div key={m.id} className="form-group" style={{ marginBottom:10 }}>
            <label className="form-label">{m.label} ({m.unit})</label>
            <input className="form-input" type="number" inputMode="decimal" step="0.1" min="0" placeholder="—"
              value={values[m.id] ?? ''} onChange={e => set(m.id, e.target.value)} />
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full"
            disabled={saving || Object.values(values).filter(v => v != null).length === 0}
            onClick={async () => {
              setSaving(true)
              const filtered = Object.fromEntries(Object.entries(values).filter(([,v]) => v != null))
              await onSave({ date, values: filtered })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save measurements'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

const RulerEmptyIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/>
    <path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/>
  </svg>
)

function NoClientPrompt({ icon, message }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '64px 32px', gap: 14, textAlign: 'center',
    }}>
      <div style={{ opacity: 0.6 }}>{icon}</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>No client selected</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 220 }}>{message}</p>
    </div>
  )
}
