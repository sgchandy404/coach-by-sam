import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getClients, getAttributes, addAttributes, deleteAttributes } from '../lib/firestore.js'
import { DEFAULT_ATTRIBUTES } from '../data/exercises.js'
import ClientPicker from '../components/ClientPicker.jsx'
import PageLoader from '../components/PageLoader.jsx'

const scoreColor = (s) => s >= 8 ? '#1AAF96' : s >= 6 ? '#D4900A' : s >= 4 ? '#D4900A' : '#E05545'

export default function AttributesPage({ clientId, setClientId }) {
  const [clients, setClients] = useState([])
  const [entries, setEntries] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { getClients().then(setClients) }, [])
  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getAttributes(clientId).then(d => { setEntries(d); setLoading(false) })
  }, [clientId])

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    await deleteAttributes(clientId, id)
    setEntries(e => e.filter(x => x.id !== id))
  }

  return (
    <>
      <div className="page-header">
        <h1>Attributes</h1>
        <p>Fitness qualities rated 1–10</p>
      </div>
      <ClientPicker clients={clients} selectedId={clientId} onSelect={setClientId} />

      {clientId ? (
        loading ? <PageLoader label="Loading attributes…" /> :
        entries.length === 0 ? <div className="empty"><p>No attribute scores yet.{'\n'}Tap + to add the first entry.</p></div> :
        entries.map(entry => (
          <div className="section" key={entry.id}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span className="section-title">{entry.date}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(entry.id)} style={{ color:'var(--text-3)' }}>
                <TrashIcon />
              </button>
            </div>
            <div className="card" style={{ padding:0 }}>
              {Object.entries(entry.scores || {}).map(([attr, score]) => (
                <div key={attr} className="list-row" style={{ padding:'12px 16px', gap:10 }}>
                  <span style={{ flex:1, fontSize:14, fontWeight:500 }}>{attr}</span>
                  <div style={{ width:90, height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ width:`${score * 10}%`, height:'100%', background:scoreColor(score), borderRadius:3 }} />
                  </div>
                  <div className="score-badge" style={{ background:scoreColor(score)+'22', color:scoreColor(score) }}>
                    {score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <NoClientPrompt
          icon={<RadarEmptyIcon />}
          message="Select a client above to view their fitness attribute scores."
        />
      )}

      {clientId && <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add scores">+</button>}

      {showAdd && (
        <AddAttributesModal onClose={() => setShowAdd(false)}
          onSave={async (data) => {
            const ref = await addAttributes(clientId, data)
            setEntries(e => [{ id: ref.id, ...data }, ...e])
            setShowAdd(false)
          }} />
      )}
    </>
  )
}

function AddAttributesModal({ onClose, onSave }) {
  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [scores, setScores] = useState(Object.fromEntries(DEFAULT_ATTRIBUTES.map(a => [a, 5])))
  const [saving, setSaving] = useState(false)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Rate attributes</p>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {DEFAULT_ATTRIBUTES.map(attr => (
          <div key={attr} style={{ marginBottom:18 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <label className="form-label" style={{ marginBottom:0 }}>{attr}</label>
              <span style={{ fontWeight:700, fontSize:15, color:scoreColor(scores[attr]) }}>{scores[attr]}</span>
            </div>
            <input type="range" className="score-slider" min="1" max="10" step="1"
              value={scores[attr]} onChange={e => setScores(s => ({ ...s, [attr]: Number(e.target.value) }))} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-3)', marginTop:2 }}>
              <span>1 — needs work</span><span>10 — elite</span>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full" disabled={saving}
            onClick={async () => { setSaving(true); await onSave({ date, scores }); setSaving(false) }}>
            {saving ? 'Saving…' : 'Save scores'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

const RadarEmptyIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
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
