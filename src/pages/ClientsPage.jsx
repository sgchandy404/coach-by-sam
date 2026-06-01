import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { getClients, addClient, updateClient, deleteClientFull, getPRs, getAttributes, getMeasurements } from '../lib/firestore.js'
import { getInitials, avatarColor } from '../lib/utils.js'
import { GOAL_TYPES, DEFAULT_THRESHOLDS } from '../lib/evaluate.js'
import ProgressReport from '../components/ProgressReport.jsx'

const statusPill = {
  active:      null,
  paused:      { label:'Paused',      bg:'#FAEEDA', color:'#633806', border:'#FAC775' },
  deactivated: { label:'Deactivated', bg:'#FCEBEB', color:'#791F1F', border:'#F7C1C1' },
}

export default function ClientsPage({ clientId, setClientId, setTab }) {
  const [clients, setClients]   = useState([])
  const [tab, setLocalTab]      = useState('active')
  const [filter, setFilter]     = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [managing, setManaging] = useState(null)
  const [loading, setLoading]   = useState(true)

  const load = () => getClients().then(c => { setClients(c); setLoading(false) })
  useEffect(() => { load() }, [])

  const togglePayment = async (e, c) => {
    e.stopPropagation()
    const next = c.paymentStatus === 'paid' ? 'unpaid' : 'paid'
    await updateClient(c.id, { paymentStatus: next })
    setClients(cs => cs.map(x => x.id === c.id ? { ...x, paymentStatus: next } : x))
  }

  const handleStatusChange = async (id, newStatus) => {
    await updateClient(id, { status: newStatus })
    setClients(cs => cs.map(x => x.id === id ? { ...x, status: newStatus } : x))
    setManaging(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this client and ALL their data? This cannot be undone.')) return
    await deleteClientFull(id)
    if (clientId === id) setClientId(null)
    setClients(cs => cs.filter(x => x.id !== id))
    setManaging(null)
  }

  const unpaidCount = clients.filter(c => c.paymentStatus !== 'paid' && c.status === 'active').length

  const visible = clients.filter(c => {
    if (tab === 'active') return c.status === 'active'
    if (tab === 'paused') return c.status === 'paused' || c.status === 'deactivated'
    return true
  }).filter(c => filter === 'unpaid' ? c.paymentStatus !== 'paid' : true)

  return (
    <>
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1>Clients</h1>
          <p>{clients.filter(c => c.status === 'active').length} active{unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ''}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => signOut(auth)} style={{ color:'var(--text-3)', fontSize:12 }}>
          Sign out
        </button>
      </div>

      {unpaidCount > 0 && tab === 'active' && (
        <div style={{ margin:'0 16px 12px', padding:'10px 14px', background:'var(--amber-light)', borderRadius:'var(--r-sm)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <AlertIcon />
            <span style={{ fontSize:13, fontWeight:600, color:'var(--amber-text)' }}>
              {unpaidCount} client{unpaidCount > 1 ? 's' : ''} with outstanding payment
            </span>
          </div>
          <button onClick={() => setFilter(f => f === 'unpaid' ? 'all' : 'unpaid')}
            style={{ fontSize:12, fontWeight:600, color:'#854F0B', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
            {filter === 'unpaid' ? 'Show all' : 'View'}
          </button>
        </div>
      )}

      <div style={{ display:'flex', gap:6, padding:'0 16px 12px' }}>
        {[['active','Active'],['paused','Paused / Off'],['all','All']].map(([key, label]) => (
          <button key={key} onClick={() => { setLocalTab(key); setFilter('all') }}
            style={{ padding:'6px 14px', borderRadius:100, fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
              background: tab === key ? 'var(--accent)' : 'transparent',
              color:      tab === key ? '#fff' : 'var(--text-2)',
              borderColor: tab === key ? 'var(--accent)' : 'var(--border-mid)' }}>
            {label}
          </button>
        ))}
      </div>

      <div className="section">
        {loading ? (
          <p style={{ color:'var(--text-3)', fontSize:14, padding:'20px 0' }}>Loading…</p>
        ) : visible.length === 0 ? (
          <div className="empty">
            <p>{tab === 'active' ? 'No active clients.' : tab === 'paused' ? 'No paused or deactivated clients.' : 'No clients yet.'}</p>
          </div>
        ) : (
          <div className="card" style={{ padding:0 }}>
            {visible.map(c => {
              const paid = c.paymentStatus === 'paid'
              const pill = statusPill[c.status]
              return (
                <div key={c.id} className="list-row"
                  style={{ padding:'14px 16px', cursor:'pointer', background: clientId === c.id ? 'var(--accent-light)' : 'transparent' }}
                  onClick={() => { setClientId(c.id); setTab('prs') }}>
                  <div className="avatar" style={{ background: avatarColor(c.name) }}>{getInitials(c.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <p style={{ fontWeight:600, fontSize:15 }}>{c.name}</p>
                      {pill && <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:pill.bg, color:pill.color, border:`1px solid ${pill.border}` }}>{pill.label}</span>}
                    </div>
                    {c.goal && <p style={{ fontSize:12, color:'var(--text-2)', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.goal}</p>}
                  </div>
                  <button onClick={e => togglePayment(e, c)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:100, flexShrink:0, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                      border: paid ? '1.5px solid #9FE1CB' : '1.5px solid #FAC775',
                      background: paid ? '#E1F5EE' : '#FAEEDA',
                      color: paid ? '#085041' : '#633806' }}>
                    {paid ? <CheckIcon /> : <ClockIcon />}
                    {paid ? 'Paid' : 'Unpaid'}
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); setManaging(c) }}
                    style={{ color:'var(--text-3)', marginLeft:2 }}>
                    <DotsIcon />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add client">+</button>

      {showAdd && (
        <AddClientModal onClose={() => setShowAdd(false)}
          onSave={async (data) => { await addClient(data); await load(); setShowAdd(false) }} />
      )}
      {managing && (
        <ManageClientModal client={managing} onClose={() => setManaging(null)}
          onStatusChange={handleStatusChange} onDelete={handleDelete}
          onEdit={async (data) => { await updateClient(managing.id, data); await load(); setManaging(null) }} />
      )}
    </>
  )
}

// ── Add client modal ──────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSave }) {
  const [name, setName]       = useState('')
  const [goal, setGoal]       = useState('')
  const [goalType, setGoalType] = useState('general')
  const [dob, setDob]         = useState('')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">New client</p>
        <div className="form-group">
          <label className="form-label">Name *</label>
          <input className="form-input" placeholder="e.g. Priya Sharma" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Goal type</label>
          <select className="form-select" value={goalType} onChange={e => setGoalType(e.target.value)}>
            {GOAL_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Goal description</label>
          <input className="form-input" placeholder="e.g. Build strength, lose 5 kg" value={goal} onChange={e => setGoal(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" placeholder="Injuries, preferences, etc." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full" disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true)
              await onSave({ name: name.trim(), goal: goal.trim(), goalType, dob, notes: notes.trim(), paymentStatus:'unpaid', status:'active' })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Add client'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Manage client modal ───────────────────────────────────────────────────────
function ManageClientModal({ client, onClose, onStatusChange, onDelete, onEdit }) {
  const [view, setView]         = useState('menu')
  const [name, setName]         = useState(client.name)
  const [goal, setGoal]         = useState(client.goal || '')
  const [goalType, setGoalType] = useState(client.goalType || 'general')
  const [dob, setDob]           = useState(client.dob || '')
  const [notes, setNotes]       = useState(client.notes || '')
  const [thresholds, setThresholds] = useState(client.evaluationSettings || DEFAULT_THRESHOLDS)
  const [reportData, setReportData] = useState(null)
  const [saving, setSaving]     = useState(false)

  const loadReport = async () => {
    const [prs, attrs, measures] = await Promise.all([
      getPRs(client.id), getAttributes(client.id), getMeasurements(client.id)
    ])
    setReportData({ prs, attrs, measures })
    setView('report')
  }

  if (view === 'report') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxHeight:'95dvh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setView('menu')}><BackIcon /></button>
          <p style={{ fontWeight:700, fontSize:16 }}>{client.name} — Progress report</p>
        </div>
        {reportData
          ? <ProgressReport client={client} prs={reportData.prs} attributes={reportData.attrs} measurements={reportData.measures} />
          : <p style={{ color:'var(--text-3)', fontSize:14 }}>Loading…</p>}
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:16 }}>Close</button>
      </div>
    </div>
  )

  if (view === 'edit') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Edit — {client.name}</p>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Goal type</label>
          <select className="form-select" value={goalType} onChange={e => setGoalType(e.target.value)}>
            {GOAL_TYPES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Goal description</label>
          <input className="form-input" value={goal} onChange={e => setGoal(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="date" value={dob} onChange={e => setDob(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={() => setView('menu')}>Back</button>
          <button className="btn btn-primary btn-full" disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true)
              await onEdit({ name: name.trim(), goal: goal.trim(), goalType, dob, notes: notes.trim() })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )

  if (view === 'thresholds') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Evaluation settings</p>
        <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:16 }}>
          Adjust how sensitive the progress ranking is for {client.name}.
        </p>

        <ThresholdSlider
          label="Measurement change threshold"
          hint="% change needed to count as improving or declining"
          value={thresholds.measurementPct}
          min={1} max={10} step={1} unit="%"
          onChange={v => setThresholds(t => ({ ...t, measurementPct: v }))}
        />
        <ThresholdSlider
          label="Attribute score threshold"
          hint="Point change (out of 10) needed to count as meaningful"
          value={thresholds.attributePts}
          min={1} max={3} step={1} unit=" pts"
          onChange={v => setThresholds(t => ({ ...t, attributePts: v }))}
        />
        <ThresholdSlider
          label="PR stale threshold"
          hint="Days without a new PR before performance is marked declining"
          value={thresholds.prStaleDays}
          min={14} max={60} step={7} unit=" days"
          onChange={v => setThresholds(t => ({ ...t, prStaleDays: v }))}
        />

        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={() => setView('menu')}>Back</button>
          <button className="btn btn-primary btn-full" disabled={saving}
            onClick={async () => {
              setSaving(true)
              await onEdit({ evaluationSettings: thresholds })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  )

  const s = client.status
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">{client.name}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button className="btn btn-outline btn-full" onClick={loadReport}>
            <ChartIcon /> View progress report
          </button>
          <button className="btn btn-outline btn-full" onClick={() => setView('edit')}>
            <EditIcon /> Edit profile
          </button>
          <button className="btn btn-outline btn-full" onClick={() => setView('thresholds')}>
            <SlidersIcon /> Evaluation settings
          </button>
          <div style={{ height:1, background:'var(--border)', margin:'2px 0' }} />
          {s === 'active' && (
            <button className="btn btn-outline btn-full" onClick={() => onStatusChange(client.id, 'paused')}
              style={{ color:'var(--amber)', borderColor:'#FAC775' }}>
              <PauseIcon /> Pause client
            </button>
          )}
          {s === 'paused' && (
            <button className="btn btn-outline btn-full" onClick={() => onStatusChange(client.id, 'active')}
              style={{ color:'var(--teal)', borderColor:'#9FE1CB' }}>
              <PlayIcon /> Reactivate
            </button>
          )}
          {s !== 'deactivated' && (
            <button className="btn btn-outline btn-full" onClick={() => onStatusChange(client.id, 'deactivated')}
              style={{ color:'var(--coral)', borderColor:'#F0997B' }}>
              <ArchiveIcon /> Deactivate (keep data)
            </button>
          )}
          {s === 'deactivated' && (
            <button className="btn btn-outline btn-full" onClick={() => onStatusChange(client.id, 'active')}
              style={{ color:'var(--teal)', borderColor:'#9FE1CB' }}>
              <PlayIcon /> Reactivate
            </button>
          )}
          <div style={{ height:1, background:'var(--border)', margin:'2px 0' }} />
          <button className="btn btn-outline btn-full" onClick={() => onDelete(client.id)}
            style={{ color:'#E24B4A', borderColor:'#F09595' }}>
            <TrashIcon /> Delete permanently
          </button>
          <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'center' }}>Delete removes all data and cannot be undone.</p>
        </div>
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:12 }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Threshold slider ──────────────────────────────────────────────────────────
function ThresholdSlider({ label, hint, value, min, max, step, unit, onChange }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <label className="form-label" style={{ marginBottom:0 }}>{label}</label>
        <span style={{ fontWeight:700, fontSize:15, color:'var(--accent)' }}>{value}{unit}</span>
      </div>
      <input type="range" className="score-slider" min={min} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))} />
      <p style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>{hint}</p>
    </div>
  )
}

const CheckIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
const ClockIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const DotsIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>
const AlertIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const EditIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const ChartIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
const SlidersIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
const PauseIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
const PlayIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const ArchiveIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
const TrashIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const BackIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
