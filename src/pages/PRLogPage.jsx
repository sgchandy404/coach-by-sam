import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getClients, getPRs, addPR, deletePR, getCustomExercises, addCustomExercise } from '../lib/firestore.js'
import { DEFAULT_EXERCISES } from '../data/exercises.js'
import { formatValue, groupBy } from '../lib/utils.js'
import ClientPicker from '../components/ClientPicker.jsx'
import PageLoader from '../components/PageLoader.jsx'

export default function PRLogPage({ clientId, setClientId }) {
  const [clients, setClients]   = useState([])
  const [prs, setPRs]           = useState([])
  const [customEx, setCustomEx] = useState([])
  const [showAdd, setShowAdd]   = useState(false)
  const [showAddEx, setShowAddEx] = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => { getClients().then(setClients) }, [])
  useEffect(() => { getCustomExercises().then(setCustomEx) }, [])
  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getPRs(clientId).then(d => { setPRs(d); setLoading(false) })
  }, [clientId])

  const allExercises = [...DEFAULT_EXERCISES, ...customEx]

  const handleDelete = async (prId) => {
    if (!confirm('Delete this PR entry?')) return
    await deletePR(clientId, prId)
    setPRs(p => p.filter(x => x.id !== prId))
  }

  const grouped = groupBy(prs, 'exerciseName')

  return (
    <>
      <div className="page-header">
        <h1>PR log</h1>
        <p>Personal records by exercise</p>
      </div>
      <ClientPicker clients={clients} selectedId={clientId} onSelect={setClientId} />

      {clientId ? (
        loading ? <PageLoader label="Loading PRs…" /> :
        prs.length === 0 ? <div className="empty"><p>No PRs logged yet.{'\n'}Tap + to add the first one.</p></div> :
        Object.entries(grouped).map(([exName, entries]) => (
          <div className="section" key={exName}>
            <div className="section-title">{exName}</div>
            <div className="card" style={{ padding:0 }}>
              {entries.map(pr => (
                <div key={pr.id} className="list-row" style={{ padding:'12px 16px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontWeight:700, fontSize:17, color:'var(--accent)' }}>
                        {formatValue(pr.value, pr.type, pr.unit)}
                      </span>
                    </div>
                    <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {pr.date}{pr.notes ? ` · ${pr.notes}` : ''}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(pr.id)} style={{ color:'var(--text-3)' }}>
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <NoClientPrompt
          icon={<TrophyEmptyIcon />}
          message="Select a client above to view their personal records."
        />
      )}

      {clientId && (
        <div className="section" style={{ marginTop:4 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowAddEx(true)}>
            + Add custom exercise
          </button>
        </div>
      )}

      {clientId && <button className="fab" onClick={() => setShowAdd(true)} aria-label="Log PR">+</button>}

      {showAdd && (
        <AddPRModal exercises={allExercises} onClose={() => setShowAdd(false)}
          onSave={async (data) => {
            const ref = await addPR(clientId, data)
            setPRs(p => [{ id: ref.id, ...data }, ...p])
            setShowAdd(false)
          }} />
      )}
      {showAddEx && (
        <AddExerciseModal onClose={() => setShowAddEx(false)}
          onSave={async (data) => {
            const ref = await addCustomExercise(data)
            setCustomEx(ex => [...ex, { id: ref.id, ...data }])
            setShowAddEx(false)
          }} />
      )}
    </>
  )
}

function AddPRModal({ exercises, onClose, onSave }) {
  const [exId, setExId]     = useState(exercises[0]?.id || '')

  const [date, setDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [value, setValue]   = useState('')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)

  const ex = exercises.find(e => e.id === exId) || exercises[0]
  const grouped = groupBy(exercises, 'category')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Log a PR</p>
        <div className="form-group">
          <label className="form-label">Exercise</label>
          <select className="form-select" value={exId} onChange={e => setExId(e.target.value)}>
            {Object.entries(grouped).map(([cat, exes]) => (
              <optgroup key={cat} label={cat}>
                {exes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">
            {ex?.type === 'time' ? 'Time (seconds)' : ex?.type === 'reps' ? 'Max reps' : `Weight (${ex?.unit || 'kg'})`}
          </label>
          <input className="form-input" type="number" inputMode="decimal" min="0" step="0.5"
            placeholder={ex?.type === 'time' ? 'e.g. 285  (= 4 min 45 sec)' : 'e.g. 80'}
            value={value} onChange={e => setValue(e.target.value)} />
          {ex?.type === 'time' && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>Enter total seconds. 5 min = 300 s</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <input className="form-input" placeholder="e.g. PB after 3 months" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full" disabled={!value || saving}
            onClick={async () => {
              setSaving(true)
              await onSave({ exerciseId: ex.id, exerciseName: ex.name, value: Number(value), type: ex.type, unit: ex.unit, date, notes: notes.trim() })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save PR'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddExerciseModal({ onClose, onSave }) {
  const [name, setName]         = useState('')
  const [category, setCategory] = useState('Custom')
  const [type, setType]         = useState('weight')
  const [saving, setSaving]     = useState(false)
  const unitMap = { weight:'kg', time:'sec', reps:'reps' }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Add custom exercise</p>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" placeholder="e.g. Bulgarian split squat" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <input className="form-input" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Tracked as</label>
          <div style={{ display:'flex', gap:8 }}>
            {['weight','time','reps'].map(t => (
              <button key={t} className={`btn btn-sm ${type === t ? 'btn-primary' : 'btn-outline'}`} style={{ flex:1 }}
                onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full" disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true)
              await onSave({ id: name.toLowerCase().replace(/\s+/g,'-'), name: name.trim(), category: category.trim(), type, unit: unitMap[type] })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Add exercise'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>

const TrophyEmptyIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
    <path d="M6 5h12v5a6 6 0 0 1-12 0V5z"/><path d="M12 16v4"/><path d="M8 20h8"/>
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
