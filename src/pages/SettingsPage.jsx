import { useState } from 'react'
import { seedDummyData, flushDummyData, flushAllData } from '../lib/firestore.js'
import { DUMMY_CLIENTS } from '../data/seed.js'

export default function SettingsPage({ onDone }) {
  const [status, setStatus] = useState(null)   // null | 'loading' | 'done' | 'error'
  const [msg, setMsg]       = useState('')
  const [confirm, setConfirm] = useState(null) // which action needs confirm: 'seed' | 'flushDummy' | 'flushAll'

  const run = async (label, fn) => {
    setStatus('loading'); setMsg(label)
    try {
      await fn()
      setStatus('done'); setMsg(`${label} complete.`)
    } catch (e) {
      setStatus('error'); setMsg(`Error: ${e.message}`)
    }
    setConfirm(null)
  }

  return (
    <div className="modal-backdrop" onClick={onDone}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">Settings</p>

        {status === 'loading' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <p style={{ fontSize:14, color:'var(--text-2)' }}>Working… {msg}</p>
          </div>
        )}

        {status !== 'loading' && !confirm && (
          <>
            <div className="section-title" style={{ marginBottom:10 }}>Demo data</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              <div className="card">
                <p style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Load dummy clients</p>
                <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
                  Adds 10 sample clients with PRs, attributes, and measurements so you can explore the app. Tagged as dummy data — can be removed separately.
                </p>
                <button className="btn btn-primary btn-full" onClick={() => setConfirm('seed')}>
                  Load 10 dummy clients
                </button>
              </div>

              <div className="card">
                <p style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Remove dummy clients</p>
                <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
                  Deletes only the 10 seeded clients and their data. Any real clients you have added are kept.
                </p>
                <button className="btn btn-outline btn-full" style={{ color:'var(--amber)', borderColor:'#FAC775' }} onClick={() => setConfirm('flushDummy')}>
                  Remove dummy data
                </button>
              </div>
            </div>

            <div className="section-title" style={{ marginBottom:10 }}>Danger zone</div>
            <div className="card" style={{ borderColor:'#F09595' }}>
              <p style={{ fontWeight:600, fontSize:14, marginBottom:4, color:'#E24B4A' }}>Delete all data</p>
              <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:12 }}>
                Permanently deletes every client, all their PRs, measurements, attributes, and custom exercises. Start completely fresh. Cannot be undone.
              </p>
              <button className="btn btn-full" style={{ background:'#FCEBEB', color:'#A32D2D', border:'1.5px solid #F09595', fontWeight:600 }}
                onClick={() => setConfirm('flushAll')}>
                Delete everything
              </button>
            </div>
          </>
        )}

        {/* Confirmation step */}
        {confirm === 'seed' && (
          <ConfirmCard
            title="Load 10 dummy clients?"
            body="This will add 10 sample clients to your database. You can remove them later with 'Remove dummy data'."
            confirmLabel="Yes, load dummy data"
            confirmStyle={{ background:'var(--accent)', color:'#fff', border:'none' }}
            onConfirm={() => run('Loading dummy data', () => seedDummyData(DUMMY_CLIENTS))}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm === 'flushDummy' && (
          <ConfirmCard
            title="Remove dummy clients?"
            body="This deletes all 10 seeded clients and their data. Real clients are not affected."
            confirmLabel="Yes, remove dummy data"
            confirmStyle={{ background:'var(--amber-light)', color:'var(--amber-text)', border:'1.5px solid #FAC775' }}
            onConfirm={() => run('Removing dummy data', flushDummyData)}
            onCancel={() => setConfirm(null)}
          />
        )}
        {confirm === 'flushAll' && (
          <ConfirmCard
            title="Delete everything?"
            body="This permanently deletes ALL clients, PRs, measurements, attributes, and custom exercises. There is no undo."
            confirmLabel="Yes, delete everything"
            confirmStyle={{ background:'#FCEBEB', color:'#A32D2D', border:'1.5px solid #F09595' }}
            onConfirm={() => run('Deleting all data', flushAllData)}
            onCancel={() => setConfirm(null)}
          />
        )}

        {status === 'done' && (
          <p style={{ fontSize:13, color:'var(--teal)', fontWeight:600, textAlign:'center', marginTop:16 }}>{msg}</p>
        )}
        {status === 'error' && (
          <p style={{ fontSize:13, color:'var(--coral)', textAlign:'center', marginTop:16 }}>{msg}</p>
        )}

        <button className="btn btn-ghost btn-full" onClick={onDone} style={{ marginTop:16 }}>Close</button>
      </div>
    </div>
  )
}

function ConfirmCard({ title, body, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <p style={{ fontWeight:700, fontSize:16 }}>{title}</p>
      <p style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6 }}>{body}</p>
      <button className="btn btn-full" style={confirmStyle} onClick={onConfirm}>{confirmLabel}</button>
      <button className="btn btn-outline btn-full" onClick={onCancel}>Cancel</button>
    </div>
  )
}
