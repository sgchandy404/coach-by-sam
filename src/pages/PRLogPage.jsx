import { useState, useEffect, useRef } from 'react'
import { getClients, getPRs, addPR, deletePR, updatePR, getCustomExercises, addCustomExercise, updateCustomExercise, deleteCustomExercise, mergeExercise } from '../lib/firestore.js'
import { DEFAULT_EXERCISES } from '../data/exercises.js'
import { formatValue, groupBy, formatDMY, dmy2display, display2dmy } from '../lib/utils.js'
import ClientPicker from '../components/ClientPicker.jsx'
import PageLoader from '../components/PageLoader.jsx'

export default function PRLogPage({ clientId, setClientId }) {
  const [clients, setClients]     = useState([])
  const [prs, setPRs]             = useState([])
  const [customEx, setCustomEx]   = useState([])
  const [showAdd, setShowAdd]     = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [editingPR, setEditingPR] = useState(null)
  const [loading, setLoading]     = useState(false)

  useEffect(() => { getClients().then(setClients) }, [])
  useEffect(() => { getCustomExercises().then(setCustomEx) }, [])
  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    getPRs(clientId).then(d => { setPRs(d); setLoading(false) })
  }, [clientId])

  const allExercises = [...DEFAULT_EXERCISES, ...customEx]
  const allCategories = [...new Set([...allExercises.map(e => (e.category || 'Custom').trim()), 'Custom'])]

  const BASE_EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Resistance bands', 'Bodyweight']
  const equipmentOptions = [...new Set([...BASE_EQUIPMENT, ...prs.map(p => p.equipment).filter(Boolean).map(e => e.trim())])]

  const handleDelete = async (prId) => {
    if (!confirm('Delete this PR entry?')) return
    await deletePR(clientId, prId)
    setPRs(p => p.filter(x => x.id !== prId))
  }

  const grouped = prs.reduce((acc, pr) => {
    const key = pr.equipment ? `${pr.exerciseName} · ${pr.equipment}` : pr.exerciseName
    acc[key] = acc[key] || []
    acc[key].push(pr)
    return acc
  }, {})

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
                    <span style={{ fontWeight:700, fontSize:17, color:'var(--accent)' }}>
                      {formatValue(pr.value, pr.type, pr.unit)}
                    </span>
                    <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {pr.date}{pr.notes ? ` · ${pr.notes}` : ''}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => setEditingPR(pr)} style={{ color:'var(--text-3)' }}>
                    <EditIcon />
                  </button>
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

      <div className="section" style={{ marginTop:4 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setShowManage(true)}>
          Manage exercises
        </button>
      </div>

      {clientId && <button className="fab" onClick={() => setShowAdd(true)} aria-label="Log PR">+</button>}

      {showAdd && (
        <AddPRModal
          exercises={allExercises}
          allCategories={allCategories}
          equipmentOptions={equipmentOptions}
          onClose={() => setShowAdd(false)}
          onSave={async (data) => {
            const ref = await addPR(clientId, data)
            setPRs(p => [{ id: ref.id, ...data }, ...p])
            setShowAdd(false)
          }}
          onCreateExercise={async (data) => {
            const ref = await addCustomExercise(data)
            const created = { id: ref.id, ...data }
            setCustomEx(ex => [...ex, created])
            return created
          }}
        />
      )}

      {editingPR && (
        <EditPRModal pr={editingPR} exercises={allExercises} equipmentOptions={equipmentOptions} onClose={() => setEditingPR(null)}
          onSave={async (data) => {
            await updatePR(clientId, editingPR.id, data)
            setPRs(p => p.map(x => x.id === editingPR.id ? { ...x, ...data } : x))
            setEditingPR(null)
          }} />
      )}

      {showManage && (
        <ManageExercisesModal
          customExercises={customEx}
          allExercises={allExercises}
          allCategories={allCategories}
          clients={clients}
          onClose={() => setShowManage(false)}
          onDeleted={(id) => {
            setCustomEx(prev => prev.filter(e => e.id !== id))
            setPRs(prev => prev.filter(p => p.exerciseId !== id))
          }}
          onMerged={(oldEx, targetEx) => {
            setCustomEx(prev => prev.filter(e => e.id !== oldEx.id))
            setPRs(prev => prev.map(p =>
              p.exerciseId === oldEx.id || p.exerciseName === oldEx.name
                ? { ...p, exerciseId: targetEx.id, exerciseName: targetEx.name, type: targetEx.type, unit: targetEx.unit }
                : p
            ))
          }}
          onEdited={(updated) => {
            setCustomEx(prev => prev.map(e => e.id === updated.id ? updated : e))
            setPRs(prev => prev.map(p =>
              p.exerciseId === updated.id
                ? { ...p, exerciseName: updated.name, type: updated.type, unit: updated.unit }
                : p
            ))
          }}
        />
      )}
    </>
  )
}

// ── Add PR modal — search-first ───────────────────────────────────────────────

function AddPRModal({ exercises, allCategories, equipmentOptions, onClose, onSave, onCreateExercise }) {
  const [step, setStep]         = useState('pick') // 'pick' | 'log'
  const [search, setSearch]     = useState('')
  const [selectedEx, setSelectedEx] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // create sub-form
  const [newName, setNewName]         = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newType, setNewType]         = useState('weight')
  const [creating, setCreating]       = useState(false)

  // log form
  const [value, setValue]         = useState('')
  const [equipment, setEquipment] = useState('')
  const [date, setDate]           = useState(formatDMY(new Date()))
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)

  const searchRef = useRef(null)
  useEffect(() => { if (step === 'pick') searchRef.current?.focus() }, [step])

  const unitMap = { weight:'kg', time:'sec', reps:'reps' }

  const normalise = s => s.toLowerCase().trim()
  const filtered = search.trim()
    ? exercises.filter(e => e.name.toLowerCase().includes(normalise(search)))
    : exercises
  const exactMatch = exercises.find(e => normalise(e.name) === normalise(search))
  const canCreate  = search.trim().length > 1 && !exactMatch

  const selectExercise = (ex) => {
    setSelectedEx(ex)
    setShowCreate(false)
    setStep('log')
  }

  const handleCreateClick = () => {
    setNewName(search.trim())
    setNewCategory(allCategories[0] || 'Custom')
    setShowCreate(true)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const cat = newCategory || 'Custom'
    const created = await onCreateExercise({

      name: newName.trim(),
      category: cat,
      type: newType,
      unit: unitMap[newType],
    })
    setCreating(false)
    selectExercise(created)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {step === 'pick' ? (
          <>
            <p className="modal-title">Log a PR</p>
            <div className="form-group" style={{ marginBottom:8 }}>
              <input
                ref={searchRef}
                className="form-input"
                placeholder="Search exercises…"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowCreate(false) }}
              />
            </div>

            {/* Exercise list */}
            <div style={{ maxHeight:220, overflowY:'auto', margin:'0 -4px', borderRadius:8 }}>
              {filtered.length === 0 && !canCreate && (
                <p style={{ fontSize:13, color:'var(--text-3)', padding:'12px 8px', textAlign:'center' }}>No exercises found</p>
              )}
              {filtered.map(ex => (
                <button key={ex.id}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', padding:'10px 12px', background:'none', border:'none',
                    cursor:'pointer', borderRadius:8, textAlign:'left',
                    transition:'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}
                  onClick={() => selectExercise(ex)}>
                  <span style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>{ex.name}</span>
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:20,
                    background: ex.category === 'Custom' ? 'var(--accent-light)' : 'var(--bg)',
                    color: ex.category === 'Custom' ? 'var(--accent-text)' : 'var(--text-3)',
                    border: '1px solid var(--border)',
                  }}>{ex.category}</span>
                </button>
              ))}

              {/* Create option */}
              {canCreate && !showCreate && (
                <button
                  style={{
                    display:'flex', alignItems:'center', gap:8,
                    width:'100%', padding:'10px 12px', background:'none', border:'none',
                    cursor:'pointer', borderRadius:8, textAlign:'left', color:'var(--accent)',
                  }}
                  onClick={handleCreateClick}>
                  <span style={{ fontSize:18, lineHeight:1 }}>+</span>
                  <span style={{ fontSize:14, fontWeight:600 }}>Create "{search.trim()}"</span>
                </button>
              )}
            </div>

            {/* Inline create form */}
            {showCreate && (
              <div style={{ marginTop:12, padding:'12px 14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
                <p style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.05em' }}>New exercise</p>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tracked as</label>
                  <div style={{ display:'flex', gap:8 }}>
                    {['weight','time','reps'].map(t => (
                      <button key={t} className={`btn btn-sm ${newType === t ? 'btn-primary' : 'btn-outline'}`} style={{ flex:1 }}
                        onClick={() => setNewType(t)}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button className="btn btn-outline btn-sm btn-full" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm btn-full" disabled={!newName.trim() || creating}
                    onClick={handleCreate}>{creating ? 'Adding…' : 'Add & select'}</button>
                </div>
              </div>
            )}

            <button className="btn btn-outline btn-full" style={{ marginTop:12 }} onClick={onClose}>Cancel</button>
          </>
        ) : (
          <>
            {/* Log step */}
            <button
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:13, fontWeight:600, padding:'0 0 8px', display:'flex', alignItems:'center', gap:4 }}
              onClick={() => setStep('pick')}>
              ← Change exercise
            </button>
            <p className="modal-title" style={{ marginBottom:4 }}>{selectedEx?.name}</p>
            <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>{selectedEx?.category}</p>

            <div className="form-group">
              <label className="form-label">
                {selectedEx?.type === 'time' ? 'Time (seconds)' : selectedEx?.type === 'reps' ? 'Max reps' : `Weight (${selectedEx?.unit || 'kg'})`}
              </label>
              <input className="form-input" type="number" inputMode="decimal" min="0" step="0.5"
                placeholder={selectedEx?.type === 'time' ? 'e.g. 285  (= 4 min 45 sec)' : 'e.g. 80'}
                value={value} onChange={e => setValue(e.target.value)} autoFocus />
              {selectedEx?.type === 'time' && (
                <p style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>Enter total seconds. 5 min = 300 s</p>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Equipment <span style={{ color:'var(--text-3)', fontWeight:400 }}>(optional)</span></label>
              <select className="form-select" value={equipment} onChange={e => setEquipment(e.target.value)}>
                <option value="">— None —</option>
                {equipmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY"
                value={dmy2display(date)} onChange={e => setDate(display2dmy(e.target.value))} />
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
                  await onSave({
                    exerciseId: selectedEx.id, exerciseName: selectedEx.name,
                    value: Number(value), type: selectedEx.type, unit: selectedEx.unit,
                    date, notes: notes.trim(), equipment: equipment.trim(),
                  })
                  setSaving(false)
                }}>
                {saving ? 'Saving…' : 'Save PR'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Edit PR modal ─────────────────────────────────────────────────────────────

function EditPRModal({ pr, exercises, equipmentOptions, onClose, onSave }) {
  const [date, setDate]           = useState(pr.date || formatDMY(new Date()))
  const [value, setValue]         = useState(String(pr.value ?? ''))
  const [equipment, setEquipment] = useState(pr.equipment || '')
  const [notes, setNotes]         = useState(pr.notes || '')
  const [saving, setSaving]       = useState(false)

  const ex = exercises.find(e => e.id === pr.exerciseId) || { type: pr.type, unit: pr.unit, name: pr.exerciseName }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Edit PR — {pr.exerciseName}</p>
        <div className="form-group">
          <label className="form-label">
            {ex?.type === 'time' ? 'Time (seconds)' : ex?.type === 'reps' ? 'Max reps' : `Weight (${ex?.unit || 'kg'})`}
          </label>
          <input className="form-input" type="number" inputMode="decimal" min="0" step="0.5"
            value={value} onChange={e => setValue(e.target.value)} autoFocus />
          {ex?.type === 'time' && (
            <p style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>Enter total seconds. 5 min = 300 s</p>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Date</label>
          <input className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY"
            value={dmy2display(date)} onChange={e => setDate(display2dmy(e.target.value))} />
        </div>
        <div className="form-group">
          <label className="form-label">Equipment <span style={{ color:'var(--text-3)', fontWeight:400 }}>(optional)</span></label>
          <select className="form-select" value={equipment} onChange={e => setEquipment(e.target.value)}>
            <option value="">— None —</option>
            {equipmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
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
              await onSave({ value: Number(value), date, notes: notes.trim(), equipment: equipment.trim() })
              setSaving(false)
            }}>
            {saving ? 'Saving…' : 'Update PR'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Manage exercises modal ────────────────────────────────────────────────────

function ManageExercisesModal({ customExercises, allExercises, allCategories, clients, onClose, onDeleted, onMerged, onEdited }) {
  const [view, setView]           = useState('list') // 'list' | 'merge' | 'edit'
  const [mergingEx, setMergingEx] = useState(null)
  const [editingEx, setEditingEx] = useState(null)
  const [mergeSearch, setMergeSearch] = useState('')
  const [prCounts, setPrCounts]   = useState({})
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [working, setWorking]     = useState(false)

  // new / edit exercise form
  const [newName, setNewName]         = useState('')
  const [newCategory, setNewCategory] = useState(allCategories[0] || 'Custom')
  const [newType, setNewType]         = useState('weight')
  const unitMap = { weight:'kg', time:'sec', reps:'reps' }

  const builtInNames = new Set(DEFAULT_EXERCISES.map(e => e.name.toLowerCase()))
  // Names that appear more than once across custom exercises
  const customNameCounts = customExercises.reduce((acc, e) => {
    const k = e.name.toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc
  }, {})

  useEffect(() => {
    Promise.all(clients.map(c => getPRs(c.id))).then(arrays => {
      const counts = {}
      arrays.flat().forEach(pr => {
        const key = pr.exerciseId || pr.exerciseName
        counts[key] = (counts[key] || 0) + 1
      })
      setPrCounts(counts)
      setLoadingCounts(false)
    })
  }, [])

  const prCountFor = (ex) => prCounts[ex.id] || prCounts[ex.name] || 0

  const handleDelete = async (ex) => {
    const count = prCountFor(ex)
    if (count > 0) return // button is disabled — safety guard
    if (!confirm(`Delete "${ex.name}"?`)) return
    setWorking(true)
    await deleteCustomExercise(ex.id)
    onDeleted(ex.id)
    setWorking(false)
  }

  const handleMerge = async (targetEx) => {
    setWorking(true)
    await mergeExercise(mergingEx, targetEx, clients)
    onMerged(mergingEx, targetEx)
    setWorking(false)
    setView('list')
    setMergingEx(null)
  }

  const startEdit = (ex) => {
    setEditingEx(ex)
    setNewName(ex.name)
    setNewCategory(ex.category || 'Custom')
    setNewType(ex.type || 'weight')
    setView('edit')
  }

  const handleEdit = async () => {
    if (!newName.trim()) return
    setWorking(true)
    const updated = { name: newName.trim(), category: newCategory || 'Custom', type: newType, unit: unitMap[newType] }
    await updateCustomExercise(editingEx.id, updated)
    onEdited({ ...editingEx, ...updated })
    setWorking(false)
    setView('list')
  }

  // Merge target list: all exercises except the one being merged, same type preferred
  const mergeTargets = allExercises
    .filter(e => e.id !== mergingEx?.id)
    .filter(e => !mergeSearch.trim() || e.name.toLowerCase().includes(mergeSearch.toLowerCase()))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {/* ── List view ── */}
        {view === 'list' && (
          <>
            <p className="modal-title">Manage exercises</p>

            {loadingCounts ? (
              <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Loading…</p>
            ) : customExercises.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>No custom exercises yet.</p>
            ) : (
              <div>
                {customExercises.map(ex => {
                  const count        = prCountFor(ex)
                  const dupeBuiltIn  = builtInNames.has(ex.name.toLowerCase())
                  const dupeCustom   = (customNameCounts[ex.name.toLowerCase()] || 0) > 1
                  const isDupe       = dupeBuiltIn || dupeCustom
                  const dupeLabel    = dupeBuiltIn
                    ? `Matches built-in "${DEFAULT_EXERCISES.find(e => e.name.toLowerCase() === ex.name.toLowerCase())?.name}". Merge to combine history.`
                    : 'Another custom exercise has this name. Merge to combine history.'
                  return (
                    <div key={ex.id} style={{
                      padding:'12px 0', borderBottom:'1px solid var(--border)',
                      display:'flex', flexDirection:'column', gap:6,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>{ex.name}</span>
                        {isDupe && (
                          <span style={{ fontSize:11, padding:'2px 7px', borderRadius:20, background:'#FFF3CD', color:'#856404', border:'1px solid #FFEAA7', fontWeight:600 }}>
                            Duplicate
                          </span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:12, color:'var(--text-3)' }}>{ex.category} · {ex.type}</span>
                        <span style={{ fontSize:12, color:'var(--text-3)', marginLeft:'auto' }}>
                          {count > 0 ? `${count} PR${count !== 1 ? 's' : ''}` : 'No PRs'}
                        </span>
                      </div>
                      {isDupe && (
                        <p style={{ fontSize:12, color:'#856404', margin:0 }}>
                          {dupeLabel}
                        </p>
                      )}
                      <div style={{ display:'flex', gap:8, marginTop:2 }}>
                        <button className="btn btn-outline btn-sm" style={{ flex:1 }}
                          onClick={() => startEdit(ex)}>
                          Edit
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ flex:1 }}
                          onClick={() => { setMergingEx(ex); setMergeSearch(''); setView('merge') }}>
                          Merge →
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ flex:1, color: count > 0 ? 'var(--text-3)' : 'var(--coral)', borderColor: count > 0 ? 'var(--border)' : 'var(--coral)', opacity: count > 0 ? 0.5 : 1 }}
                          disabled={count > 0 || working}
                          title={count > 0 ? `${count} PR(s) reference this exercise — merge first` : ''}
                          onClick={() => handleDelete(ex)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <button className="btn btn-outline btn-full" style={{ marginTop:12 }} onClick={onClose}>Close</button>
          </>
        )}

        {/* ── Merge target picker ── */}
        {view === 'merge' && (
          <>
            <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:13, fontWeight:600, padding:'0 0 8px', display:'flex', alignItems:'center', gap:4 }}
              onClick={() => setView('list')}>← Back</button>
            <p className="modal-title">Merge "{mergingEx?.name}" into…</p>
            <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:12 }}>All PRs logged under this exercise will be moved to the target. The original exercise will be deleted.</p>
            <input className="form-input" placeholder="Search target exercise…" value={mergeSearch}
              onChange={e => setMergeSearch(e.target.value)} autoFocus style={{ marginBottom:8 }} />
            <div>
              {mergeTargets.map(ex => {
                const sameType = ex.type === mergingEx?.type
                return (
                  <button key={ex.id}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      width:'100%', padding:'10px 12px', background:'none', border:'none',
                      cursor: working ? 'not-allowed' : 'pointer', borderRadius:8, textAlign:'left',
                      opacity: working ? 0.5 : 1,
                    }}
                    onMouseEnter={e => !working && (e.currentTarget.style.background='var(--accent-light)')}
                    onMouseLeave={e => e.currentTarget.style.background='none'}
                    disabled={working}
                    onClick={() => handleMerge(ex)}>
                    <div>
                      <p style={{ fontSize:14, fontWeight:500, color:'var(--text)', margin:0 }}>{ex.name}</p>
                      <p style={{ fontSize:12, color:'var(--text-3)', margin:0 }}>{ex.category} · {ex.type}</p>
                    </div>
                    {!sameType && (
                      <span style={{ fontSize:11, color:'var(--amber)', fontWeight:600 }}>⚠ diff type</span>
                    )}
                  </button>
                )
              })}
              {mergeTargets.length === 0 && (
                <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'16px 0' }}>No exercises found</p>
              )}
            </div>
            {working && <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', marginTop:8 }}>Merging…</p>}
          </>
        )}

        {/* ── Edit exercise ── */}
        {view === 'edit' && (
          <>
            <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:13, fontWeight:600, padding:'0 0 8px', display:'flex', alignItems:'center', gap:4 }}
              onClick={() => setView('list')}>← Back</button>
            <p className="modal-title">Edit exercise</p>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tracked as</label>
              <div style={{ display:'flex', gap:8 }}>
                {['weight','time','reps'].map(t => (
                  <button key={t} className={`btn btn-sm ${newType === t ? 'btn-primary' : 'btn-outline'}`} style={{ flex:1 }}
                    onClick={() => setNewType(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-outline btn-full" onClick={() => setView('list')}>Cancel</button>
              <button className="btn btn-primary btn-full" disabled={!newName.trim() || working}
                onClick={handleEdit}>{working ? 'Saving…' : 'Save changes'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>

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
