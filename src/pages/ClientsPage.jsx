import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import { getClients, addClient, updateClient, deleteClientFull, getPRs, getAttributes, getMeasurements, getAttendance, markAttended, unmarkAttended, addPayment, getPayments, deletePayment } from '../lib/firestore.js'
import { getInitials, avatarColor, parseDMY, formatDMY, toHTMLDate, fromHTMLDate, nextMondayDMY, getMonthWindow } from '../lib/utils.js'
import { GOAL_TYPES, DEFAULT_THRESHOLDS } from '../lib/evaluate.js'
import ProgressReport from '../components/ProgressReport.jsx'
import PageLoader from '../components/PageLoader.jsx'

const statusPill = {
  active:      null,
  paused:      { label:'Paused',      bg:'#FDF3DC', color:'#7A5200', border:'#E8C97A' },
  deactivated: { label:'Deactivated', bg:'#FAEAE4', color:'#6B2410', border:'#E8A88A' },
}

export default function ClientsPage({ clientId, setClientId, setTab }) {
  const [clients, setClients]       = useState([])
  const [tab, setLocalTab]          = useState('active')
  const [filter, setFilter]         = useState('all')
  const [showAdd, setShowAdd]       = useState(false)
  const [managing, setManaging]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [paymentModal, setPaymentModal] = useState(null) // { client }
  const [unpaidModal, setUnpaidModal]   = useState(null) // { client, lastPayment, currentCycleStart }

  const load = () => getClients().then(c => { setClients(c); setLoading(false) })
  useEffect(() => { load() }, [])

  // Derive paid status from the cycle the last payment covers, not just the flag.
  // If lastPaidCycleStart is present, the client is paid only if it matches today's cycle.
  // Falls back to paymentStatus for clients that pre-date this field.
  const isClientPaid = (c) => {
    if (c.lastPaidCycleStart && c.startDate) {
      const todayStr = formatDMY(new Date())
      const win = getMonthWindow(c.startDate, todayStr)
      if (win) return c.lastPaidCycleStart === formatDMY(win.windowStart)
    }
    return false
  }

  const handlePaymentTap = async (e, c) => {
    e.stopPropagation()
    if (!isClientPaid(c)) {
      setPaymentModal({ client: c })
    } else {
      const payments = await getPayments(c.id)
      const lastPayment = payments[0] || null
      const todayStr = formatDMY(new Date())
      const cycleWindow = c.startDate ? getMonthWindow(c.startDate, todayStr) : null
      const currentCycleStart = cycleWindow ? formatDMY(cycleWindow.windowStart) : null
      setUnpaidModal({ client: c, lastPayment, currentCycleStart })
    }
  }

  const handleConfirmPayment = async (amount, paymentDate, cycleStart, cycleEnd, isCurrentCycle) => {
    const clientId = paymentModal.client.id
    const ops = [addPayment(clientId, { amount, date: paymentDate, cycleStart, cycleEnd })]
    if (isCurrentCycle) {
      ops.push(updateClient(clientId, { paymentStatus: 'paid', lastPaidCycleStart: cycleStart }))
    }
    await Promise.all(ops)
    if (isCurrentCycle) {
      setClients(cs => cs.map(x => x.id === clientId ? { ...x, paymentStatus: 'paid', lastPaidCycleStart: cycleStart } : x))
    }
    setPaymentModal(null)
  }

  const handleConfirmUnpaid = async (paymentId) => {
    const clientId = unpaidModal.client.id
    const ops = [updateClient(clientId, { paymentStatus: 'unpaid', lastPaidCycleStart: null })]
    if (paymentId) ops.push(deletePayment(clientId, paymentId))
    await Promise.all(ops)
    setClients(cs => cs.map(x => x.id === clientId ? { ...x, paymentStatus: 'unpaid', lastPaidCycleStart: null } : x))
    setUnpaidModal(null)
  }

  const handleStatusChange = async (id, newStatus) => {
    const updates = { status: newStatus }

    if (newStatus === 'active') {
      const client = clients.find(c => c.id === id)
      const newStart = formatDMY(new Date())
      // Preserve the very first startDate as originalStartDate (only if not already saved)
      if (client?.startDate && !client?.originalStartDate) {
        updates.originalStartDate = client.startDate
      }
      updates.startDate = newStart
    }

    await updateClient(id, updates)
    setClients(cs => cs.map(x => x.id === id ? { ...x, ...updates } : x))
    setManaging(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this client and ALL their data? This cannot be undone.')) return
    await deleteClientFull(id)
    if (clientId === id) setClientId(null)
    setClients(cs => cs.filter(x => x.id !== id))
    setManaging(null)
  }

  const unpaidCount = clients.filter(c => !isClientPaid(c) && c.status === 'active').length

  const visible = clients.filter(c => {
    if (tab === 'active') return c.status === 'active'
    if (tab === 'paused') return c.status === 'paused' || c.status === 'deactivated'
    return true
  }).filter(c => filter === 'unpaid' ? !isClientPaid(c) : true)

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

      {tab === 'active' && (
        <div style={{
          margin: '0 18px 14px',
          padding: '14px 20px',
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          display: 'flex', gap: 0,
        }}>
          {[
            { value: clients.filter(c => c.status === 'active').length, label: 'Active', color: 'var(--accent)' },
            { value: unpaidCount, label: 'Unpaid', color: unpaidCount > 0 ? 'var(--coral)' : 'var(--teal)' },
            { value: clients.filter(c => c.status === 'paused' || c.status === 'deactivated').length, label: 'Inactive', color: 'var(--text-2)' },
          ].map((stat, i, arr) => (
            <div key={stat.label} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              {i < arr.length - 1 && (
                <div style={{ position: 'absolute', right: 0, top: '10%', height: '80%', width: 1, background: 'var(--border)' }} />
              )}
              <p style={{ fontSize: 26, fontWeight: 700, color: stat.color, fontFamily: 'Playfair Display, serif', lineHeight: 1.1 }}>{stat.value}</p>
              <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        {loading ? (
          <PageLoader />
        ) : visible.length === 0 ? (
          <div className="empty">
            <p>{tab === 'active' ? 'No active clients.' : tab === 'paused' ? 'No paused or deactivated clients.' : 'No clients yet.'}</p>
          </div>
        ) : (
          <div>
            {visible.map(c => {
              const paid = isClientPaid(c)
              const pill = statusPill[c.status]
              return (
                <div
                  key={c.id}
                  onClick={() => { setClientId(c.id); setTab('prs') }}
                  style={{
                    background: clientId === c.id ? 'var(--accent-light)' : 'var(--surface)',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    marginBottom: 10,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    cursor: 'pointer',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{ width: 4, background: avatarColor(c.name), flexShrink: 0 }} />

                  {/* Card content */}
                  <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Avatar with halo */}
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: avatarColor(c.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0,
                      boxShadow: `0 0 0 3px ${avatarColor(c.name)}33`,
                      fontFamily: 'DM Sans, sans-serif',
                    }}>{getInitials(c.name)}</div>

                    {/* Name + goal */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.2px' }}>{c.name}</p>
                        {pill && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100, background: pill.bg, color: pill.color, border: `1px solid ${pill.border}`, flexShrink: 0 }}>
                            {pill.label}
                          </span>
                        )}
                      </div>
                      {c.goal && (
                        <p style={{ fontSize: 13, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.goal}
                        </p>
                      )}
                    </div>

                    {/* Payment + dots menu */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <button onClick={e => handlePaymentTap(e, c)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: paid ? 'var(--teal)' : 'var(--amber)',
                          animation: paid ? 'none' : 'unpaid-pulse 1.8s ease-in-out infinite',
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: paid ? 'var(--teal)' : 'var(--amber)' }}>
                          {paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </button>
                      <button className="btn btn-ghost btn-icon" onClick={e => { e.stopPropagation(); setManaging(c) }}
                        style={{ color: 'var(--text-3)', padding: 4 }}>
                        <DotsIcon />
                      </button>
                    </div>
                  </div>
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
      {paymentModal && (
        <PaymentModal
          client={paymentModal.client}
          onConfirm={handleConfirmPayment}
          onClose={() => setPaymentModal(null)}
        />
      )}
      {unpaidModal && (
        <UnpaidConfirmModal
          client={unpaidModal.client}
          lastPayment={unpaidModal.lastPayment}
          currentCycleStart={unpaidModal.currentCycleStart}
          onConfirm={handleConfirmUnpaid}
          onClose={() => setUnpaidModal(null)}
        />
      )}
    </>
  )
}

// ── Add client modal ──────────────────────────────────────────────────────────
function AddClientModal({ onClose, onSave }) {
  const [name, setName]               = useState('')
  const [goal, setGoal]               = useState('')
  const [goalType, setGoalType]       = useState('general')
  const [dob, setDob]                 = useState('')
  const [notes, setNotes]             = useState('')
  const [membershipType, setMembership] = useState(3)
  const [startDate, setStartDate]     = useState(nextMondayDMY())
  const [monthlyFee, setMonthlyFee]   = useState('')
  const [saving, setSaving]           = useState(false)

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
          <label className="form-label">Membership</label>
          <div style={{ display:'flex', gap:8 }}>
            {[3, 4, 5].map(n => (
              <button key={n} type="button"
                onClick={() => setMembership(n)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:14, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: membershipType === n ? 'var(--accent)' : 'transparent',
                  color:      membershipType === n ? '#fff' : 'var(--text-2)',
                  borderColor: membershipType === n ? 'var(--accent)' : 'var(--border-mid)' }}>
                {n}×/wk
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Start date</label>
          <input className="form-input" type="date" value={toHTMLDate(startDate)}
            onChange={e => setStartDate(fromHTMLDate(e.target.value))} />
          <p style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>Defaults to next Monday</p>
        </div>
        <div className="form-group">
          <label className="form-label">Monthly fee (₹)</label>
          <input className="form-input" type="number" min="0" placeholder="e.g. 3000"
            value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
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
              await onSave({ name: name.trim(), goal: goal.trim(), goalType, dob, notes: notes.trim(), membershipType, startDate, monthlyFee: monthlyFee ? Number(monthlyFee) : null, paymentStatus:'unpaid', status:'active' })
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
  const [view, setView]             = useState('menu')
  const [name, setName]             = useState(client.name)
  const [goal, setGoal]             = useState(client.goal || '')
  const [goalType, setGoalType]     = useState(client.goalType || 'general')
  const [dob, setDob]               = useState(client.dob || '')
  const [notes, setNotes]           = useState(client.notes || '')
  const [membershipType, setMembership] = useState(client.membershipType || 3)
  const [startDate, setStartDate]   = useState(client.startDate || nextMondayDMY())
  const [monthlyFee, setMonthlyFee] = useState(client.monthlyFee ? String(client.monthlyFee) : '')
  const [thresholds, setThresholds] = useState(client.evaluationSettings || DEFAULT_THRESHOLDS)
  const [reportData, setReportData] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [saving, setSaving]         = useState(false)

  const loadReport = async () => {
    const [prs, attrs, measures, attendance] = await Promise.all([
      getPRs(client.id), getAttributes(client.id), getMeasurements(client.id), getAttendance(client.id)
    ])
    setReportData({ prs, attrs, measures })
    setAttendanceRecords(attendance)
    setView('report')
  }

  const loadAttendance = async () => {
    const records = await getAttendance(client.id)
    setAttendanceRecords(records)
    setView('attendance')
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
          ? <ProgressReport client={client} prs={reportData.prs} attributes={reportData.attrs} measurements={reportData.measures} attendance={attendanceRecords} />
          : <p style={{ color:'var(--text-3)', fontSize:14 }}>Loading…</p>}
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:16 }}>Close</button>
      </div>
    </div>
  )

  if (view === 'attendance') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxHeight:'95dvh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setView('menu')}><BackIcon /></button>
          <p style={{ fontWeight:700, fontSize:16 }}>{client.name} — Attendance</p>
        </div>
        <ClientAttendanceView
          client={{ ...client, membershipType, startDate }}
          records={attendanceRecords}
          onToggle={async (dateStr, isAttended) => {
            if (isAttended) {
              await unmarkAttended(client.id, dateStr)
              setAttendanceRecords(r => r.filter(x => x.date !== dateStr))
            } else {
              await markAttended(client.id, dateStr)
              setAttendanceRecords(r => [...r, { date: dateStr }])
            }
          }}
        />
        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:12 }}>Close</button>
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
          <label className="form-label">Membership</label>
          <div style={{ display:'flex', gap:8 }}>
            {[3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setMembership(n)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:14, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: membershipType === n ? 'var(--accent)' : 'transparent',
                  color:      membershipType === n ? '#fff' : 'var(--text-2)',
                  borderColor: membershipType === n ? 'var(--accent)' : 'var(--border-mid)' }}>
                {n}×/wk
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Start date</label>
          <input className="form-input" type="date" value={toHTMLDate(startDate)}
            onChange={e => setStartDate(fromHTMLDate(e.target.value))} />
          {client.originalStartDate && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>
              Originally joined: <strong>{client.originalStartDate}</strong> — updated on resume
            </p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Monthly fee (₹)</label>
          <input className="form-input" type="number" min="0" placeholder="e.g. 3000"
            value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
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
              await onEdit({ name: name.trim(), goal: goal.trim(), goalType, dob, notes: notes.trim(), membershipType, startDate, monthlyFee: monthlyFee ? Number(monthlyFee) : null })
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

  if (view === 'reactivate-confirm') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ textAlign:'center', padding:'12px 4px 20px' }}>
          <div style={{
            width:52, height:52, borderRadius:'50%',
            background:'var(--accent-light)',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 18px', color:'var(--accent)',
          }}>
            <PlayIcon />
          </div>
          <p className="modal-title" style={{ marginBottom:10 }}>Reactivate {client.name}?</p>
          <p style={{ fontSize:14, color:'var(--text-2)', lineHeight:1.65, marginBottom:8 }}>
            Their <strong>start date will be reset to today</strong><br/>({formatDMY(new Date())}).
          </p>
          <p style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
            Weekly and cycle attendance counts will recalculate from this date.
            {client.startDate && <> The previous start date ({client.startDate}) will be saved for reference.</>}
          </p>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button className="btn btn-outline btn-full" onClick={() => setView('menu')}>Go back</button>
          <button className="btn btn-primary btn-full" onClick={() => onStatusChange(client.id, 'active')}>
            Confirm & reactivate
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
          <button className="btn btn-outline btn-full" onClick={loadAttendance}>
            <CalendarIcon /> View attendance
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
            <button className="btn btn-outline btn-full" onClick={() => setView('reactivate-confirm')}
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
            <button className="btn btn-outline btn-full" onClick={() => setView('reactivate-confirm')}
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

// ── Per-client attendance mini-calendar ───────────────────────────────────────
function ClientAttendanceView({ client, records, onToggle }) {
  const today  = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year       = viewDate.getFullYear()
  const month      = viewDate.getMonth()
  const totalDays  = new Date(year, month + 1, 0).getDate()
  const firstDOW   = new Date(year, month, 1).getDay()
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthStr   = `${String(month + 1).padStart(2, '0')}-${year}`

  const attendedSet = new Set(records.filter(r => r.date?.slice(3) === monthStr).map(r => r.date))

  // Stats — 28-day cycle anchored to client's startDate
  const todayStr     = formatDMY(today)
  const cycleWindow  = client.startDate ? getMonthWindow(client.startDate, todayStr) : null
  const attended = cycleWindow
    ? records.filter(r => { const d = parseDMY(r.date); return d && d >= cycleWindow.windowStart && d <= cycleWindow.windowEnd }).length
    : attendedSet.size  // fallback: calendar month if no startDate
  const expected = (client.membershipType || 3) * 4
  const rate     = Math.min(100, Math.round((attended / expected) * 100))

  // Streak
  const getWeekStart = (d) => { const w = new Date(d); w.setDate(w.getDate() - w.getDay()); w.setHours(0,0,0,0); return w.getTime() }
  const weeksWithData = new Set(records.map(r => { const d = parseDMY(r.date); return d ? getWeekStart(d) : null }).filter(Boolean))
  let streak = 0, ws = getWeekStart(today)
  while (weeksWithData.has(ws)) { streak++; ws -= 7 * 86400000 }

  return (
    <>
      {/* Stats row */}
      <div style={{ display:'flex', gap:10, marginBottom:14 }}>
        <div style={{ flex:1, textAlign:'center', padding:'10px', background:'var(--bg)', borderRadius:'var(--r-sm)' }}>
          <p style={{ fontSize:22, fontWeight:700, color:'var(--teal)' }}>{attended}</p>
          <p style={{ fontSize:11, color:'var(--text-3)' }}>This cycle</p>
        </div>
        <div style={{ flex:1, textAlign:'center', padding:'10px', background:'var(--bg)', borderRadius:'var(--r-sm)' }}>
          <p style={{ fontSize:22, fontWeight:700, color: rate >= 85 ? 'var(--teal)' : rate >= 60 ? 'var(--amber)' : 'var(--coral)' }}>{rate}%</p>
          <p style={{ fontSize:11, color:'var(--text-3)' }}>Rate</p>
        </div>
        <div style={{ flex:1, textAlign:'center', padding:'10px', background:'var(--bg)', borderRadius:'var(--r-sm)' }}>
          <p style={{ fontSize:22, fontWeight:700, color:'var(--accent)' }}>{streak}</p>
          <p style={{ fontSize:11, color:'var(--text-3)' }}>Wk streak</p>
        </div>
      </div>

      {/* Month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevLeftIcon /></button>
        <p style={{ fontWeight:600, fontSize:14 }}>{monthLabel}</p>
        <button className="btn btn-ghost btn-icon" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevRightIcon /></button>
      </div>

      {/* Day-of-week header */}
      <div className="attendance-grid" style={{ marginBottom:3 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text-3)', padding:'2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar */}
      <div className="attendance-grid">
        {Array.from({ length: firstDOW }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day      = i + 1
          const cellDate = new Date(year, month, day)
          const dateStr  = formatDMY(cellDate)
          const isAtt    = attendedSet.has(dateStr)
          const isToday  = cellDate.toDateString() === today.toDateString()
          const isFuture = cellDate > today
          const startD   = parseDMY(client.startDate)
          const isBeforeStart = startD && cellDate < startD
          return (
            <div key={dateStr}
              className={`attendance-cell${isToday ? ' attendance-cell--today' : ''}${isFuture || isBeforeStart ? ' attendance-cell--future' : ''}${isAtt ? ' attendance-cell--has-data' : ''}`}
              onClick={() => !isFuture && !isBeforeStart && onToggle(dateStr, isAtt)}>
              <span className="attendance-cell-date" style={{ color: isAtt ? 'var(--teal)' : undefined, fontWeight: isAtt ? 700 : undefined }}>{day}</span>
              {isAtt && <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--teal)', flexShrink:0 }} />}
            </div>
          )
        })}
      </div>
    </>
  )
}

const ChevLeftIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
const ChevRightIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>

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
const BackIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const CalendarIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>

// ── Payment modal (unpaid → paid) ─────────────────────────────────────────────
function PaymentModal({ client, onConfirm, onClose }) {
  const [amount, setAmount]         = useState(client.monthlyFee ? String(client.monthlyFee) : '')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10)) // YYYY-MM-DD
  const [saving, setSaving]         = useState(false)

  // Recompute cycle from selected date
  const selectedDMY  = fromHTMLDate(paymentDate)   // DD-MM-YYYY
  const win          = (client.startDate && selectedDMY) ? getMonthWindow(client.startDate, selectedDMY) : null
  const cycleStart   = win ? formatDMY(win.windowStart) : null
  const cycleEnd     = win ? formatDMY(win.windowEnd)   : null

  // Is the selected date within the current (today's) cycle?
  const todayStr     = formatDMY(new Date())
  const currentWin   = client.startDate ? getMonthWindow(client.startDate, todayStr) : null
  const currentCycleStart = currentWin ? formatDMY(currentWin.windowStart) : null
  const isCurrentCycle = !!(cycleStart && cycleStart === currentCycleStart)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--accent-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', color:'var(--accent)' }}>
            <CoinIcon />
          </div>
          <p className="modal-title" style={{ marginBottom:4 }}>Record payment</p>
          <p style={{ fontSize:13, color:'var(--text-2)' }}>{client.name}</p>
        </div>
        <div className="form-group">
          <label className="form-label">Payment date</label>
          <input className="form-input" type="date" value={paymentDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setPaymentDate(e.target.value)} />
        </div>
        {cycleStart && cycleEnd && (
          <div style={{ background: isCurrentCycle ? 'var(--accent-light)' : '#FDF3DC', borderRadius:'var(--r-sm)', padding:'8px 12px', marginBottom:14, textAlign:'center' }}>
            <p style={{ fontSize:12, fontWeight:600, color: isCurrentCycle ? 'var(--accent-text)' : '#854F0B' }}>
              {isCurrentCycle ? 'Current cycle' : 'Past cycle — added to history only'}
            </p>
            <p style={{ fontSize:11, color: isCurrentCycle ? 'var(--accent-text)' : '#854F0B', marginTop:2 }}>
              {cycleStart} → {cycleEnd}
            </p>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Amount received (₹)</label>
          <input className="form-input" type="number" min="0" placeholder="e.g. 3000"
            value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-full"
            disabled={!amount || Number(amount) <= 0 || saving}
            onClick={async () => {
              setSaving(true)
              await onConfirm(Number(amount), selectedDMY, cycleStart, cycleEnd, isCurrentCycle)
              setSaving(false)
            }}>
            {saving ? 'Saving…' : isCurrentCycle ? 'Confirm payment' : 'Add to history'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Unpaid confirm modal (paid → unpaid) ──────────────────────────────────────
function UnpaidConfirmModal({ client, lastPayment, currentCycleStart, onConfirm, onClose }) {
  const [saving, setSaving] = useState(false)
  const isDifferentCycle = lastPayment && currentCycleStart && lastPayment.cycleStart !== currentCycleStart

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ textAlign:'center', padding:'8px 0 16px' }}>
          <div style={{ width:48, height:48, borderRadius:'50%', background:'#FDF3DC', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', color:'var(--amber)' }}>
            <WarningIcon />
          </div>
          <p className="modal-title" style={{ marginBottom:4 }}>Mark as unpaid?</p>
          <p style={{ fontSize:13, color:'var(--text-2)' }}>{client.name}</p>
        </div>
        {lastPayment ? (
          <div style={{ background:'var(--bg)', borderRadius:'var(--r-sm)', padding:'12px 14px', marginBottom:16 }}>
            <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6 }}>
              This will delete the payment of <strong>₹{lastPayment.amount?.toLocaleString('en-IN')}</strong> recorded on <strong>{lastPayment.date}</strong>
              {lastPayment.cycleStart && lastPayment.cycleEnd && (
                <> (Cycle: {lastPayment.cycleStart} → {lastPayment.cycleEnd})</>
              )}.
            </p>
            {isDifferentCycle && (
              <p style={{ fontSize:12, color:'var(--amber)', marginTop:8, fontWeight:600 }}>
                ⚠ This payment is from a different billing cycle. Deleting it will affect historical records.
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize:13, color:'var(--text-2)', textAlign:'center', marginBottom:16 }}>
            No payment record found. Status will be reverted to unpaid.
          </p>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline btn-full" onClick={onClose}>Keep paid</button>
          <button className="btn btn-full" disabled={saving}
            style={{ background:'var(--amber)', color:'#fff', border:'none', borderRadius:100, fontWeight:600, fontSize:15, padding:'12px 0', cursor:'pointer', opacity: saving ? 0.7 : 1 }}
            onClick={async () => { setSaving(true); await onConfirm(lastPayment?.id || null); setSaving(false) }}>
            {saving ? 'Removing…' : 'Mark unpaid'}
          </button>
        </div>
      </div>
    </div>
  )
}

const CoinIcon    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 1.5 1 2 2.5 2.5S15 13 15 14.5a2.5 2.5 0 0 1-5 0"/><line x1="12" y1="7" x2="12" y2="8.5"/><line x1="12" y1="15.5" x2="12" y2="17"/></svg>
const WarningIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
