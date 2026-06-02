import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, provider } from './lib/firebase.js'
import ClientsPage      from './pages/ClientsPage.jsx'
import PRLogPage        from './pages/PRLogPage.jsx'
import AttributesPage   from './pages/AttributesPage.jsx'
import MeasurementsPage from './pages/MeasurementsPage.jsx'
import RankingsPage     from './pages/RankingsPage.jsx'
import AttendancePage   from './pages/AttendancePage.jsx'
import SettingsPage     from './pages/SettingsPage.jsx'
import BottomNav        from './components/BottomNav.jsx'

export default function App() {
  const [user, setUser]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('clients')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])

  if (loading) return <Splash />
  if (!user)   return <LoginScreen />

  const clientProps = { clientId: selectedClientId, setClientId: setSelectedClientId }

  return (
    <div className="app-shell">
      <div className="page">
        {tab === 'clients'      && <ClientsPage     {...clientProps} setTab={setTab} />}
        {tab === 'prs'          && <PRLogPage        {...clientProps} />}
        {tab === 'attributes'   && <AttributesPage   {...clientProps} />}
        {tab === 'measurements' && <MeasurementsPage {...clientProps} />}
        {tab === 'rankings'     && <RankingsPage />}
        {tab === 'attendance'   && <AttendancePage />}
      </div>
      <BottomNav tab={tab} setTab={setTab} onSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsPage onDone={() => setShowSettings(false)} />}
    </div>
  )
}

function Splash() {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh',
      background:'linear-gradient(160deg, #FAF7F2 0%, #F3EDE3 50%, #EDE4D5 100%)',
    }}>
      <div style={{ textAlign:'center', color:'var(--text-3)' }}>
        <div style={{ fontSize:36, marginBottom:10 }}>💪</div>
        <p style={{ fontSize:13, letterSpacing:'0.5px' }}>Loading…</p>
      </div>
    </div>
  )
}

function LoginScreen() {
  const [err, setErr] = useState('')
  const login = async () => {
    try { await signInWithPopup(auth, provider) }
    catch (e) {
      console.error('AUTH ERROR:', e.code, e.message)
      setErr(e.code + ' — ' + e.message)
    }
  }
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'100dvh', padding:'32px 24px', gap:28,
      background:'linear-gradient(160deg, #FAF7F2 0%, #F3EDE3 50%, #EDE4D5 100%)',
    }}>
      <div style={{ textAlign:'center' }}>
        <div style={{
          width:72, height:72, borderRadius:'50%',
          background:'linear-gradient(135deg, #C4633A, #A8720A)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, margin:'0 auto 20px',
          boxShadow:'0 6px 24px rgba(196,99,58,0.25)',
        }}>💪</div>
        <h1 style={{
          fontFamily:'Playfair Display, serif',
          fontSize:32, fontWeight:700, letterSpacing:'-0.5px', marginBottom:8,
          color:'#1E1A16',
        }}>Coach by Sam</h1>
        <p style={{ color:'#6B5F52', fontSize:15, fontWeight:300, lineHeight:1.6 }}>
          Track client progress,<br/>celebrate every win.
        </p>
      </div>
      {err && (
        <p style={{ color:'var(--coral)', fontSize:12, textAlign:'center', maxWidth:280, lineHeight:1.5 }}>{err}</p>
      )}
      <button className="btn btn-primary btn-full" onClick={login}
        style={{ maxWidth:300, gap:10, fontSize:15, padding:'13px 24px', borderRadius:12 }}>
        <GoogleIcon /> Sign in with Google
      </button>
      <p style={{ fontSize:12, color:'#A8998A', textAlign:'center', maxWidth:220, lineHeight:1.6 }}>
        Access is restricted to authorised accounts only.
      </p>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
