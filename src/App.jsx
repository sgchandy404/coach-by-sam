import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { auth, provider } from './lib/firebase.js'
import ClientsPage      from './pages/ClientsPage.jsx'
import PRLogPage        from './pages/PRLogPage.jsx'
import AttributesPage   from './pages/AttributesPage.jsx'
import MeasurementsPage from './pages/MeasurementsPage.jsx'
import RankingsPage     from './pages/RankingsPage.jsx'
import AttendancePage   from './pages/AttendancePage.jsx'
import SettingsPage     from './pages/SettingsPage.jsx'
import BottomNav        from './components/BottomNav.jsx'
import { BrandMark }   from './components/PageLoader.jsx'

export default function App() {
  const [user, setUser]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [authError, setAuthError] = useState(null)
  const [tab, setTab]           = useState('clients')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)

  useEffect(() => {
    let unsubscribe = () => {}
    const init = async () => {
      try {
        await getRedirectResult(auth)
      } catch (e) {
        console.error('Redirect result error:', e.code, e.message)
        setAuthError(e.code + ': ' + e.message)
      }
      unsubscribe = onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
    }
    init()
    return () => unsubscribe()
  }, [])

  if (loading) return <Splash />
  if (!user)   return <LoginScreen redirectError={authError} />

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
      background:'#F0EDE7', position:'relative', overflow:'hidden',
    }}>
      {/* Decorative arcs */}
      <div style={{ position:'absolute', width:340, height:340, borderRadius:'50%', border:'1px solid rgba(26,175,150,0.15)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:210, height:210, borderRadius:'50%', border:'1px solid rgba(26,175,150,0.10)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />
      <div style={{ textAlign:'center', animation:'loader-pulse 1.6s ease-in-out infinite', position:'relative', zIndex:1 }}>
        <BrandMark size={26} />
      </div>
    </div>
  )
}

function LoginScreen({ redirectError }) {
  const [err, setErr] = useState('')

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const login = async () => {
    try {
      if (isIOS) {
        await signInWithRedirect(auth, provider)
      } else {
        await signInWithPopup(auth, provider)
      }
    } catch (e) {
      console.error('AUTH ERROR:', e.code, e.message)
      setErr(e.code + ' — ' + e.message)
    }
  }
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'100dvh', padding:'32px 24px', gap:28,
      background:'#F0EDE7', position:'relative', overflow:'hidden',
    }}>
      {/* Decorative arcs */}
      <div style={{ position:'absolute', width:'90vw', height:'90vw', maxWidth:400, maxHeight:400, borderRadius:'50%', border:'1px solid rgba(26,175,150,0.14)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:'60vw', height:'60vw', maxWidth:280, maxHeight:280, borderRadius:'50%', border:'1px solid rgba(26,175,150,0.09)', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />

      <div style={{ textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ marginBottom:20 }}>
          <BrandMark size={36} />
        </div>
        <p style={{ color:'#9E9890', fontSize:14, fontWeight:400, lineHeight:1.7, letterSpacing:'0.1px' }}>
          Track client progress,<br/>celebrate every win.
        </p>
      </div>
      {redirectError && (
        <div style={{ background:'#FDE8E5', border:'1px solid rgba(224,85,69,0.25)', borderRadius:12, padding:'10px 14px', maxWidth:300, width:'100%', position:'relative', zIndex:1 }}>
          <p style={{ color:'#8B1F18', fontSize:11, fontWeight:600, marginBottom:3 }}>Auth error</p>
          <p style={{ color:'#8B1F18', fontSize:11, lineHeight:1.5, wordBreak:'break-all' }}>{redirectError}</p>
        </div>
      )}
      {err && (
        <p style={{ color:'var(--coral)', fontSize:12, textAlign:'center', maxWidth:280, lineHeight:1.5, position:'relative', zIndex:1 }}>{err}</p>
      )}
      <button className="btn btn-primary btn-full" onClick={login}
        style={{ maxWidth:300, gap:10, fontSize:15, padding:'14px 24px', position:'relative', zIndex:1 }}>
        <GoogleIcon /> Sign in with Google
      </button>
      <p style={{ fontSize:12, color:'#CBC6BD', textAlign:'center', maxWidth:220, lineHeight:1.6, position:'relative', zIndex:1 }}>
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
