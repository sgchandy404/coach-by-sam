import { useState, useEffect, useRef } from 'react'
import PageLoader from '../components/PageLoader.jsx'
import { getClients, getPRs, getAttributes, getMeasurements, getAttendance } from '../lib/firestore.js'
import { evaluateClient, SAM_LABELS, CLIENT_LABELS, GOAL_TYPES, STATUS, DEFAULT_THRESHOLDS } from '../lib/evaluate.js'
import { DEFAULT_MEASUREMENTS } from '../data/exercises.js'
import { getInitials, avatarColor, formatValue } from '../lib/utils.js'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function RankingsPage() {
  const [clients, setClients]   = useState([])
  const [selected, setSelected] = useState(null)
  const [data, setData]         = useState({})   // { clientId: { prs, attrs, measures } }
  const [evals, setEvals]       = useState({})   // { clientId: evaluateClient() result }
  const [loading, setLoading]   = useState(true)
  const [loadingClient, setLoadingClient] = useState(false)

  // Load all active clients + kick off evaluations
  useEffect(() => {
    getClients().then(async cs => {
      const active = cs.filter(c => c.status === 'active')
      setClients(active)
      // Load all data in parallel
      const results = await Promise.all(active.map(async c => {
        const [prs, attrs, measures, attendance] = await Promise.all([
          getPRs(c.id), getAttributes(c.id), getMeasurements(c.id), getAttendance(c.id)
        ])
        return { id: c.id, prs, attrs, measures, attendance }
      }))
      const dataMap = {}, evalMap = {}
      results.forEach(r => {
        const client = active.find(c => c.id === r.id)
        dataMap[r.id] = r
        evalMap[r.id] = evaluateClient(client, r.prs, r.attrs, r.measures, r.attendance)
      })
      setData(dataMap)
      setEvals(evalMap)
      setLoading(false)
    })
  }, [])

  const selectClient = (c) => setSelected(c)

  if (selected) return (
    <ClientDetail
      client={selected}
      clientData={data[selected.id] || { prs:[], attrs:[], measures:[] }}
      evaluation={evals[selected.id]}
      onBack={() => setSelected(null)}
    />
  )

  return (
    <>
      <div className="page-header">
        <h1>Rankings</h1>
        <p>Monthly progress evaluation</p>
      </div>

      {loading ? (
        <PageLoader label="Evaluating clients…" />
      ) : clients.length === 0 ? (
        <div className="empty"><p>No active clients yet.</p></div>
      ) : (
        <div className="section">
          <div className="card" style={{ padding:0 }}>
            {[...clients].sort((a,b) => a.name.localeCompare(b.name)).map(c => {
              const ev = evals[c.id]
              return (
                <div key={c.id} className="list-row"
                  style={{ padding:'14px 16px', cursor:'pointer' }}
                  onClick={() => selectClient(c)}>
                  <div className="avatar" style={{ background: avatarColor(c.name) }}>{getInitials(c.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:600, fontSize:15, marginBottom:5 }}>{c.name}</p>
                    {ev ? (
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                        <DimPill label="Perf"     status={ev.performance.status} />
                        <DimPill label="Physical" status={ev.physical.status} />
                        <DimPill label="Fitness"  status={ev.fitness.status} />
                        <DimPill label="Attendance" status={ev.attendance?.status} />
                      </div>
                    ) : <p style={{ fontSize:12, color:'var(--text-3)' }}>Evaluating…</p>}
                  </div>
                  <OverallDot status={ev?.overall} />
                  <ChevronIcon />
                </div>
              )
            })}
          </div>
          <p style={{ fontSize:11, color:'var(--text-3)', marginTop:10, textAlign:'center' }}>
            Tap a client to see their full breakdown
          </p>
        </div>
      )}
    </>
  )
}

// ── Client detail view ────────────────────────────────────────────────────────
function ClientDetail({ client, clientData, evaluation, onBack }) {
  const [clientView, setClientView] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const cardRef = useRef(null)

  const ev = evaluation
  const labels = clientView ? CLIENT_LABELS : SAM_LABELS
  const goalLabel = GOAL_TYPES.find(g => g.id === (client.goalType || 'general'))?.label || 'General fitness'

  return (
    <>
      <div className="page-header" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:18 }}>{client.name}</h1>
          <p>{goalLabel}</p>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ padding:'0 16px 12px', display:'flex', gap:8, alignItems:'center' }}>
        <button
          onClick={() => setClientView(false)}
          style={{ padding:'6px 14px', borderRadius:100, fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
            background: !clientView ? 'var(--accent)' : 'transparent',
            color:      !clientView ? '#fff' : 'var(--text-2)',
            borderColor: !clientView ? 'var(--accent)' : 'var(--border-mid)' }}>
          Sam's view
        </button>
        <button
          onClick={() => setClientView(true)}
          style={{ padding:'6px 14px', borderRadius:100, fontSize:13, fontWeight:600, cursor:'pointer', border:'1.5px solid',
            background: clientView ? 'var(--accent)' : 'transparent',
            color:      clientView ? '#fff' : 'var(--text-2)',
            borderColor: clientView ? 'var(--accent)' : 'var(--border-mid)' }}>
          Client view
        </button>
        {clientView && (
          <button className="btn btn-outline btn-sm" onClick={() => setShowReport(true)} style={{ marginLeft:'auto' }}>
            Share card
          </button>
        )}
      </div>

      {!ev ? (
        <div className="section"><p style={{ color:'var(--text-3)', fontSize:14 }}>Not enough data yet.</p></div>
      ) : (
        <>
          {/* Overall status */}
          <div className="section">
            <FullStatusCard
              label="Overall"
              status={ev.overall}
              labels={labels}
              large
            />
          </div>

          {/* Three dimensions */}
          <div className="section">
            <div className="section-title">Breakdown</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <DimensionCard title="Performance" icon="🏋️" dim={ev.performance}       labels={labels} isSam={!clientView} />
              <DimensionCard title="Physical"    icon="📏" dim={ev.physical}          labels={labels} isSam={!clientView} />
              <DimensionCard title="Fitness"     icon="⚡" dim={ev.fitness}            labels={labels} isSam={!clientView} />
              {ev.attendance && <DimensionCard title="Attendance" icon="📅" dim={ev.attendance} labels={labels} isSam={!clientView} />}
            </div>
          </div>
        </>
      )}

      {showReport && (
        <ShareableCard client={client} evaluation={ev} onClose={() => setShowReport(false)} />
      )}
    </>
  )
}

// ── Dimension detail card ─────────────────────────────────────────────────────
function DimensionCard({ title, icon, dim, labels, isSam }) {
  const [open, setOpen] = useState(false)
  const lbl = labels[dim.status] || labels.insufficient
  const MEASURE_LABELS = { weight:'Body weight', waist:'Waist', hips:'Hips', chest_bust:'Chest/bust', shoulders:'Shoulders', arms:'Arms', thighs:'Thighs', calves:'Calves' }

  return (
    <div className="card" style={{ padding:0 }}>
      <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize:20 }}>{icon}</span>
        <span style={{ flex:1, fontWeight:600, fontSize:15 }}>{title}</span>
        <StatusPill status={dim.status} labels={labels} />
        <span style={{ color:'var(--text-3)', fontSize:12, transform: open ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>▾</span>
      </div>
      {open && dim.details.length > 0 && (
        <div style={{ borderTop:'1px solid var(--border)' }}>
          {dim.details.map((d, i) => {
            const metricLabel = d.name || MEASURE_LABELS[d.field] || d.attr || d.field
            const lbl = labels[d.status] || labels.insufficient
            const delta = d.change != null ? `${d.change > 0 ? '+' : ''}${d.change}%`
                        : d.diff  != null ? `${d.diff  > 0 ? '+' : ''}${d.diff} pts`
                        : d.daysSince != null ? `${d.daysSince}d ago`
                        : d.rate  != null ? `${d.rate}%` : ''
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom: i < dim.details.length-1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ flex:1, fontSize:13, color:'var(--text-2)' }}>{metricLabel}</span>
                {isSam && delta ? <span style={{ fontSize:11, color:'var(--text-3)' }}>{delta}</span> : null}
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:lbl.bg, color:lbl.color, border:`1px solid ${lbl.border}`, whiteSpace:'nowrap' }}>
                  {lbl.text}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {open && dim.details.length === 0 && (
        <p style={{ padding:'10px 16px', fontSize:13, color:'var(--text-3)', borderTop:'1px solid var(--border)' }}>No data available for this period.</p>
      )}
    </div>
  )
}

// ── Shareable card ────────────────────────────────────────────────────────────
function ShareableCard({ client, evaluation, onClose }) {
  const ev = evaluation
  const dims = [
    { title:'Performance', status: ev?.performance?.status },
    { title:'Physical',    status: ev?.physical?.status    },
    { title:'Fitness',     status: ev?.fitness?.status     },
    { title:'Attendance',  status: ev?.attendance?.status  },
  ].filter(d => d.status && d.status !== STATUS.INSUFFICIENT)

  const goalLabel = GOAL_TYPES.find(g => g.id === (client.goalType || 'general'))?.label || 'General fitness'
  const overall   = CLIENT_LABELS[ev?.overall] || CLIENT_LABELS.insufficient
  const month     = new Date().toLocaleString('default', { month:'long', year:'numeric' })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Client progress card</p>
        <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
          Screenshot this card to share with {client.name}.
        </p>

        {/* The card itself */}
        <div style={{
          background:'var(--surface)', border:'1.5px solid var(--border)',
          borderRadius:'var(--r-lg)', padding:'20px', marginBottom:16,
          boxShadow:'0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <div className="avatar" style={{ background: avatarColor(client.name), width:44, height:44, fontSize:16 }}>
              {getInitials(client.name)}
            </div>
            <div>
              <p style={{ fontWeight:700, fontSize:16 }}>{client.name}</p>
              <p style={{ fontSize:12, color:'var(--text-3)' }}>{month} · {goalLabel}</p>
            </div>
          </div>

          {/* Overall */}
          <div style={{
            background: overall.bg, border:`1.5px solid ${overall.border}`,
            borderRadius:'var(--r-sm)', padding:'12px 16px', marginBottom:14,
            textAlign:'center',
          }}>
            <p style={{ fontSize:11, color: overall.color, fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:2 }}>Overall progress</p>
            <p style={{ fontSize:22, fontWeight:700, color: overall.color }}>{overall.text}</p>
          </div>

          {/* Dimensions */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {dims.map(d => {
              const lbl = CLIENT_LABELS[d.status] || CLIENT_LABELS.insufficient
              return (
                <div key={d.title} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg)', borderRadius:'var(--r-sm)' }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{d.title}</span>
                  <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:100, background:lbl.bg, color:lbl.color, border:`1px solid ${lbl.border}` }}>
                    {lbl.text}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <p style={{ fontSize:10, color:'var(--text-3)', textAlign:'center', marginTop:14 }}>
            Coach by Sam · Progress is a journey 💪
          </p>
        </div>

        <button className="btn btn-outline btn-full" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

// ── Small UI atoms ─────────────────────────────────────────────────────────────
function StatusPill({ status, labels }) {
  const lbl = labels[status] || labels.insufficient
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, background:lbl.bg, color:lbl.color, border:`1px solid ${lbl.border}`, whiteSpace:'nowrap' }}>
      {lbl.text}
    </span>
  )
}

function FullStatusCard({ label, status, labels, large }) {
  const lbl = labels[status] || labels.insufficient
  return (
    <div style={{ background:lbl.bg, border:`1.5px solid ${lbl.border}`, borderRadius:'var(--r-md)', padding: large ? '16px' : '10px 14px', textAlign:'center' }}>
      <p style={{ fontSize:11, color:lbl.color, fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:4 }}>{label}</p>
      <p style={{ fontSize: large ? 24 : 16, fontWeight:700, color:lbl.color }}>{lbl.text}</p>
    </div>
  )
}

function DimPill({ label, status }) {
  const lbl = SAM_LABELS[status] || SAM_LABELS.insufficient
  return (
    <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:100, background:lbl.bg, color:lbl.color, border:`1px solid ${lbl.border}` }}>
      {label}: {lbl.text}
    </span>
  )
}

function OverallDot({ status }) {
  const colors = {
    improving:'#5C7A4E', stagnant:'#A8720A', declining:'#B84C2A',
    needs_attention:'#7A3218', insufficient:'#C4B8A8'
  }
  return <div style={{ width:10, height:10, borderRadius:'50%', background: colors[status] || colors.insufficient, flexShrink:0 }} />
}

const BackIcon    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
const ChevronIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
