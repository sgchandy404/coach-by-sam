import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase.js'
import {
  getClients, addClient, updateClient, deleteClientFull,
  getPRs, getAttributes, getMeasurements, getAttendance,
  markAttended, unmarkAttended,
  addPayment, getPayments, deletePayment,
  recomputeClientPaymentFields, recomputeClassCycleFields, startNextCycle,
  getBillingPeriods, addBillingPeriod, closeBillingPeriod, updateBillingPeriod,
} from '../lib/firestore.js'
import {
  getInitials, avatarColor, parseDMY, formatDMY,
  toHTMLDate, fromHTMLDate, nextMondayDMY, getMonthWindow,
  getCycleWindow, getPaymentStatus, formatINR, getClassCycleInfo,
  dmy2display, display2dmy,
} from '../lib/utils.js'
import { GOAL_TYPES, DEFAULT_THRESHOLDS } from '../lib/evaluate.js'
import ProgressReport from '../components/ProgressReport.jsx'
import PageLoader from '../components/PageLoader.jsx'

const statusPill = {
  active:      null,
  paused:      { label:'Paused',      bg:'#FDF3DC', color:'#7A5200', border:'#E8C97A' },
  deactivated: { label:'Deactivated', bg:'#FAEAE4', color:'#6B2410', border:'#E8A88A' },
}

const getCycleInfo = (c) => {
  if (c.cycleType === 'classes') {
    const perCycle = c.classesPerCycle || 10
    const attended = c.attendedThisCycle || 0
    return { progress: perCycle > 0 ? Math.min(0.97, attended / perCycle) : 0, daysLeft: null, classesMode: true, attendedThisCycle: attended, classesPerCycle: perCycle }
  }
  const anchor = c.billingStartDate || c.startDate
  if (!anchor) return { progress: 0, daysLeft: null, classesMode: false }
  const todayStr = formatDMY(new Date())
  const win = getMonthWindow(anchor, todayStr)
  if (!win) return { progress: 0, daysLeft: null, classesMode: false }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const elapsed  = Math.floor((today - win.windowStart) / 86400000)
  const daysLeft = Math.floor((win.windowEnd  - today)  / 86400000)
  return { progress: Math.min(0.97, elapsed / 27), daysLeft, classesMode: false }
}

function AvatarArc({ name, size = 52, pStatus, progress, daysLeft }) {
  const pad = 6
  const svgSize = size + pad * 2
  const cx = svgSize / 2
  const r  = size / 2 + 2
  const circ = 2 * Math.PI * r
  const paid   = pStatus === 'paid'
  const urgent = (pStatus === 'overdue') || (pStatus === 'unpaid' && daysLeft !== null && daysLeft <= 3)
  const arcColor = paid ? 'var(--teal)' : urgent ? '#B84C2A' : '#A8720A'
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:'50%',
        background:avatarColor(name),
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:size * 0.3, fontWeight:700, color:'white',
        fontFamily:'DM Sans, sans-serif',
      }}>{getInitials(name)}</div>
      <svg width={svgSize} height={svgSize}
        style={{ position:'absolute', top:-pad, left:-pad, transform:'rotate(-90deg)', pointerEvents:'none' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={arcColor} strokeWidth={2.5}
          strokeDasharray={`${circ * progress} ${circ}`}
          strokeLinecap="round" />
      </svg>
    </div>
  )
}

const PAYMENT_STATUS_STYLE = {
  paid:    { color: '#5C7A4E', label: 'Paid',    pulse: false },
  partial: { color: '#A8720A', label: 'Partial', pulse: false },
  overdue: { color: '#B84C2A', label: 'Overdue', pulse: true  },
  unpaid:  { color: '#C4633A', label: 'Unpaid',  pulse: true  },
}

export default function ClientsPage({ clientId, setClientId, setTab, navResetKey }) {
  const [clients, setClients]       = useState([])
  const [tab, setLocalTab]          = useState('active')
  const [filter, setFilter]         = useState('all')
  const [showAdd, setShowAdd]       = useState(false)
  const [managing, setManaging]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [paymentModal, setPaymentModal] = useState(null) // { client }
  const [profile, setProfile]           = useState(null) // selected client for full-screen view
  const [toast, setToast]               = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const load = async () => {
    const cs = await getClients()
    setClients(cs)
    setProfile(prev => prev ? (cs.find(c => c.id === prev.id) || prev) : null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // When the Clients nav item is tapped, navResetKey increments — return to list view
  useEffect(() => { if (navResetKey > 0) setProfile(null) }, [navResetKey])

  const handleStatusChange = async (id, newStatus) => {
    const updates = { status: newStatus }
    if (newStatus === 'active') {
      const client = clients.find(c => c.id === id)
      const newStart = formatDMY(new Date())
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

  const visible = clients.filter(c => {
    if (tab === 'active') return c.status === 'active'
    if (tab === 'paused') return c.status === 'paused' || c.status === 'deactivated'
    return true
  }).filter(c => {
    if (filter === 'unpaid') {
      const s = getPaymentStatus(c)
      return s === 'unpaid' || s === 'overdue' || s === 'partial'
    }
    return true
  })

  const activeClients  = clients.filter(c => c.status === 'active')
  const overdueCount   = visible.filter(c => getPaymentStatus(c) === 'overdue').length
  const unpaidCount    = activeClients.filter(c => {
    const s = getPaymentStatus(c)
    return s === 'unpaid' || s === 'overdue' || s === 'partial'
  }).length

  if (profile !== null) {
    return (
      <>
        {toast && <div className="toast">{toast}</div>}
        <ClientProfile
          client={profile}
          onBack={() => setProfile(null)}
          onManage={() => setManaging(profile)}
          onEdit={() => setManaging({ ...profile, _initialView: 'edit' })}
          onPayment={(c) => setPaymentModal({ client: c })}
        />
        {managing && (
          <ManageClientModal client={managing} onClose={() => setManaging(null)}
            initialView={managing._initialView || 'menu'}
            onStatusChange={handleStatusChange} onDelete={handleDelete}
            onToast={showToast}
            onEdit={async (data) => {
              await updateClient(managing.id, data)
              const refreshed = await getClients()
              setClients(refreshed)
              const updated = refreshed.find(c => c.id === managing.id)
              if (updated) setProfile(updated)
              setManaging(null)
            }} />
        )}
        {paymentModal && (
          <PaymentModal
            client={paymentModal.client}
            onClose={() => setPaymentModal(null)}
            onClientUpdated={(updated) => {
              setClients(cs => cs.map(x => x.id === updated.id ? updated : x))
              setProfile(updated)
              setPaymentModal({ client: updated })
              showToast('Payment recorded ✓')
            }}
          />
        )}
      </>
    )
  }

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      <div className="page-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1>Clients</h1>
          <p>{activeClients.length} active{unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ''}</p>
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
            { value: activeClients.length, label: 'Active', color: 'var(--accent)' },
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
            {overdueCount > 0 && (
              <div style={{ margin:'0 0 12px', padding:'10px 14px', background:'#FAEAE4', borderRadius:12, border:'1px solid #F0C4B4', fontSize:13, color:'#B84C2A', fontWeight:500 }}>
                {overdueCount} client{overdueCount > 1 ? 's are' : ' is'} overdue — 14+ days into their cycle without a payment.
              </div>
            )}
            {visible.map(c => {
              const pStatus = getPaymentStatus(c)
              const pStyle  = PAYMENT_STATUS_STYLE[pStatus]
              const pill    = statusPill[c.status]
              const { progress, daysLeft } = getCycleInfo(c)
              return (
                <div
                  key={c.id}
                  onClick={() => setProfile(c)}
                  style={{
                    background: profile?.id === c.id ? 'var(--accent-light)' : 'var(--surface)',
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
                    {/* Avatar with cycle arc */}
                    <AvatarArc name={c.name} pStatus={pStatus} progress={progress} daysLeft={daysLeft} />

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

                    {/* Payment dot + dots menu */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setPaymentModal({ client: c }) }}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: pStyle.color,
                          animation: pStyle.pulse ? 'unpaid-pulse 1.8s ease-in-out infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: pStyle.color }}>
                          {pStyle.label}
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
          onSave={async (data) => {
            const ref = await addClient(data)
            await addBillingPeriod(ref.id, {
              startDate:       data.startDate,
              endDate:         null,
              cycleType:       data.cycleType,
              membershipType:  data.cycleType === 'time' ? data.membershipType : null,
              classesPerCycle: data.cycleType === 'classes' ? data.classesPerCycle : null,
              billingType:     data.billingType,
              monthlyFee:      data.monthlyFee ?? null,
              sessionRate:     data.sessionRate ?? null,
              label:           null,
            })
            await load(); setShowAdd(false)
          }} />
      )}
      {managing && (
        <ManageClientModal client={managing} onClose={() => setManaging(null)}
          onStatusChange={handleStatusChange} onDelete={handleDelete}
          onToast={showToast}
          onEdit={async (data) => { await updateClient(managing.id, data); await load(); setManaging(null) }} />
      )}
      {paymentModal && (
        <PaymentModal
          client={paymentModal.client}
          onClose={() => setPaymentModal(null)}
          onClientUpdated={(updated) => {
            setClients(cs => cs.map(x => x.id === updated.id ? updated : x))
            // keep modal open so Sam sees updated status — update client in modal too
            setPaymentModal({ client: updated })
          }}
        />
      )}
    </>
  )
}

// ── Billing period helpers ────────────────────────────────────────────────────
function syntheticPeriod(client) {
  return { id: '__synthetic__', startDate: client.startDate, endDate: null,
    cycleType: client.cycleType, membershipType: client.membershipType,
    classesPerCycle: client.classesPerCycle, billingType: client.billingType,
    monthlyFee: client.monthlyFee, sessionRate: client.sessionRate, label: null }
}

function paymentsForPeriod(payments, period) {
  const explicit = payments.filter(p => p.billingPeriodId && p.billingPeriodId === period.id)
  if (explicit.length > 0) return explicit
  const start = parseDMY(period.startDate)
  const end   = period.endDate ? parseDMY(period.endDate) : null
  return payments.filter(p => {
    const d = parseDMY(p.date)
    return d && start && d >= start && (!end || d < end)
  })
}

function periodPickerLabel(period) {
  const fmt = dmy => parseDMY(dmy)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '?'
  const fee = period.billingType === 'monthly'
    ? formatINR(period.monthlyFee ?? 0)
    : `${formatINR(period.sessionRate ?? 0)}/class`
  return `${fmt(period.startDate)} – ${period.endDate ? fmt(period.endDate) : 'onwards'} · ${fee}`
}

function periodLabel(period) {
  const type = period.cycleType === 'classes' ? 'Classes' : 'Monthly'
  const freq = period.cycleType === 'classes'
    ? `${period.classesPerCycle ?? '?'}/cycle`
    : `${period.membershipType ?? '?'}×/wk`
  const fmt = dmy => parseDMY(dmy)?.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) ?? '?'
  const dateRange = `${fmt(period.startDate)} – ${period.endDate ? fmt(period.endDate) : 'onwards'}`
  const fee = period.billingType === 'monthly'
    ? formatINR(period.monthlyFee ?? 0)
    : `${formatINR(period.sessionRate ?? 0)}/class`
  return `${type} · ${freq} · ${dateRange} · ${fee}`
}

// ── Client profile (full-screen in-tab view) ──────────────────────────────────
function ClientProfile({ client: initialClient, onBack, onManage, onEdit, onPayment }) {
  const [client, setClientLocal]     = useState(initialClient)
  const [payments, setPayments]      = useState([])
  const [attendance, setAttendance]  = useState([])
  const [fetching, setFetching]      = useState(true)
  const [nextCycleDate, setNextCycleDate] = useState(null)  // null = UI hidden
  const [startingCycle, setStartingCycle] = useState(false)
  const [deletingPayment, setDeletingPayment] = useState(null)
  const [billingPeriods, setBillingPeriods] = useState([])

  const handleDeletePayment = async (p) => {
    if (!window.confirm(`Delete payment of ${formatINR(p.amount)} on ${p.date}?`)) return
    setDeletingPayment(p.id)
    const isClasses  = client.cycleType === 'classes'
    const isSessions = client.billingType === 'per_session'
    const cycleFee   = isClasses && isSessions
      ? (client.classesPerCycle || 1) * (client.sessionRate || 0)
      : (client.monthlyFee || 0)
    await deletePayment(client.id, p.id)
    await recomputeClientPaymentFields(client.id, cycleFee, client.billingStartDate || client.startDate)
    setPayments(ps => ps.filter(x => x.id !== p.id))
    setDeletingPayment(null)
  }

  useEffect(() => {
    setFetching(true)
    Promise.all([getPayments(client.id), getAttendance(client.id), getBillingPeriods(client.id)]).then(([pays, atts, periods]) => {
      setPayments(pays); setAttendance(atts); setBillingPeriods(periods); setFetching(false)

      // Silent balance recompute: if billing periods exist, compute expected balance
      // and trigger recompute if stored value is stale.
      if (periods.length === 0) return
      const activePeriod = [...periods].reverse().find(p => !p.endDate) || periods[periods.length - 1]
      const pfp = (period) => {
        const s = parseDMY(period.startDate)
        const e = period.endDate ? parseDMY(period.endDate) : null
        return pays.filter(p => p.billingPeriodId ? p.billingPeriodId === period.id
          : (() => { const d = parseDMY(p.date); return d && s && d >= s && (!e || d < e) })())
      }
      const openingBalance = activePeriod.openingBalance ?? activePeriod.carryForwardAmount ?? 0
      const activePaid = pfp(activePeriod).reduce((s, p) => s + (p.amount || 0), 0)
      const activeFee  = activePeriod.billingType === 'monthly'
        ? (activePeriod.monthlyFee || 0)
        : (activePeriod.classesPerCycle || 0) * (activePeriod.sessionRate || 0)
      const expectedBalance = activePaid - (activeFee + openingBalance)
      if (expectedBalance !== (client.balance ?? 0) || openingBalance !== (client.openingBalance ?? client.carryForwardAmount ?? 0)) {
        recomputeClientPaymentFields(client.id, activeFee, activePeriod.startDate)
          .then(() => getClients())
          .then(cs => {
            const updated = cs.find(c => c.id === client.id)
            if (updated) { setClientLocal(updated); onEdit && onEdit(updated) }
          })
      }
    })
  }, [client.id, client.billingStartDate])

  useEffect(() => { setClientLocal(initialClient) }, [initialClient])

  const today    = new Date()
  const todayStr = formatDMY(today)
  const msPerDay = 86400000
  const isClasses = client.cycleType === 'classes'

  // Time-based cycle info
  const anchor   = client.billingStartDate || client.startDate
  const anchorDate = anchor ? parseDMY(anchor) : null
  const isFutureStart = anchorDate && anchorDate > today
  const cycleWin = !isClasses && anchor && !isFutureStart ? getMonthWindow(anchor, todayStr) : null
  const elapsed  = cycleWin ? Math.min(28, Math.floor((today - cycleWin.windowStart) / msPerDay) + 1) : 0
  const remaining = cycleWin ? Math.max(0, 28 - elapsed) : 0

  // Classes-based cycle info
  const classInfo = isClasses ? getClassCycleInfo(client, attendance) : null

  const pStatus  = getPaymentStatus(client)
  const pStyle   = PAYMENT_STATUS_STYLE[pStatus]
  const lastPay  = payments[0] || null
  const isSessions = client.billingType === 'per_session'
  const isUnpaid = ['unpaid', 'overdue', 'partial'].includes(pStatus)
  const fee = isClasses && isSessions
    ? (client.classesPerCycle || 0) * (client.sessionRate || 0)
    : (client.monthlyFee || 0)
  const storedBalance = client.balance ?? null
  // balance=0 or null on an unpaid client means it was never properly computed — fall back to fee
  const balance = ((storedBalance === 0 || storedBalance === null) && isUnpaid && fee > 0) ? -fee : storedBalance
  const displayBalance = (isClasses && isSessions && balance != null)
    ? balance + ((client.classesPerCycle ?? 0) - (client.attendedThisCycle ?? 0)) * (client.sessionRate ?? 0)
    : balance

  const classCycleStart = isClasses ? (parseDMY(client.currentCycleStartDate) || parseDMY(client.startDate)) : null
  const cycleRecords = isClasses
    ? attendance.filter(r => { const d = parseDMY(r.date); return d && classCycleStart && d >= classCycleStart })
    : cycleWin
      ? attendance.filter(r => { const d = parseDMY(r.date); return d && d >= cycleWin.windowStart && d <= cycleWin.windowEnd })
      : []
  const attended  = isClasses ? (classInfo?.attendedThisCycle ?? 0) : cycleRecords.length
  const expected  = isClasses ? (client.classesPerCycle || 10) : (client.membershipType || 3) * 4
  const rate      = expected > 0 ? Math.round((attended / expected) * 100) : 0
  const rateColor = rate >= 85 ? 'var(--teal)' : rate >= 60 ? 'var(--amber)' : 'var(--coral)'
  const barColor  = pStatus === 'paid' ? 'var(--teal)' : pStatus === 'overdue' ? '#B84C2A' : 'var(--amber)'

  const fmtDisplay = (dmy) => {
    const d = parseDMY(dmy); if (!d) return dmy
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const attendedDates = new Set(attendance.map(r => r.date))
  const cycleStart = cycleWin?.windowStart || null

  return (
    <div style={{ paddingBottom: 84 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 16px 12px' }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack}><BackIcon /></button>
        <p style={{ fontWeight:700, fontSize:17, flex:1, textAlign:'center', color:'var(--text)' }}>{client.name}</p>
        <button className="btn btn-ghost btn-icon" onClick={onManage} style={{ color:'var(--text-3)' }}><DotsIcon /></button>
      </div>

      {fetching ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-3)', fontSize:13 }}>Loading…</div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:12 }}>

          {/* Cycle card */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p className="section-title" style={{ marginBottom:0 }}>
                {isClasses ? `Cycle ${(classInfo?.cycleIndex ?? 0) + 1}` : 'Current cycle'}
              </p>
              {!isClasses && cycleWin && (
                <span style={{ fontSize:11, color:'var(--text-3)' }}>
                  {client.membershipType ? `${client.membershipType}×/wk · ` : ''}{attended}/{expected} · {remaining}d left
                </span>
              )}
              {isClasses && !classInfo?.cycleComplete && <span style={{ fontSize:11, color:'var(--text-3)' }}>{attended} of {expected} classes</span>}
            </div>
            {isClasses ? (
              classInfo?.cycleComplete ? (
                <div>
                  <div style={{ height:6, borderRadius:100, background:'var(--bg)', overflow:'hidden', marginBottom:10 }}>
                    <div style={{ height:'100%', width:'100%', background:'var(--teal)', borderRadius:100 }} />
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:'var(--teal)', marginBottom:10 }}>
                    All {expected} classes done — cycle complete!
                  </p>
                  {nextCycleDate === null ? (
                    <button className="btn btn-primary btn-full" onClick={() => setNextCycleDate(todayStr)}>
                      Start next cycle
                    </button>
                  ) : (
                    <div>
                      <p className="form-label" style={{ marginBottom:6 }}>Next cycle starts</p>
                      <DatePickerInput value={nextCycleDate} onChange={setNextCycleDate} />
                      <div style={{ display:'flex', gap:8, marginTop:10 }}>
                        <button className="btn btn-outline" style={{ flex:1 }} onClick={() => setNextCycleDate(null)}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" style={{ flex:1 }} disabled={startingCycle}
                          onClick={async () => {
                            setStartingCycle(true)
                            await startNextCycle(client.id, client, nextCycleDate)
                            const updated = { ...client, currentCycleIndex: (client.currentCycleIndex ?? 0) + 1, currentCycleStartDate: nextCycleDate, attendedThisCycle: 0 }
                            setClientLocal(updated)
                            setNextCycleDate(null)
                            setStartingCycle(false)
                          }}>
                          {startingCycle ? 'Starting…' : 'Confirm'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height:6, borderRadius:100, background:'var(--bg)', overflow:'hidden', marginTop:4 }}>
                  <div style={{ height:'100%', width:`${Math.min(97, (attended / expected) * 100)}%`, background:barColor, borderRadius:100, transition:'width 0.4s' }} />
                </div>
              )
            ) : isFutureStart ? (
              <p style={{ fontSize:14, fontWeight:600, color:'var(--text-2)' }}>
                Starts {fmtDisplay(anchor)}
              </p>
            ) : cycleWin ? (
              <>
                <p style={{ fontSize:14, fontWeight:600, color:'var(--text)', marginBottom:10 }}>
                  {fmtDisplay(formatDMY(cycleWin.windowStart))} – {fmtDisplay(formatDMY(cycleWin.windowEnd))}
                </p>
                <div style={{ height:6, borderRadius:100, background:'var(--bg)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(97, (elapsed/28)*100)}%`, background:barColor, borderRadius:100, transition:'width 0.4s' }} />
                </div>
              </>
            ) : (
              <p style={{ fontSize:13, color:'var(--text-3)' }}>No start date set.</p>
            )}
          </div>

          {/* Payment card */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: displayBalance != null && displayBalance !== 0 ? 6 : 10 }}>
              <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:100,
                background: pStyle.color + '22', color: pStyle.color, border:`1px solid ${pStyle.color}55` }}>
                {pStyle.label}
              </span>
            </div>
            {displayBalance != null && displayBalance !== 0 && (
              <p style={{ fontSize:26, fontWeight:700, color: displayBalance >= 0 ? 'var(--teal)' : 'var(--coral)', marginBottom:10, letterSpacing:'-0.5px' }}>
                {displayBalance >= 0 ? `+${formatINR(displayBalance)}` : `−${formatINR(Math.abs(displayBalance))}`}
              </p>
            )}
            <button className="btn btn-primary btn-full" onClick={() => onPayment(client)}>
              Record payment
            </button>
          </div>

          {/* Payment history card */}
          <div className="card">
            <p className="section-title" style={{ marginBottom:10 }}>Payment history</p>
            {payments.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-3)' }}>No payments recorded.</p>
            ) : (
              <div>
                {payments.map((p, idx) => (
                  <div key={p.id} style={{ display:'flex', alignItems:'flex-start', gap:8,
                    padding:'10px 0', borderBottom: idx < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, fontSize:15, color:'var(--teal)' }}>{formatINR(p.amount)}</p>
                      <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{p.date}</p>
                      {p.cycleStart && p.cycleEnd && (
                        <p style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>Cycle: {p.cycleStart} → {p.cycleEnd}</p>
                      )}
                      {p.note && (
                        <p style={{ fontSize:12, color:'var(--text-2)', marginTop:3, fontStyle:'italic' }}>{p.note}</p>
                      )}
                    </div>
                    <button
                      disabled={deletingPayment === p.id}
                      onClick={() => handleDeletePayment(p)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', padding:'2px 4px', flexShrink:0, opacity: deletingPayment === p.id ? 0.4 : 1 }}>
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Billing history card */}
          {(() => {
            const periods = billingPeriods.length > 0 ? billingPeriods : [syntheticPeriod(client)]
            const memberSince = client.originalStartDate || client.startDate
            return (
              <div className="card">
                <p className="section-title" style={{ marginBottom:10 }}>Billing history</p>
                {memberSince && (
                  <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>
                    Member since: {parseDMY(memberSince)?.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) ?? memberSince}
                  </p>
                )}
                {periods.map((period, pi) => {
                  const pps = paymentsForPeriod(payments, period)
                  return (
                    <div key={period.id} style={{ marginBottom: pi < periods.length - 1 ? 16 : 0 }}>
                      <div style={{ borderLeft:'3px solid var(--accent)', paddingLeft:10, marginBottom:8, paddingTop:4, paddingBottom:4 }}>
                        <p style={{ fontSize:12, fontWeight:600, color:'var(--text)', lineHeight:1.5 }}>{periodLabel(period)}</p>
                      </div>
                      {(period.openingBalance > 0 || period.carryForwardAmount > 0) && (
                        <div style={{ paddingLeft:13, marginBottom:6 }}>
                          <span style={{ fontSize:12, color:'var(--amber-text)', fontStyle:'italic' }}>
                            Opening balance: {formatINR(period.openingBalance ?? period.carryForwardAmount)}
                          </span>
                        </div>
                      )}
                      {pps.length === 0 ? (
                        <p style={{ fontSize:12, color:'var(--text-3)', paddingLeft:13 }}>No payments in this period.</p>
                      ) : null}
                      {period.debtResolution && (
                        <p style={{ fontSize:12, fontStyle:'italic', paddingLeft:13, marginTop: pps.length === 0 ? 2 : 4,
                          color: period.debtResolution.type === 'written_off' ? 'var(--text-3)' : 'var(--amber-text)' }}>
                          {period.debtResolution.type === 'written_off'
                            ? `Written off on ${period.debtResolution.on}`
                            : `Carried forward on ${period.debtResolution.on}`}
                        </p>
                      )}
                      {pps.length > 0 && pps.map(p => (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:6, paddingLeft:13, marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--teal)' }}>{formatINR(p.amount)}</span>
                          <span style={{ fontSize:12, color:'var(--text-3)' }}>on {p.date}</span>
                          <span style={{ fontSize:12, color:'var(--teal)' }}>✓</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Attendance card */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <p className="section-title" style={{ marginBottom:0 }}>This cycle</p>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{attended} / {expected}</span>
            </div>
            <div style={{ height:5, borderRadius:100, background:'var(--bg)', overflow:'hidden', marginBottom:4 }}>
              <div style={{ height:'100%', width:`${Math.min(100, rate)}%`, background:rateColor, borderRadius:100 }} />
            </div>
            <p style={{ fontSize:11, color:rateColor, fontWeight:600, marginBottom:14 }}>{rate}% attendance rate</p>
          </div>

          <button className="btn btn-outline btn-full" onClick={onEdit} style={{ marginTop:4 }}>
            <EditIcon /> Edit profile
          </button>
        </div>
      )}
    </div>
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
  const [billingType, setBillingType] = useState('monthly')
  const [monthlyFee, setMonthlyFee]   = useState('')
  const [sessionRate, setSessionRate] = useState('')
  const [cycleType, setCycleType]     = useState('time')
  const [classesPerCycle, setClassesPerCycle] = useState('')
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
        {/* Cycle type */}
        <div className="form-group">
          <label className="form-label">Cycle type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['time','Time-based (28 days)'],['classes','Classes-based']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setCycleType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: cycleType === val ? 'var(--accent)' : 'transparent',
                  color:      cycleType === val ? '#fff' : 'var(--text-2)',
                  borderColor: cycleType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {cycleType === 'time' ? (
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
        ) : (
          <div className="form-group">
            <label className="form-label">Classes per cycle</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 10"
              value={classesPerCycle} onChange={e => setClassesPerCycle(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Cycle start date</label>
          <DatePickerInput value={startDate} onChange={setStartDate} />
          <p style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>Defaults to next Monday</p>
        </div>

        {/* Billing type */}
        <div className="form-group">
          <label className="form-label">Billing type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['monthly','Monthly fee'],['per_session','Per session']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setBillingType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: billingType === val ? 'var(--accent)' : 'transparent',
                  color:      billingType === val ? '#fff' : 'var(--text-2)',
                  borderColor: billingType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {billingType === 'monthly' && (
          <div className="form-group">
            <label className="form-label">Monthly fee (₹)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 5000"
              value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
          </div>
        )}
        {billingType === 'per_session' && (
          <div className="form-group">
            <label className="form-label">Session rate (₹)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 1500"
              value={sessionRate} onChange={e => setSessionRate(e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY"
            value={dmy2display(dob)} onChange={e => setDob(display2dmy(e.target.value))} />
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
              await onSave({
                name: name.trim(), goal: goal.trim(), goalType, dob,
                notes: notes.trim(), membershipType, startDate,
                billingStartDate: startDate,
                cycleType,
                classesPerCycle: cycleType === 'classes' ? (Number(classesPerCycle) || 10) : null,
                attendedThisCycle: 0, currentCycleIndex: 0,
                billingType,
                monthlyFee: billingType === 'monthly' ? (Number(monthlyFee) || null) : null,
                sessionRate: billingType === 'per_session' ? (Number(sessionRate) || null) : null,
                balance: 0, lastPaidCycleStart: null, lastPaidCycleEnd: null,
                paymentStatus: 'unpaid', status: 'active',
              })
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
function ManageClientModal({ client, onClose, onStatusChange, onDelete, onEdit, onToast, initialView = 'menu' }) {
  const [view, setView]             = useState(initialView)
  const [name, setName]             = useState(client.name)
  const [goal, setGoal]             = useState(client.goal || '')
  const [goalType, setGoalType]     = useState(client.goalType || 'general')
  const [dob, setDob]               = useState(client.dob || '')
  const [notes, setNotes]           = useState(client.notes || '')
  const [membershipType, setMembership] = useState(client.membershipType || 3)
  const [startDate, setStartDate]   = useState(client.startDate || nextMondayDMY())
  const [billingType, setBillingType] = useState(client.billingType || 'monthly')
  const [monthlyFee, setMonthlyFee] = useState(client.monthlyFee ? String(client.monthlyFee) : '')
  const [sessionRate, setSessionRate] = useState(client.sessionRate ? String(client.sessionRate) : '')
  const [cycleType, setCycleType]     = useState(client.cycleType || 'time')
  const [classesPerCycle, setClassesPerCycle] = useState(client.classesPerCycle ? String(client.classesPerCycle) : '')
  const [thresholds, setThresholds] = useState(client.evaluationSettings || DEFAULT_THRESHOLDS)
  const [reportData, setReportData] = useState(null)
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [saving, setSaving]         = useState(false)
  const [newPeriodStart, setNewPeriodStart] = useState(formatDMY(new Date()))
  const [debtConfirmed, setDebtConfirmed] = useState(null) // null | true | false
  const [outstanding, setOutstanding] = useState(0)

  // When entering change-billing view, compute outstanding from actual billing periods + payments
  useEffect(() => {
    if (view !== 'change-billing') return
    Promise.all([getBillingPeriods(client.id), getPayments(client.id)]).then(([periods, pays]) => {
      if (periods.length === 0) {
        // No periods — fall back to client.balance
        const isClasses  = client.cycleType === 'classes'
        const isSessions = client.billingType === 'per_session'
        if (isClasses && isSessions) {
          const totalPaid     = (client.balance ?? 0) + (client.classesPerCycle ?? 0) * (client.sessionRate ?? 0)
          const attendedValue = (client.attendedThisCycle ?? 0) * (client.sessionRate ?? 0)
          setOutstanding(Math.max(0, attendedValue - totalPaid))
        } else {
          setOutstanding(Math.max(0, -(client.balance ?? 0)))
        }
        return
      }
      const activePeriod = [...periods].reverse().find(p => !p.endDate) || periods[periods.length - 1]
      const pfp = (period) => {
        const s = parseDMY(period.startDate)
        const e = period.endDate ? parseDMY(period.endDate) : null
        return pays.filter(p => p.billingPeriodId ? p.billingPeriodId === period.id
          : (() => { const d = parseDMY(p.date); return d && s && d >= s && (!e || d < e) })())
      }
      const activeFee = activePeriod.billingType === 'monthly'
        ? (activePeriod.monthlyFee || 0)
        : (activePeriod.classesPerCycle || 0) * (activePeriod.sessionRate || 0)
      const activePaid = pfp(activePeriod).reduce((s, p) => s + (p.amount || 0), 0)
      setOutstanding(Math.max(0, activeFee - activePaid))
    })
  }, [view, client.id])

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
              const updated = attendanceRecords.filter(x => x.date !== dateStr)
              setAttendanceRecords(updated)
              if (client.cycleType === 'classes') await recomputeClassCycleFields(client.id, client)
            } else {
              await markAttended(client.id, dateStr)
              const updated = [...attendanceRecords, { date: dateStr }]
              setAttendanceRecords(updated)
              if (client.cycleType === 'classes') await recomputeClassCycleFields(client.id, client)
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
        {/* Cycle type */}
        <div className="form-group">
          <label className="form-label">Cycle type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['time','Time-based (28 days)'],['classes','Classes-based']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setCycleType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: cycleType === val ? 'var(--accent)' : 'transparent',
                  color:      cycleType === val ? '#fff' : 'var(--text-2)',
                  borderColor: cycleType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {cycleType === 'time' ? (
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
        ) : (
          <div className="form-group">
            <label className="form-label">Classes per cycle</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 10"
              value={classesPerCycle} onChange={e => setClassesPerCycle(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Cycle start date</label>
          <DatePickerInput value={startDate} onChange={setStartDate} />
          {client.originalStartDate && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:5 }}>
              Originally joined: <strong>{client.originalStartDate}</strong> — updated on resume
            </p>
          )}
        </div>

        {/* Billing fields */}
        <div className="form-group">
          <label className="form-label">Billing type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['monthly','Monthly fee'],['per_session','Per session']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setBillingType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: billingType === val ? 'var(--accent)' : 'transparent',
                  color:      billingType === val ? '#fff' : 'var(--text-2)',
                  borderColor: billingType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {billingType === 'monthly' && (
          <div className="form-group">
            <label className="form-label">Monthly fee (₹)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 5000"
              value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
          </div>
        )}
        {billingType === 'per_session' && (
          <div className="form-group">
            <label className="form-label">Session rate (₹)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 1500"
              value={sessionRate} onChange={e => setSessionRate(e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Date of birth</label>
          <input className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY"
            value={dmy2display(dob)} onChange={e => setDob(display2dmy(e.target.value))} />
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
              const newFee = billingType === 'monthly' ? (Number(monthlyFee) || null) : null
              await onEdit({
                name: name.trim(), goal: goal.trim(), goalType, dob,
                notes: notes.trim(), membershipType, startDate,
                billingStartDate: startDate,
                cycleType,
                classesPerCycle: cycleType === 'classes' ? (Number(classesPerCycle) || 10) : null,
                billingType,
                monthlyFee: newFee,
                sessionRate: billingType === 'per_session' ? (Number(sessionRate) || null) : null,
              })
              await recomputeClientPaymentFields(client.id, newFee || 0, client.billingStartDate || client.startDate)
              onToast?.('Profile updated ✓')
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )

  if (view === 'change-billing') return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => setView('menu')}><BackIcon /></button>
          <p style={{ fontWeight:700, fontSize:16 }}>Change billing — {client.name}</p>
        </div>
        <div className="form-group">
          <label className="form-label">Cycle type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['time','Time-based (28 days)'],['classes','Classes-based']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setCycleType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: cycleType === val ? 'var(--accent)' : 'transparent',
                  color:      cycleType === val ? '#fff' : 'var(--text-2)',
                  borderColor: cycleType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {cycleType === 'time' ? (
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
        ) : (
          <div className="form-group">
            <label className="form-label">Classes per cycle</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 10"
              value={classesPerCycle} onChange={e => setClassesPerCycle(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Billing type</label>
          <div style={{ display:'flex', gap:8 }}>
            {[['monthly', cycleType === 'classes' ? 'Per cycle' : 'Monthly fee'],['per_session','Per session']].map(([val, lbl]) => (
              <button key={val} type="button" onClick={() => setBillingType(val)}
                style={{ flex:1, padding:'9px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: billingType === val ? 'var(--accent)' : 'transparent',
                  color:      billingType === val ? '#fff' : 'var(--text-2)',
                  borderColor: billingType === val ? 'var(--accent)' : 'var(--border-mid)' }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        {billingType === 'monthly' && (
          <div className="form-group">
            <label className="form-label">{cycleType === 'classes' ? 'Per cycle fee (₹)' : 'Monthly fee (₹)'}</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 5000"
              value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
          </div>
        )}
        {billingType === 'per_session' && (
          <div className="form-group">
            <label className="form-label">Session rate (₹)</label>
            <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 1500"
              value={sessionRate} onChange={e => setSessionRate(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">New period starts on
            <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, color:'var(--text-3)', marginLeft:6 }}>
              — current period closes on this date
            </span>
          </label>
          <DatePickerInput value={newPeriodStart} onChange={setNewPeriodStart} />
        </div>

        {/* Outstanding debt question — shown when current period has unpaid balance */}
        {outstanding > 0 && (
          <div style={{ background:'var(--amber-light)', border:'1px solid #FAC775', borderRadius:'var(--r-sm)', padding:'12px 14px', marginTop:4 }}>
            <p style={{ fontSize:13, fontWeight:600, color:'var(--amber-text)', marginBottom:4 }}>
              Does this client still owe {formatINR(outstanding)} from their current period?
            </p>
            <p style={{ fontSize:12, color:'var(--amber-text)', marginBottom:10, lineHeight:1.5 }}>
              {client.cycleType === 'classes'
                ? `${client.attendedThisCycle ?? 0} of ${client.classesPerCycle ?? 0} classes attended this cycle.`
                : `This amount was not paid before the billing change.`}
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <button type="button"
                style={{ flex:1, padding:'8px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: debtConfirmed === true ? 'var(--accent)' : 'transparent',
                  color:      debtConfirmed === true ? '#fff' : 'var(--amber-text)',
                  borderColor: debtConfirmed === true ? 'var(--accent)' : '#FAC775' }}
                onClick={() => setDebtConfirmed(true)}>
                Yes, still owing
              </button>
              <button type="button"
                style={{ flex:1, padding:'8px 0', borderRadius:'var(--r-sm)', fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
                  background: debtConfirmed === false ? 'var(--teal)' : 'transparent',
                  color:      debtConfirmed === false ? '#fff' : 'var(--text-2)',
                  borderColor: debtConfirmed === false ? 'var(--teal)' : 'var(--border-mid)' }}
                onClick={() => setDebtConfirmed(false)}>
                No, write off
              </button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-outline btn-full" onClick={() => setView('menu')}>Back</button>
          <button className="btn btn-primary btn-full"
            disabled={saving || (outstanding > 0 && debtConfirmed === null)}
            onClick={async () => {
              setSaving(true)
              const newCycleType   = cycleType
              const newMembership  = newCycleType === 'time' ? membershipType : null
              const newClasses     = newCycleType === 'classes' ? (Number(classesPerCycle) || 10) : null
              const newBillingType = billingType
              const newMonthlyFee  = newBillingType === 'monthly' ? (Number(monthlyFee) || null) : null
              const newSessionRate = newBillingType === 'per_session' ? (Number(sessionRate) || null) : null
              const newCycleFee    = newBillingType === 'per_session' && newClasses
                ? newClasses * (newSessionRate || 0)
                : (newMonthlyFee || 0)
              const openingBal = debtConfirmed === true ? outstanding : 0
              const periods  = await getBillingPeriods(client.id)
              const active   = periods.find(p => !p.endDate)
              const newPeriodData = {
                cycleType: newCycleType, membershipType: newMembership,
                classesPerCycle: newClasses, billingType: newBillingType,
                monthlyFee: newMonthlyFee, sessionRate: newSessionRate,
                openingBalance: openingBal, label: null,
              }
              const resolutionDate = formatDMY(new Date())
              if (active && active.startDate === newPeriodStart) {
                // Same-day change — update the active period in place instead of closing + reopening
                await updateBillingPeriod(client.id, active.id, newPeriodData)
              } else {
                if (active) {
                  await closeBillingPeriod(client.id, active.id, newPeriodStart)
                  // Stamp debt resolution on the now-closed period if there was outstanding
                  if (outstanding > 0) {
                    await updateBillingPeriod(client.id, active.id, {
                      debtResolution: {
                        type: debtConfirmed ? 'carried_forward' : 'written_off',
                        on: resolutionDate,
                      }
                    })
                  }
                } else {
                  // No billingPeriods yet — write the implicit current period before closing it
                  const implicitStart = client.billingStartDate || client.startDate
                  // Skip if same day — would produce a zero-length period
                  if (implicitStart && implicitStart !== newPeriodStart) {
                    await addBillingPeriod(client.id, {
                      startDate: implicitStart, endDate: newPeriodStart,
                      cycleType: client.cycleType, membershipType: client.membershipType,
                      classesPerCycle: client.classesPerCycle, billingType: client.billingType,
                      monthlyFee: client.monthlyFee, sessionRate: client.sessionRate,
                      openingBalance: 0, label: null,
                    })
                  }
                }
                await addBillingPeriod(client.id, {
                  startDate: newPeriodStart, endDate: null, ...newPeriodData,
                })
              }
              await onEdit({
                cycleType: newCycleType, membershipType: newMembership,
                classesPerCycle: newClasses, billingType: newBillingType,
                monthlyFee: newMonthlyFee, sessionRate: newSessionRate,
                billingStartDate: newPeriodStart, startDate: newPeriodStart,
                openingBalance: openingBal,
                ...(newCycleType === 'classes' ? {
                  currentCycleStartDate: newPeriodStart,
                  currentCycleIndex: 0,
                  attendedThisCycle: 0,
                } : {
                  currentCycleStartDate: null,
                  currentCycleIndex: null,
                  attendedThisCycle: null,
                }),
              })
              await recomputeClientPaymentFields(client.id, newCycleFee, newPeriodStart)
              onToast?.('Billing updated ✓')
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Save & start new period'}
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
          <button className="btn btn-outline btn-full" onClick={() => setView('change-billing')}>
            <BillingIcon /> Change billing
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
    : attendedSet.size
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

// ── Payment modal (3-view: menu / pay / history) ───────────────────────────────
function PaymentModal({ client: initialClient, onClose, onClientUpdated }) {
  const [client, setClient] = useState(initialClient)
  const [view, setView]     = useState('menu')

  // Keep client in sync when parent updates it
  useEffect(() => { setClient(initialClient) }, [initialClient])

  const anchorDate = client.billingStartDate || client.startDate
  const todayStr   = formatDMY(new Date())
  const cycle      = anchorDate ? getCycleWindow(anchorDate, todayStr) : null
  const pStatus    = getPaymentStatus(client)
  const pStyle     = PAYMENT_STATUS_STYLE[pStatus]

  // Format a DD-MM-YYYY date as "DD Mon YYYY"
  const formatDisplay = (dmy) => {
    if (!dmy) return ''
    const d = parseDMY(dmy)
    if (!d) return dmy
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const refreshClient = async () => {
    const all = await getClients()
    const updated = all.find(c => c.id === client.id) || client
    setClient(updated)
    onClientUpdated(updated)
  }

  if (view === 'pay') return (
    <PayView
      client={client}
      onBack={() => setView('menu')}
      onClose={onClose}
      onSaved={async () => { await refreshClient(); setView('menu') }}
    />
  )

  if (view === 'history') return (
    <HistoryView
      client={client}
      onBack={() => setView('menu')}
      onClose={onClose}
      onChanged={async () => { await refreshClient() }}
    />
  )

  // menu view
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)', lineHeight:1 }}>×</button>

        {/* Avatar + name */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginBottom:18, paddingTop:8 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:avatarColor(client.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'white' }}>
            {getInitials(client.name)}
          </div>
          <p style={{ fontWeight:700, fontSize:17, color:'var(--text)' }}>{client.name}</p>
          {/* Status badge */}
          <span style={{ fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:100, background: pStyle.color + '22', color: pStyle.color, border: `1px solid ${pStyle.color}55` }}>
            {pStyle.label}
          </span>
        </div>

        {/* Cycle dates — time-based only */}
        {cycle && client.cycleType !== 'classes' && (
          <div style={{ textAlign:'center', marginBottom:10 }}>
            <p style={{ fontSize:13, color:'var(--text-2)' }}>
              Cycle: <strong>{formatDisplay(cycle.cycleStart)} – {formatDisplay(cycle.cycleEnd)}</strong>
            </p>
          </div>
        )}

        {/* Balance — show when non-zero, or when client is unpaid with balance=0 (stale) */}
        {(() => {
          const isClassesPay = client.cycleType === 'classes'
          const isSessionsPay = client.billingType === 'per_session'
          const fee = isClassesPay && isSessionsPay
            ? (client.classesPerCycle || 0) * (client.sessionRate || 0)
            : (client.monthlyFee || 0)
          const storedBalance = client.balance ?? null
          const isUnpaid = ['unpaid', 'overdue', 'partial'].includes(pStatus)
          // balance=0 or null on an unpaid client means it was never properly computed — fall back to fee
const rawBalance = ((storedBalance === 0 || storedBalance === null) && isUnpaid && fee > 0) ? -fee : storedBalance
          const db = isClassesPay && isSessionsPay && rawBalance != null
            ? rawBalance + ((client.classesPerCycle ?? 0) - (client.attendedThisCycle ?? 0)) * (client.sessionRate ?? 0)
            : rawBalance
          if (db == null || db === 0) return null
          return (
            <div style={{ textAlign:'center', marginBottom:18 }}>
              <p style={{ fontSize:14, fontWeight:600, color: db >= 0 ? 'var(--teal)' : 'var(--coral)' }}>
                {db > 0 ? `+${formatINR(db)}` : `−${formatINR(Math.abs(db))}`}
              </p>
            </div>
          )
        })()}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button className="btn btn-primary btn-full" onClick={() => setView('pay')}>
            Record payment
          </button>
          <button className="btn btn-outline btn-full" onClick={() => setView('history')}>
            View history
          </button>
        </div>
      </div>
    </div>
  )
}

function PayView({ client, onBack, onClose, onSaved }) {
  const isSessions  = client.billingType === 'per_session'
  const isClasses   = client.cycleType === 'classes'
  const unitLabel   = isClasses ? 'class' : 'session'

  const fullFee = isClasses && isSessions
    ? (client.classesPerCycle || 1) * (client.sessionRate || 0)
    : (client.monthlyFee || 0)
  const rawBalance = client.balance ?? 0
  // For per-session classes, default to what's actually owed now (attended × rate − paid),
  // not the full cycle fee which inflates the suggested amount.
  const displayBalance = isClasses && isSessions
    ? rawBalance + ((client.classesPerCycle ?? 0) - (client.attendedThisCycle ?? 0)) * (client.sessionRate ?? 0)
    : rawBalance
  const defaultAmount = displayBalance < 0
    ? String(Math.abs(displayBalance))
    : String(isClasses && isSessions ? (client.sessionRate || '') : (fullFee || ''))

  const [sessions, setSessions]         = useState('')
  const [amount, setAmount]             = useState(defaultAmount)
  const [paymentDate, setPaymentDate]   = useState(formatDMY(new Date()))
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [billingPeriods, setBillingPeriods] = useState([])
  const [selectedPeriodId, setSelectedPeriodId] = useState(null)

  useEffect(() => {
    Promise.all([getBillingPeriods(client.id), getPayments(client.id)]).then(([periods, pmts]) => {
      // Only show periods that are unpaid or partially paid
      const unpaid = periods.filter(period => {
        const fee = period.billingType === 'monthly'
          ? (period.monthlyFee || 0)
          : (period.classesPerCycle || 0) * (period.sessionRate || 0)
        if (!fee) return true // per_session open-ended: always show
        const paid = pmts
          .filter(p => p.billingPeriodId ? p.billingPeriodId === period.id : (() => {
            const d = parseDMY(p.date), s = parseDMY(period.startDate), e = period.endDate ? parseDMY(period.endDate) : null
            return d && s && d >= s && (!e || d < e)
          })())
          .reduce((s, p) => s + (p.amount || 0), 0)
        return paid < fee
      })
      const list = unpaid.length > 0 ? unpaid : periods.slice(-1) // fallback: show latest
      setBillingPeriods(list)
      const active = [...list].reverse().find(p => !p.endDate) || list[list.length - 1]
      setSelectedPeriodId(active?.id ?? null)
    })
  }, [client.id])

  const numSessions = Number(sessions) || 0
  const numAmount   = Number(amount) || 0
  const unitRate    = client.sessionRate || 0
  const cycleFee    = client.billingType === 'per_session'
    ? (client.classesPerCycle || 0) * (client.sessionRate || 0)
    : (client.monthlyFee || 0)
  const isPartial   = cycleFee > 0 && numAmount > 0 && numAmount < cycleFee

  const handleSave = async () => {
    setSaving(true)
    // Duplicate check — same date + same amount
    const existing = await getPayments(client.id)
    const dup = existing.find(p => p.date === paymentDate && p.amount === numAmount)
    if (dup) {
      const ok = window.confirm(`A payment of ${formatINR(numAmount)} on ${paymentDate} already exists. Record anyway?`)
      if (!ok) { setSaving(false); return }
    }
    const anchorDate = client.billingStartDate || client.startDate
    const cycleWindow = client.cycleType !== 'classes' && anchorDate ? getCycleWindow(anchorDate, paymentDate) : null
    await addPayment(client.id, {
      amount: numAmount,
      date: paymentDate,
      cycleStart:      cycleWindow?.cycleStart ?? null,
      cycleEnd:        cycleWindow?.cycleEnd   ?? null,
      cycleIndex:      isClasses ? (client.currentCycleIndex ?? 0) : null,
      sessions:        isSessions && !isClasses ? (numSessions || null) : null,
      note:            note.trim() || null,
      billingPeriodId: selectedPeriodId ?? null,
    })
    const cycleFee = isClasses && isSessions
      ? (client.classesPerCycle || 1) * (client.sessionRate || 0)
      : (client.monthlyFee || 0)
    await recomputeClientPaymentFields(client.id, cycleFee, client.billingStartDate || client.startDate)
    await onSaved()
    setSaving(false)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={onBack}><BackIcon /></button>
          <p style={{ fontWeight:700, fontSize:16 }}>Record payment</p>
        </div>

        {isSessions && !isClasses && (
          <div className="form-group">
            <label className="form-label">Sessions</label>
            <input className="form-input" type="text" inputMode="numeric"
              placeholder="Number of sessions"
              value={sessions} onChange={e => {
                setSessions(e.target.value)
                const n = Number(e.target.value)
                if (n > 0 && unitRate > 0) setAmount(String(n * unitRate))
              }} />
            {unitRate > 0 && numSessions > 0 && (
              <p style={{ fontSize:11, color:'var(--text-3)', marginTop:3 }}>
                {numSessions} session{numSessions > 1 ? 's' : ''} × {formatINR(unitRate)} = {formatINR(numSessions * unitRate)}
              </p>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Amount received (₹)</label>
          <input className="form-input" type="text" inputMode="numeric" placeholder="e.g. 5000"
            value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        {isPartial && (
          <p style={{ fontSize:12, color:'var(--amber)', fontWeight:500, marginBottom:12 }}>
            This will be recorded as a partial payment
          </p>
        )}

        <div className="form-group">
          <label className="form-label">Date received</label>
          <DatePickerInput value={paymentDate} onChange={setPaymentDate} />
        </div>

        {billingPeriods.length > 1 && (
          <div className="form-group">
            <label className="form-label">Billing period</label>
            <select className="form-input" value={selectedPeriodId || ''} onChange={e => setSelectedPeriodId(e.target.value)}>
              {[...billingPeriods].reverse().map(p => (
                <option key={p.id} value={p.id}>{periodPickerLabel(p)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Note (optional)</label>
          <input className="form-input" placeholder="e.g. Cash, bank transfer" value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <div style={{ display:'flex', gap:10, marginTop:4 }}>
          <button className="btn btn-outline btn-full" onClick={onBack}>Back</button>
          <button className="btn btn-primary btn-full"
            disabled={!numAmount || numAmount <= 0 || saving}
            onClick={handleSave}>
            {saving ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryView({ client, onBack, onClose, onChanged }) {
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    getPayments(client.id).then(p => { setPayments(p); setLoading(false) })
  }, [client.id])

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete payment of ${formatINR(p.amount)} on ${p.date}?`)) return
    setDeleting(p.id)
    await deletePayment(client.id, p.id)
    const isClasses  = client.cycleType === 'classes'
    const isSessions = client.billingType === 'per_session'
    const cycleFee   = isClasses && isSessions
      ? (client.classesPerCycle || 1) * (client.sessionRate || 0)
      : (client.monthlyFee || 0)
    await recomputeClientPaymentFields(client.id, cycleFee, client.billingStartDate || client.startDate)
    setPayments(ps => ps.filter(x => x.id !== p.id))
    setDeleting(null)
    onChanged()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxHeight:'95dvh' }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
          <button className="btn btn-ghost btn-icon" onClick={onBack}><BackIcon /></button>
          <p style={{ fontWeight:700, fontSize:16 }}>Payment history</p>
        </div>

        {loading ? (
          <p style={{ color:'var(--text-3)', fontSize:14, textAlign:'center', padding:'16px 0' }}>Loading…</p>
        ) : payments.length === 0 ? (
          <p style={{ color:'var(--text-3)', fontSize:14, textAlign:'center', padding:'24px 0' }}>No payments recorded yet.</p>
        ) : (
          <div>
            {payments.map((p, idx) => (
              <div key={p.id} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 0', borderBottom: idx < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, fontSize:15, color:'var(--teal)' }}>{formatINR(p.amount)}</p>
                  <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{p.date}</p>
                  {p.cycleStart && p.cycleEnd && (
                    <p style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                      Cycle: {p.cycleStart} → {p.cycleEnd}
                    </p>
                  )}
                  {p.note && (
                    <p style={{ fontSize:12, color:'var(--text-2)', marginTop:3, fontStyle:'italic' }}>{p.note}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={deleting === p.id}
                  className="btn btn-ghost btn-icon"
                  style={{ color:'var(--coral)', flexShrink:0, marginLeft:8 }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:12 }}>Close</button>
      </div>
    </div>
  )
}

// ── Inline date picker — matches attendance calendar style ────────────────────
function DatePickerInput({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseDMY(value) || new Date())
  const selected  = parseDMY(value)
  const today     = new Date(); today.setHours(0, 0, 0, 0)
  const year      = viewDate.getFullYear()
  const month     = viewDate.getMonth()
  const firstDOW  = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <input className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY"
          value={dmy2display(value)}
          onChange={e => onChange(display2dmy(e.target.value))}
          onFocus={() => { setViewDate(parseDMY(value) || new Date()); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ paddingRight:36 }} />
        <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-3)' }}>
          <CalendarIcon />
        </span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, width:272, zIndex:200,
          background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12,
          boxShadow:'0 8px 24px rgba(0,0,0,0.12)', padding:'12px' }}
          onMouseDown={e => e.preventDefault()}>
          {/* Month nav — same as ClientAttendanceView */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <button className="btn btn-ghost btn-icon" type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevLeftIcon /></button>
            <p style={{ fontWeight:600, fontSize:14 }}>{monthLabel}</p>
            <button className="btn btn-ghost btn-icon" type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevRightIcon /></button>
          </div>
          {/* Day-of-week header */}
          <div className="attendance-grid" style={{ marginBottom:3 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text-3)', padding:'2px 0' }}>{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="attendance-grid">
            {Array.from({ length: firstDOW }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const cellDate = new Date(year, month, day); cellDate.setHours(0, 0, 0, 0)
              const isSel   = selected && cellDate.getTime() === selected.getTime()
              const isToday = cellDate.getTime() === today.getTime()
              return (
                <div key={day}
                  className={`attendance-cell${isToday ? ' attendance-cell--today' : ''}`}
                  style={{ background: isSel ? 'var(--accent)' : undefined, borderColor: isSel ? 'var(--accent)' : undefined }}
                  onClick={() => { onChange(formatDMY(cellDate)); setOpen(false) }}>
                  <span className="attendance-cell-date" style={{ color: isSel ? '#fff' : undefined, fontWeight: isSel ? 700 : undefined }}>{day}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const ChevLeftIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
const ChevRightIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>

const DotsIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/></svg>
const AlertIcon   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
const EditIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
const ChartIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
const SlidersIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
const BillingIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
const PauseIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
const PlayIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const ArchiveIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
const TrashIcon   = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const BackIcon     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const CalendarIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
