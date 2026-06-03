import { useState, useEffect } from 'react'
import { getClients, getAttendance, markAttended, unmarkAttended, updateAttendanceExercises } from '../lib/firestore.js'
import { DEFAULT_EXERCISES } from '../data/exercises.js'
import { getInitials, avatarColor, parseDMY, formatDMY, getMonthWindow } from '../lib/utils.js'
import PageLoader from '../components/PageLoader.jsx'

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()

// Returns all 7 DD-MM-YYYY strings for the Sun–Sat week containing dateStr
const getWeekDates = (dateStr) => {
  const [d, m, y] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const dow  = date.getDay()
  return Array.from({ length: 7 }, (_, i) => {
    const wd = new Date(date)
    wd.setDate(date.getDate() - dow + i)
    return formatDMY(wd)
  })
}

// Sort DD-MM-YYYY strings descending
const sortDMYDesc = (a, b) => {
  const [da,ma,ya] = a.split('-').map(Number)
  const [db,mb,yb] = b.split('-').map(Number)
  return new Date(yb,mb-1,db) - new Date(ya,ma-1,da)
}

export default function AttendancePage() {
  const today = new Date()
  const [viewDate, setViewDate]         = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [clients, setClients]           = useState([])
  const [attendanceMap, setAttendanceMap] = useState({}) // { 'DD-MM-YYYY': Set<clientId> }
  const [clientRecordsMap, setClientRecordsMap] = useState({}) // { clientId: [{ date, exercises }] }
  const [loading, setLoading]           = useState(true)
  const [selectedDay, setSelectedDay]   = useState(null)

  useEffect(() => {
    getClients()
      .then(cs => setClients(cs.filter(c => c.status !== 'deactivated')))
  }, [])

  useEffect(() => {
    if (!clients.length) return
    setLoading(true)
    const monthStr = `${String(viewDate.getMonth() + 1).padStart(2, '0')}-${viewDate.getFullYear()}`
    const map = {}
    const recMap = {}
    Promise.all(clients.map(async c => {
      const records = await getAttendance(c.id)
      recMap[c.id] = records // all records, for exercise history
      records.filter(r => r.date && r.date.slice(3) === monthStr).forEach(r => {
        if (!map[r.date]) map[r.date] = new Set()
        map[r.date].add(c.id)
      })
    })).then(() => {
      setAttendanceMap({ ...map })
      setClientRecordsMap({ ...recMap })
      setLoading(false)
    })
  }, [viewDate, clients])

  const toggleAttendance = async (clientId, dateStr) => {
    const isAttended = attendanceMap[dateStr]?.has(clientId)
    if (isAttended) {
      await unmarkAttended(clientId, dateStr)
      setAttendanceMap(prev => {
        const next = { ...prev }
        const s = new Set(next[dateStr])
        s.delete(clientId)
        next[dateStr] = s
        return next
      })
      setClientRecordsMap(prev => ({
        ...prev,
        [clientId]: (prev[clientId] || []).filter(r => r.date !== dateStr)
      }))
    } else {
      await markAttended(clientId, dateStr)
      setAttendanceMap(prev => {
        const next = { ...prev }
        next[dateStr] = new Set(next[dateStr] || [])
        next[dateStr].add(clientId)
        return next
      })
      setClientRecordsMap(prev => ({
        ...prev,
        [clientId]: [...(prev[clientId] || []), { date: dateStr, exercises: [] }]
      }))
    }
  }

  const handleUpdateExercises = async (clientId, dateStr, exercises) => {
    await updateAttendanceExercises(clientId, dateStr, exercises)
    setClientRecordsMap(prev => ({
      ...prev,
      [clientId]: (prev[clientId] || []).map(r =>
        r.date === dateStr ? { ...r, exercises } : r
      )
    }))
  }

  const year       = viewDate.getFullYear()
  const month      = viewDate.getMonth()
  const totalDays  = getDaysInMonth(year, month)
  const firstDOW   = new Date(year, month, 1).getDay()
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  return (
    <>
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Mark client sessions</p>
      </div>

      {/* Month navigation */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px 12px' }}>
        <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevLeftIcon /></button>
        <p style={{ fontWeight:600, fontSize:15 }}>{monthLabel}</p>
        <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevRightIcon /></button>
      </div>

      <div style={{ padding:'0 16px' }}>
        {/* Day-of-week header */}
        <div className="attendance-grid" style={{ marginBottom:4 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color:'var(--text-3)', padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="attendance-grid">
          {Array.from({ length: firstDOW }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day      = i + 1
            const cellDate = new Date(year, month, day)
            const dateStr  = formatDMY(cellDate)
            const count    = attendanceMap[dateStr]?.size || 0
            const isToday  = cellDate.toDateString() === today.toDateString()
            const isFuture = cellDate > today
            return (
              <div key={dateStr}
                className={`attendance-cell${isToday ? ' attendance-cell--today' : ''}${isFuture ? ' attendance-cell--future' : ''}${count > 0 ? ' attendance-cell--has-data' : ''}`}
                onClick={() => !isFuture && setSelectedDay(dateStr)}>
                <span className="attendance-cell-date">{day}</span>
                {count > 0 && <span className="attendance-badge">{count}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {loading && <PageLoader />}

      {!loading && (
        <p style={{ padding:'12px 16px 0', fontSize:12, color:'var(--text-3)', textAlign:'center' }}>
          Tap a day to mark attendance
        </p>
      )}

      {selectedDay && (
        <DaySheet
          dateStr={selectedDay}
          clients={clients}
          attendanceMap={attendanceMap}
          clientRecordsMap={clientRecordsMap}
          onToggle={toggleAttendance}
          onUpdateExercises={handleUpdateExercises}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>
  )
}

// ── Day sheet modal ───────────────────────────────────────────────────────────
function DaySheet({ dateStr, clients, attendanceMap, clientRecordsMap, onToggle, onUpdateExercises, onClose }) {
  const [exerciseClient, setExerciseClient] = useState(null) // client whose log is open

  const [d, m, y] = dateStr.split('-').map(Number)
  const dayDate   = new Date(y, m - 1, d)
  const label     = dayDate.toLocaleDateString('default', { weekday:'long', day:'numeric', month:'long' })
  const attended  = attendanceMap[dateStr] || new Set()
  const weekDates = getWeekDates(dateStr)

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-handle" />
          <p className="modal-title">{label}</p>
          <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:14 }}>
            {attended.size} client{attended.size !== 1 ? 's' : ''} attended
          </p>
          <div style={{ display:'flex', flexDirection:'column', maxHeight:'55vh', overflowY:'auto' }}>
            {clients.map(c => {
              const isAttended    = attended.has(c.id)
              const startD        = parseDMY(c.startDate)
              const isBeforeStart = startD && startD > dayDate
              const weekAttended  = weekDates.filter(ds => attendanceMap[ds]?.has(c.id)).length
              const weekExpected  = c.membershipType || null
              // 28-day cycle stats
              const cycleWindow   = c.startDate ? getMonthWindow(c.startDate, dateStr) : null
              const monthAttended = cycleWindow
                ? (clientRecordsMap[c.id] || []).filter(r => {
                    const d = parseDMY(r.date)
                    return d && d >= cycleWindow.windowStart && d <= cycleWindow.windowEnd
                  }).length
                : null
              const monthExpected = c.membershipType ? c.membershipType * 4 : null
              // exercises logged for this client on this day
              const sessionRecord = (clientRecordsMap[c.id] || []).find(r => r.date === dateStr)
              const exCount       = sessionRecord?.exercises?.length || 0

              return (
                <div key={c.id}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 2px',
                    borderBottom:'1px solid var(--border)',
                    opacity: isBeforeStart ? 0.4 : 1 }}>
                  {/* Tap avatar+name area to toggle attendance */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0, cursor: isBeforeStart ? 'default' : 'pointer' }}
                    onClick={() => !isBeforeStart && onToggle(c.id, dateStr)}>
                    <div className="avatar" style={{ background: avatarColor(c.name), width:34, height:34, fontSize:12, flexShrink:0 }}>
                      {getInitials(c.name)}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:500 }}>{c.name}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                        {weekExpected && (
                          <span className="membership-badge">{c.membershipType}×/wk</span>
                        )}
                        {weekExpected && (
                          <span style={{ fontSize:11, color: weekAttended >= weekExpected ? 'var(--teal)' : 'var(--text-3)' }}>
                            {weekAttended}/{weekExpected} this week
                          </span>
                        )}
                        {monthExpected != null && monthAttended != null && (
                          <span style={{ fontSize:11, color: monthAttended >= monthExpected ? 'var(--teal)' : 'var(--text-3)' }}>
                            · {monthAttended}/{monthExpected} this cycle
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Exercise log button — only when attended */}
                  {isAttended && !isBeforeStart && (
                    <button
                      onClick={e => { e.stopPropagation(); setExerciseClient(c) }}
                      style={{ background: exCount > 0 ? 'var(--accent-light)' : 'transparent',
                        border: `1.5px solid ${exCount > 0 ? '#C9C6F3' : 'var(--border)'}`,
                        borderRadius:'var(--r-sm)', padding:'5px 8px', cursor:'pointer',
                        display:'flex', alignItems:'center', gap:4,
                        color: exCount > 0 ? 'var(--accent-text)' : 'var(--text-3)',
                        flexShrink:0 }}
                      title="Log exercises">
                      <NotepadIcon />
                      {exCount > 0 && <span style={{ fontSize:11, fontWeight:600 }}>{exCount}</span>}
                    </button>
                  )}

                  {/* Attendance toggle circle */}
                  <div
                    style={{ width:24, height:24, borderRadius:'50%', flexShrink:0,
                      background: isAttended ? 'var(--teal)' : 'transparent',
                      border: `2px solid ${isAttended ? 'var(--teal)' : 'var(--border-mid)'}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      cursor: isBeforeStart ? 'default' : 'pointer' }}
                    onClick={() => !isBeforeStart && onToggle(c.id, dateStr)}>
                    {isAttended && <TickIcon />}
                  </div>
                </div>
              )
            })}
          </div>
          <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:14 }}>Done</button>
        </div>
      </div>

      {/* Exercise log — layered on top of day sheet */}
      {exerciseClient && (
        <ExerciseLogModal
          client={exerciseClient}
          dateStr={dateStr}
          allRecords={clientRecordsMap[exerciseClient.id] || []}
          onUpdate={onUpdateExercises}
          onClose={() => setExerciseClient(null)}
        />
      )}
    </>
  )
}

// ── Exercise log modal ────────────────────────────────────────────────────────
const ALL_EXERCISE_NAMES = DEFAULT_EXERCISES.map(e => e.name)

function ExerciseLogModal({ client, dateStr, allRecords, onUpdate, onClose }) {
  const sessionRecord = allRecords.find(r => r.date === dateStr)
  const [current, setCurrent] = useState(sessionRecord?.exercises || [])
  const [search, setSearch]   = useState('')
  const [saving, setSaving]   = useState(false)

  const suggestions = search.trim().length > 0
    ? ALL_EXERCISE_NAMES.filter(n =>
        n.toLowerCase().includes(search.toLowerCase()) && !current.includes(n)
      )
    : []

  const canAddFreeText = search.trim().length > 0
    && !ALL_EXERCISE_NAMES.map(n => n.toLowerCase()).includes(search.trim().toLowerCase())
    && !current.map(n => n.toLowerCase()).includes(search.trim().toLowerCase())

  const addExercise = async (name) => {
    const trimmed = name.trim()
    if (!trimmed || current.map(n => n.toLowerCase()).includes(trimmed.toLowerCase())) return
    const next = [...current, trimmed]
    setCurrent(next)
    setSearch('')
    setSaving(true)
    await onUpdate(client.id, dateStr, next)
    setSaving(false)
  }

  const removeExercise = async (name) => {
    const next = current.filter(e => e !== name)
    setCurrent(next)
    setSaving(true)
    await onUpdate(client.id, dateStr, next)
    setSaving(false)
  }

  // Past sessions with exercises, most recent first, excluding current date
  const history = [...allRecords]
    .filter(r => r.date !== dateStr && r.exercises?.length > 0)
    .sort((a, b) => sortDMYDesc(a.date, b.date))
    .slice(0, 6)

  const [dd, mm, yy] = dateStr.split('-').map(Number)
  const dayLabel = new Date(yy, mm - 1, dd).toLocaleDateString('default', { weekday:'short', day:'numeric', month:'short' })

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex:300 }}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">{client.name}</p>
        <p style={{ fontSize:13, color:'var(--text-3)', marginBottom:14 }}>{dayLabel} · exercises</p>

        {/* Current session chips */}
        {current.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
            {current.map(ex => (
              <span key={ex} style={{ display:'inline-flex', alignItems:'center', gap:5,
                background:'var(--accent-light)', color:'var(--accent-text)',
                border:'1px solid #C9C6F3', borderRadius:100, padding:'4px 10px',
                fontSize:13, fontWeight:500 }}>
                {ex}
                <button onClick={() => removeExercise(ex)} style={{ background:'none', border:'none',
                  cursor:'pointer', padding:0, color:'var(--accent-text)', fontSize:16, lineHeight:1,
                  display:'flex', alignItems:'center' }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Search / add input */}
        <div style={{ position:'relative', marginBottom:4 }}>
          <input
            className="form-input"
            placeholder="Search or type an exercise…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search.trim() && addExercise(search)}
            autoComplete="off"
          />
          {(suggestions.length > 0 || canAddFreeText) && (
            <div style={{ position:'absolute', top:'calc(100% + 2px)', left:0, right:0,
              background:'var(--surface)', border:'1.5px solid var(--border)',
              borderRadius:'var(--r-sm)', zIndex:10, maxHeight:180, overflowY:'auto',
              boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
              {suggestions.map(s => (
                <div key={s} onClick={() => addExercise(s)}
                  style={{ padding:'10px 12px', fontSize:13, cursor:'pointer',
                    borderBottom:'1px solid var(--border)' }}>
                  {s}
                </div>
              ))}
              {canAddFreeText && (
                <div onClick={() => addExercise(search)}
                  style={{ padding:'10px 12px', fontSize:13, cursor:'pointer',
                    color:'var(--accent)', fontWeight:500 }}>
                  Add "{search.trim()}"
                </div>
              )}
            </div>
          )}
        </div>
        {saving && <p style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>Saving…</p>}
        {!saving && current.length === 0 && !search && (
          <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:6 }}>
            No exercises logged yet — search above to add.
          </p>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop:18 }}>
            <p className="section-title" style={{ marginBottom:8 }}>Previous sessions</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:'28vh', overflowY:'auto' }}>
              {history.map(r => {
                const [rd, rm, ry] = r.date.split('-').map(Number)
                const rLabel = new Date(ry, rm - 1, rd).toLocaleDateString('default', { weekday:'short', day:'numeric', month:'short' })
                return (
                  <div key={r.date} style={{ padding:'10px 12px', background:'var(--bg)', borderRadius:'var(--r-sm)' }}>
                    <p style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>{rLabel}</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {r.exercises.map(ex => (
                        <span key={ex} style={{ fontSize:11, background:'var(--surface)',
                          border:'1px solid var(--border)', borderRadius:100,
                          padding:'2px 8px', color:'var(--text-2)' }}>
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button className="btn btn-ghost btn-full" onClick={onClose} style={{ marginTop:16 }}>Done</button>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const TickIcon    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
const ChevLeftIcon  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
const ChevRightIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
const NotepadIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
