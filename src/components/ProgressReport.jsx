import { useState } from 'react'
import { DEFAULT_MEASUREMENTS } from '../data/exercises.js'
import { formatValue, getInitials, avatarColor, groupBy } from '../lib/utils.js'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

export default function ProgressReport({ client, prs, attributes, measurements }) {
  const [selectedEx, setSelectedEx] = useState(null)

  const prByEx      = groupBy(prs, 'exerciseName')
  const chartableEx = Object.entries(prByEx).filter(([, e]) => e.length >= 2).map(([n]) => n)
  const prChartData = selectedEx
    ? [...(prByEx[selectedEx] || [])].reverse().map(p => ({ date: p.date, value: p.value }))
    : []
  const weightData = [...measurements].reverse().filter(m => m.values?.weight)
    .map(m => ({ date: m.date, weight: m.values.weight }))
  const latestAttr  = attributes[0]
  const radarData   = latestAttr
    ? Object.entries(latestAttr.scores).map(([attr, score]) => ({ attr, score }))
    : []

  const tooltipStyle = { fontSize:12, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)' }

  return (
    <>
      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0,1fr))', gap:10, marginBottom:16 }}>
        <StatCard label="PRs logged"         value={prs.length}                   color="var(--accent)" />
        <StatCard label="Measurement checks" value={measurements.length}           color="var(--teal)"  />
        <StatCard label="Attribute checks"   value={attributes.length}             color="var(--coral)" />
        <StatCard label="Exercises tracked"  value={Object.keys(prByEx).length}   color="var(--amber)" />
      </div>

      {/* Latest measurements */}
      {measurements[0] && (
        <>
          <p className="section-title" style={{ marginBottom:8 }}>Latest measurements — {measurements[0].date}</p>
          <div className="card" style={{ padding:0, marginBottom:16 }}>
            {DEFAULT_MEASUREMENTS.map(m => {
              const val = measurements[0].values?.[m.id]
              if (val == null) return null
              return (
                <div key={m.id} className="list-row" style={{ padding:'10px 16px' }}>
                  <span style={{ flex:1, fontSize:13, color:'var(--text-2)' }}>{m.label}</span>
                  <span style={{ fontWeight:600 }}>{val} {m.unit}</span>
                </div>
              )
            }).filter(Boolean)}
          </div>
        </>
      )}

      {/* Attribute radar */}
      {radarData.length > 0 && (
        <>
          <p className="section-title" style={{ marginBottom:8 }}>Attribute profile — {latestAttr?.date}</p>
          <div className="card" style={{ marginBottom:16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top:10, right:20, bottom:10, left:20 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="attr" tick={{ fontSize:11, fill:'var(--text-2)' }} />
                <Radar dataKey="score" stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.25} strokeWidth={2} dot={{ r:3, fill:'#7F77DD' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* PR trends */}
      {chartableEx.length > 0 && (
        <>
          <p className="section-title" style={{ marginBottom:8 }}>PR trends</p>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ marginBottom:12 }}>
              <select className="form-select" value={selectedEx || ''} onChange={e => setSelectedEx(e.target.value || null)}>
                <option value="">Select an exercise…</option>
                {chartableEx.map(ex => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            {selectedEx && prChartData.length >= 2 && (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={prChartData} margin={{ top:5, right:10, bottom:5, left:-10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--text-3)' }} />
                  <YAxis tick={{ fontSize:10, fill:'var(--text-3)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke="#7F77DD" strokeWidth={2.5} dot={{ r:4, fill:'#7F77DD' }} activeDot={{ r:6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      {/* Weight trend */}
      {weightData.length >= 2 && (
        <>
          <p className="section-title" style={{ marginBottom:8 }}>Weight trend</p>
          <div className="card" style={{ marginBottom:16 }}>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weightData} margin={{ top:5, right:10, bottom:5, left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--text-3)' }} />
                <YAxis tick={{ fontSize:10, fill:'var(--text-3)' }} domain={['auto','auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} kg`,'Weight']} />
                <Line type="monotone" dataKey="weight" stroke="#1D9E75" strokeWidth={2.5} dot={{ r:4, fill:'#1D9E75' }} activeDot={{ r:6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <p style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', paddingBottom:8 }}>
        Coach by Sam · {new Date().toLocaleDateString()}
      </p>
    </>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'14px', textAlign:'center' }}>
      <p style={{ fontSize:28, fontWeight:700, color }}>{value}</p>
      <p style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{label}</p>
    </div>
  )
}
