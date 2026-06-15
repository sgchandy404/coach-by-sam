import { useState, useEffect } from 'react'
import { getClients, getAllClientsPayments } from '../lib/firestore.js'
import { getInitials, avatarColor, formatDMY, getMonthWindow } from '../lib/utils.js'
import PageLoader from '../components/PageLoader.jsx'

export default function RevenuePage() {
  const [clients, setClients]             = useState([])
  const [paymentsByClient, setPaymentsByClient] = useState({})
  const [loading, setLoading]             = useState(true)
  const [viewDate, setViewDate]           = useState(new Date())
  const [expanded, setExpanded]           = useState(null)

  useEffect(() => {
    const load = async () => {
      const all = await getClients()
      const active = all.filter(c => c.status === 'active')
      setClients(active)
      const results = await getAllClientsPayments(active.map(c => c.id))
      const map = {}
      results.forEach(({ clientId, payments }) => { map[clientId] = payments })
      setPaymentsByClient(map)
      setLoading(false)
    }
    load()
  }, [])

  const isClientPaid = (c) => {
    if (c.lastPaidCycleStart && c.startDate) {
      const todayStr = formatDMY(new Date())
      const win = getMonthWindow(c.startDate, todayStr)
      if (win) return c.lastPaidCycleStart === formatDMY(win.windowStart)
    }
    return false
  }

  const now      = new Date()
  const year     = viewDate.getFullYear()
  const month    = viewDate.getMonth()
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthStr = `${String(month + 1).padStart(2, '0')}-${year}`   // e.g. "06-2026"
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const expected = clients.reduce((sum, c) => sum + (c.monthlyFee || 0), 0)
  const missingFeeCount = clients.filter(c => !c.monthlyFee).length
  const collected = clients.reduce((sum, c) => {
    const payments = paymentsByClient[c.id] || []
    return sum + payments
      .filter(p => p.cycleStart && p.cycleStart.slice(3) === monthStr)
      .reduce((s, p) => s + (p.amount || 0), 0)
  }, 0)
  const outstanding = expected - collected   // negative = over-collected
  const rate = expected > 0 ? Math.min(100, Math.round((collected / expected) * 100)) : 0

  if (loading) return <PageLoader label="Loading revenue…" />

  return (
    <>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h1>Revenue</h1>
            <p>{monthLabel}</p>
          </div>
          <div style={{ display:'flex', gap:2 }}>
            <button className="btn btn-ghost btn-icon"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              <ChevLeftIcon />
            </button>
            <button className="btn btn-ghost btn-icon"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              disabled={isCurrentMonth}>
              <ChevRightIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        {/* Summary card */}
        <div style={{ background:'var(--surface)', borderRadius:16, border:'1px solid var(--border)', padding:'18px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', gap:0 }}>
            {[
              { label:'Expected',    value: expected,              color:'var(--text)' },
              { label:'Collected',   value: collected,             color:'var(--teal)' },
              { label:'Outstanding', value: Math.max(0,outstanding), color: outstanding > 0 ? 'var(--amber)' : 'var(--teal)' },
            ].map((stat, i, arr) => (
              <div key={stat.label} style={{ flex:1, textAlign:'center', position:'relative' }}>
                {i < arr.length - 1 && (
                  <div style={{ position:'absolute', right:0, top:'10%', height:'80%', width:1, background:'var(--border)' }} />
                )}
                <p style={{ fontSize:18, fontWeight:700, color:stat.color, fontFamily:'Playfair Display, serif', lineHeight:1.2 }}>
                  ₹{stat.value.toLocaleString('en-IN')}
                </p>
                <p style={{ fontSize:11, color:'var(--text-3)', fontWeight:500, marginTop:3, textTransform:'uppercase', letterSpacing:'0.6px' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Missing fee warning */}
          {missingFeeCount > 0 && (
            <p style={{ fontSize:12, color:'var(--amber)', marginTop:12, textAlign:'center' }}>
              {missingFeeCount} client{missingFeeCount > 1 ? 's' : ''} without a fee set — Expected may be incomplete
            </p>
          )}

          {/* Progress bar */}
          <div style={{ marginTop:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:'var(--text-3)' }}>Collection rate</span>
              <span style={{ fontSize:12, fontWeight:700, color: rate >= 85 ? 'var(--teal)' : rate >= 50 ? 'var(--amber)' : 'var(--coral)' }}>
                {rate}%
              </span>
            </div>
            <div style={{ height:6, background:'var(--bg)', borderRadius:100, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${rate}%`,
                background: rate >= 85 ? 'var(--teal)' : rate >= 50 ? 'var(--amber)' : 'var(--coral)',
                borderRadius:100, transition:'width 0.4s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Client list */}
        {clients.length === 0 ? (
          <div className="empty"><p>No active clients.</p></div>
        ) : (
          <div>
            {clients.map(c => {
              const payments       = paymentsByClient[c.id] || []
              const thisMonthPays  = payments.filter(p => p.date && p.date.slice(3) === monthStr)
              const clientCollected = thisMonthPays.reduce((s, p) => s + (p.amount || 0), 0)
              const paid           = isClientPaid(c)
              const isExpanded     = expanded === c.id
              const recentPayments = payments.slice(0, 6)

              return (
                <div key={c.id} style={{ background:'var(--surface)', borderRadius:16, border:'1px solid var(--border)', marginBottom:10, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}
                    onClick={() => setExpanded(isExpanded ? null : c.id)}>
                    <div style={{ width:42, height:42, borderRadius:'50%', background:avatarColor(c.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'white', flexShrink:0 }}>
                      {getInitials(c.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{c.name}</p>
                      <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        {c.monthlyFee ? `₹${c.monthlyFee.toLocaleString('en-IN')} / cycle` : 'No fee set'}
                      </p>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <div style={{ width:7, height:7, borderRadius:'50%', background: paid ? 'var(--teal)' : 'var(--amber)', animation: paid ? 'none' : 'unpaid-pulse 1.8s ease-in-out infinite' }} />
                        <span style={{ fontSize:12, fontWeight:600, color: paid ? 'var(--teal)' : 'var(--amber)' }}>
                          {paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      {clientCollected > 0 && (
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>
                          ₹{clientCollected.toLocaleString('en-IN')} this month
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:6 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'12px 16px', background:'var(--bg)' }}>
                      {recentPayments.length === 0 ? (
                        <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'8px 0' }}>
                          No payment history yet
                        </p>
                      ) : (
                        <>
                          <p style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>
                            Payment history
                          </p>
                          {recentPayments.map((p, idx) => (
                            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom: idx < recentPayments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <div>
                                <p style={{ fontSize:14, fontWeight:700, color:'var(--teal)' }}>
                                  ₹{p.amount?.toLocaleString('en-IN')}
                                </p>
                                {p.cycleStart && p.cycleEnd && (
                                  <p style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                                    Cycle: {p.cycleStart} → {p.cycleEnd}
                                  </p>
                                )}
                              </div>
                              <span style={{ fontSize:12, color:'var(--text-3)' }}>{p.date}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

const ChevLeftIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
const ChevRightIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
