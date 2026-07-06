import { useState, useEffect } from 'react'
import { getClients, getAllClientsPayments, deletePayment, recomputeClientPaymentFields } from '../lib/firestore.js'
import { getInitials, avatarColor, formatINR } from '../lib/utils.js'
import PageLoader from '../components/PageLoader.jsx'
import * as XLSX from 'xlsx'

export default function RevenuePage() {
  const [clients, setClients]         = useState([])
  const [payments, setPayments]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [viewDate, setViewDate]       = useState(new Date())
  const [expanded, setExpanded]       = useState(null)
  const [toast, setToast]             = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500) }

  const now            = new Date()
  const year           = viewDate.getFullYear()
  const month          = viewDate.getMonth()
  const monthLabel     = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthStr       = `${String(month + 1).padStart(2, '0')}-${year}` // "06-2026"
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const load = async () => {
    setLoading(true)
    const all    = await getClients()
    const active = all.filter(c => c.status === 'active' || c.status === 'paused')
    setClients(active)
    const ids = active.map(c => c.id)
    const [paymentResults] = await Promise.all([
      getAllClientsPayments(ids),
    ])
    const flat = []
    paymentResults.forEach(({ clientId, payments: ps }) => {
      const c = active.find(x => x.id === clientId)
      ps.forEach(p => flat.push({ ...p, clientId, clientName: c?.name || '', clientFee: c?.monthlyFee || 0 }))
    })
    setPayments(flat)
    setLoading(false)
  }

  useEffect(() => { load() }, [viewDate])

  // Cash basis: attribute payment to the month it was received
  const monthPayments = payments.filter(p => p.date && p.date.slice(3) === monthStr)

  const collected = monthPayments.reduce((s, p) => s + (p.amount || 0), 0)

  // Group month payments by client
  const grouped = {}
  monthPayments.forEach(p => {
    if (!grouped[p.clientId]) grouped[p.clientId] = []
    grouped[p.clientId].push(p)
  })

  const handleDelete = async (p) => {
    if (!window.confirm(`Delete payment of ${formatINR(p.amount)} on ${p.date}?`)) return
    await deletePayment(p.clientId, p.id)
    const c = clients.find(x => x.id === p.clientId)
    await recomputeClientPaymentFields(p.clientId, c?.monthlyFee || 0)
    setPayments(ps => ps.filter(x => x.id !== p.id || x.clientId !== p.clientId))
    showToast('Payment deleted')
  }

  const exportToExcel = () => {
    const makeRow = c => {
      const clientCollected = monthPayments
        .filter(p => p.clientId === c.id)
        .reduce((s, p) => s + (p.amount || 0), 0)
      return {
        'Name':           c.name,
        'Billing Type':   c.billingType === 'per_session' ? 'Per Session' : 'Monthly',
        'Collected (₹)':  clientCollected,
      }
    }

    const active = clients.filter(c => c.status === 'active').map(makeRow)
    const paused = clients.filter(c => c.status === 'paused').map(makeRow)

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(active), 'Active')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paused), 'Paused')
    XLSX.writeFile(wb, `Revenue_${monthLabel.replace(' ', '_')}.xlsx`)
  }

  if (loading) return <PageLoader label="Loading revenue…" />

  return (
    <>
      {toast && <div className="toast">{toast}</div>}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h1 style={{ fontFamily:'Playfair Display, serif' }}>{monthLabel}</h1>
          <div style={{ display:'flex', gap:2, alignItems:'center' }}>
            <button className="btn btn-ghost btn-icon" title="Export to Excel" onClick={exportToExcel}>
              <ExportIcon />
            </button>
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
        {/* Summary band */}
        <div style={{ background:'var(--surface)', borderRadius:16, border:'1px solid var(--border)', padding:'18px 20px', marginBottom:16, textAlign:'center' }}>
          <p style={{ fontSize:22, fontWeight:700, color:'var(--teal)', fontFamily:'Playfair Display, serif', lineHeight:1.2 }}>
            {formatINR(collected)}
          </p>
          <p style={{ fontSize:10, color:'var(--text-3)', fontWeight:500, marginTop:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Collected
          </p>
        </div>

        {/* Payment rows grouped by client */}
        {monthPayments.length === 0 ? (
          <div className="empty">
            <p>No payments recorded for {monthLabel}.</p>
          </div>
        ) : (
          <div>
            {Object.entries(grouped).map(([clientId, cPayments]) => {
              const c = clients.find(x => x.id === clientId) || { name: cPayments[0]?.clientName || 'Unknown', id: clientId }
              const isOpen = expanded === clientId
              const clientTotal = cPayments.reduce((s, p) => s + (p.amount || 0), 0)
              return (
                <div key={clientId} style={{ background:'var(--surface)', borderRadius:16, border:'1px solid var(--border)', marginBottom:10, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
                  {/* Client header — tap to expand */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', cursor:'pointer' }}
                    onClick={() => setExpanded(isOpen ? null : clientId)}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:avatarColor(c.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'white', flexShrink:0 }}>
                      {getInitials(c.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <p style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{c.name}</p>
                        {c.status === 'paused' && (
                          <span style={{ fontSize:10, fontWeight:600, color:'var(--amber)', background:'#FFF3D6', borderRadius:6, padding:'2px 6px', lineHeight:1.4, flexShrink:0 }}>Paused</span>
                        )}
                      </div>
                      <p style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>
                        {cPayments.length} payment{cPayments.length > 1 ? 's' : ''} · {formatINR(clientTotal)}
                      </p>
                    </div>
                    {isOpen ? <ChevUpIcon /> : <ChevDownIcon />}
                  </div>

                  {/* Payment rows — only when expanded */}
                  {isOpen && (
                    <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
                      {cPayments.map((p, idx) => (
                        <div key={p.id} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'12px 16px', borderBottom: idx < cPayments.length - 1 ? '1px solid var(--border)' : 'none' }}>
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
                            className="btn btn-ghost btn-icon"
                            style={{ color:'var(--coral)', flexShrink:0, marginLeft:8 }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ))}
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
const ChevUpIcon    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color:'var(--text-3)' }}><path d="M18 15l-6-6-6 6"/></svg>
const ChevDownIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color:'var(--text-3)' }}><path d="M6 9l6 6 6-6"/></svg>
const TrashIcon     = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const ExportIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
