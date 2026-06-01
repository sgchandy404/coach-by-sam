// Evaluation engine — computes trend status for each dimension of a client's progress
// Called from RankingsPage with pre-fetched PRs, attributes, measurements + client config

// ── Constants ─────────────────────────────────────────────────────────────────

export const GOAL_TYPES = [
  { id: 'weight_loss',       label: 'Weight loss'          },
  { id: 'muscle_gain',       label: 'Muscle gain'          },
  { id: 'recomposition',     label: 'Body recomposition'   },
  { id: 'athletic',          label: 'Athletic performance' },
  { id: 'rehabilitation',    label: 'Rehabilitation / mobility' },
  { id: 'general',           label: 'General fitness'      },
]

export const DEFAULT_THRESHOLDS = {
  measurementPct: 3,   // % change to count as meaningful
  attributePts:   1,   // points change to count as meaningful
  prStaleDays:    30,  // days without new PR = stagnant
}

export const STATUS = {
  IMPROVING:    'improving',
  STAGNANT:     'stagnant',
  DECLINING:    'declining',
  NEEDS_ATTN:   'needs_attention',
  INSUFFICIENT: 'insufficient',
}

// Sam sees this; clients see CLIENT_LABELS
export const SAM_LABELS = {
  improving:         { text: 'Improving',        color: '#1D9E75', bg: '#E1F5EE', border: '#9FE1CB' },
  stagnant:          { text: 'Stagnant',          color: '#BA7517', bg: '#FAEEDA', border: '#FAC775' },
  declining:         { text: 'Declining',         color: '#D85A30', bg: '#FAECE7', border: '#F0997B' },
  needs_attention:   { text: 'Needs attention',   color: '#A32D2D', bg: '#FCEBEB', border: '#F7C1C1' },
  insufficient:      { text: 'Not enough data',   color: '#9a9a94', bg: '#F1EFE8', border: '#D3D1C7' },
}

export const CLIENT_LABELS = {
  improving:         { text: 'On track',           color: '#1D9E75', bg: '#E1F5EE', border: '#9FE1CB' },
  stagnant:          { text: 'Maintaining',         color: '#BA7517', bg: '#FAEEDA', border: '#FAC775' },
  declining:         { text: "Let's refocus here",  color: '#D85A30', bg: '#FAECE7', border: '#F0997B' },
  needs_attention:   { text: 'Building momentum',   color: '#7F77DD', bg: '#EEEDFE', border: '#CECBF6' },
  insufficient:      { text: null,                  color: '#9a9a94', bg: '#F1EFE8', border: '#D3D1C7' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const daysBetween = (dateStr1, dateStr2) => {
  const d1 = new Date(dateStr1), d2 = new Date(dateStr2)
  return Math.abs((d2 - d1) / 86400000)
}

const pctChange = (from, to) => from === 0 ? 0 : ((to - from) / Math.abs(from)) * 100

// Split entries into two 30-day windows relative to today
const splitWindows = (entries, dateKey = 'date') => {
  const now = new Date()
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30)
  const prev   = new Date(now); prev.setDate(prev.getDate() - 60)
  const current  = entries.filter(e => new Date(e[dateKey]) >= cutoff)
  const previous = entries.filter(e => new Date(e[dateKey]) >= prev && new Date(e[dateKey]) < cutoff)
  return { current, previous }
}

// ── Performance evaluation (PRs) ─────────────────────────────────────────────

export const evaluatePerformance = (prs, thresholds, goalType) => {
  if (!prs.length) return { status: STATUS.INSUFFICIENT, details: [] }

  // Group by exercise
  const byEx = {}
  prs.forEach(pr => {
    if (!byEx[pr.exerciseName]) byEx[pr.exerciseName] = []
    byEx[pr.exerciseName].push(pr)
  })

  const staleDays = thresholds?.prStaleDays ?? DEFAULT_THRESHOLDS.prStaleDays
  const today = new Date().toISOString().slice(0, 10)

  const details = Object.entries(byEx).map(([name, entries]) => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const daysSince = daysBetween(latest.date, today)
    const isCardio = latest.type === 'time' && !latest.exerciseName.toLowerCase().includes('plank')
    const hasRecent = daysSince <= staleDays

    // New PR in last window?
    const { current, previous } = splitWindows(sorted)
    let status
    if (current.length === 0 && sorted.length < 2) {
      status = STATUS.INSUFFICIENT
    } else if (!hasRecent) {
      status = STATUS.DECLINING
    } else if (current.length > 0 && previous.length > 0) {
      const bestCurrent  = isCardio ? Math.min(...current.map(e => e.value))  : Math.max(...current.map(e => e.value))
      const bestPrevious = isCardio ? Math.min(...previous.map(e => e.value)) : Math.max(...previous.map(e => e.value))
      const change = pctChange(bestPrevious, bestCurrent)
      const improved = isCardio ? change < -3 : change > 3
      const declined = isCardio ? change > 3  : change < -3
      status = improved ? STATUS.IMPROVING : declined ? STATUS.DECLINING : STATUS.STAGNANT
    } else {
      status = hasRecent ? STATUS.STAGNANT : STATUS.DECLINING
    }

    return { name, status, daysSince: Math.round(daysSince), latestValue: latest.value, unit: latest.unit, type: latest.type }
  })

  // Roll up: worst status wins
  const priority = [STATUS.NEEDS_ATTN, STATUS.DECLINING, STATUS.STAGNANT, STATUS.IMPROVING, STATUS.INSUFFICIENT]
  const counts = {}
  details.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1 })
  const overall = priority.find(s => counts[s]) || STATUS.INSUFFICIENT

  // Nuance: if most are improving but one is declining → needs_attention
  const total = details.filter(d => d.status !== STATUS.INSUFFICIENT).length
  const improving = counts[STATUS.IMPROVING] || 0
  const declining = (counts[STATUS.DECLINING] || 0) + (counts[STATUS.NEEDS_ATTN] || 0)
  const rolledUp = total === 0 ? STATUS.INSUFFICIENT
    : declining > 0 && improving > declining ? STATUS.NEEDS_ATTN
    : overall

  return { status: rolledUp, details }
}

// ── Physical evaluation (measurements) ───────────────────────────────────────

// Returns +1 (good direction), -1 (bad direction), 0 (neutral) per field given goal
const measurementDirection = (fieldId, goalType) => {
  const rules = {
    weight_loss:    { weight:-1, waist:-1, hips:-1, chest_bust:-1, shoulders:0, arms:-1, thighs:-1, calves:0 },
    muscle_gain:    { weight:+1, waist: 0, hips: 0, chest_bust:0,  shoulders:+1,arms:+1, thighs:+1, calves:+1 },
    recomposition:  { weight: 0, waist:-1, hips:-1, chest_bust:0,  shoulders:+1,arms:+1, thighs:+1, calves:0 },
    athletic:       { weight: 0, waist:-1, hips: 0, chest_bust:0,  shoulders:+1,arms:+1, thighs:+1, calves:0 },
    rehabilitation: { weight:-1, waist:-1, hips: 0, chest_bust:0,  shoulders:0, arms: 0, thighs: 0, calves:0 },
    general:        { weight:-1, waist:-1, hips:-1, chest_bust:0,  shoulders:0, arms:+1, thighs: 0, calves:0 },
  }
  return (rules[goalType] || rules.general)[fieldId] ?? 0
}

export const evaluatePhysical = (measurements, thresholds, goalType) => {
  if (measurements.length < 2) return { status: STATUS.INSUFFICIENT, details: [] }

  const threshold = thresholds?.measurementPct ?? DEFAULT_THRESHOLDS.measurementPct
  const { current, previous } = splitWindows(measurements)
  if (!current.length || !previous.length) return { status: STATUS.INSUFFICIENT, details: [] }

  // Use averages across each window
  const avg = (entries, field) => {
    const vals = entries.map(e => e.values?.[field]).filter(v => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const fields = ['weight','waist','hips','chest_bust','shoulders','arms','thighs','calves']
  const details = []

  for (const field of fields) {
    const curr = avg(current, field)
    const prev = avg(previous, field)
    if (curr == null || prev == null) continue

    const change = pctChange(prev, curr)
    const dir    = measurementDirection(field, goalType)
    let status

    if (Math.abs(change) < threshold) {
      status = STATUS.STAGNANT
    } else if (dir === 0) {
      status = STATUS.STAGNANT
    } else if (dir === +1) {
      status = change > 0 ? STATUS.IMPROVING : STATUS.DECLINING
    } else {
      status = change < 0 ? STATUS.IMPROVING : STATUS.DECLINING
    }

    details.push({ field, status, change: +change.toFixed(1), curr: +curr.toFixed(1) })
  }

  if (!details.length) return { status: STATUS.INSUFFICIENT, details: [] }

  const improving = details.filter(d => d.status === STATUS.IMPROVING).length
  const declining = details.filter(d => d.status === STATUS.DECLINING).length
  const total     = details.filter(d => d.status !== STATUS.INSUFFICIENT).length

  let overall
  if (total === 0)                             overall = STATUS.INSUFFICIENT
  else if (declining === 0 && improving > 0)   overall = STATUS.IMPROVING
  else if (improving > declining)              overall = STATUS.NEEDS_ATTN
  else if (improving === 0 && declining === 0) overall = STATUS.STAGNANT
  else if (declining >= improving)             overall = STATUS.DECLINING

  // Recomposition special case: need waist↓ AND (arms or thighs↑)
  if (goalType === 'recomposition') {
    const waistOk  = details.find(d => d.field === 'waist')?.status  === STATUS.IMPROVING
    const armsOk   = details.find(d => d.field === 'arms')?.status   === STATUS.IMPROVING
    const thighsOk = details.find(d => d.field === 'thighs')?.status === STATUS.IMPROVING
    overall = (waistOk && (armsOk || thighsOk)) ? STATUS.IMPROVING
            : (waistOk || armsOk || thighsOk)  ? STATUS.STAGNANT
            : STATUS.DECLINING
  }

  return { status: overall, details }
}

// ── Fitness evaluation (attribute scores) ─────────────────────────────────────

// Which attributes matter most per goal type
const priorityAttributes = {
  weight_loss:    ['Stamina','Endurance','Agility'],
  muscle_gain:    ['Strength','Power'],
  recomposition:  ['Strength','Stamina','Agility'],
  athletic:       ['Stamina','Endurance','Power','Agility','Coordination'],
  rehabilitation: ['Mobility','Flexibility','Balance'],
  general:        null, // all equal
}

export const evaluateFitness = (attributes, thresholds, goalType) => {
  if (attributes.length < 2) return { status: STATUS.INSUFFICIENT, details: [] }

  const threshold = thresholds?.attributePts ?? DEFAULT_THRESHOLDS.attributePts
  const { current, previous } = splitWindows(attributes)
  if (!current.length || !previous.length) return { status: STATUS.INSUFFICIENT, details: [] }

  const avgScores = (entries) => {
    const totals = {}, counts = {}
    entries.forEach(e => Object.entries(e.scores || {}).forEach(([k, v]) => {
      totals[k] = (totals[k] || 0) + v
      counts[k] = (counts[k] || 0) + 1
    }))
    return Object.fromEntries(Object.keys(totals).map(k => [k, totals[k] / counts[k]]))
  }

  const curr = avgScores(current)
  const prev = avgScores(previous)
  const priority = priorityAttributes[goalType] || null

  const details = Object.keys(curr).map(attr => {
    const c = curr[attr], p = prev[attr]
    if (p == null) return null
    const diff = c - p
    const status = Math.abs(diff) < threshold ? STATUS.STAGNANT
                 : diff > 0 ? STATUS.IMPROVING : STATUS.DECLINING
    return { attr, status, diff: +diff.toFixed(1), current: +c.toFixed(1), isPriority: priority ? priority.includes(attr) : true }
  }).filter(Boolean)

  if (!details.length) return { status: STATUS.INSUFFICIENT, details: [] }

  // Weight priority attributes more heavily
  const priorityDetails = priority ? details.filter(d => d.isPriority) : details
  const improving = priorityDetails.filter(d => d.status === STATUS.IMPROVING).length
  const declining = priorityDetails.filter(d => d.status === STATUS.DECLINING).length
  const total     = priorityDetails.length

  const overall = total === 0             ? STATUS.INSUFFICIENT
    : declining === 0 && improving > 0    ? STATUS.IMPROVING
    : improving > declining               ? STATUS.NEEDS_ATTN
    : improving === 0 && declining === 0  ? STATUS.STAGNANT
    : STATUS.DECLINING

  return { status: overall, details }
}

// ── Full client evaluation ─────────────────────────────────────────────────────

export const evaluateClient = (client, prs, attributes, measurements) => {
  const goalType   = client.goalType || 'general'
  const thresholds = client.evaluationSettings || DEFAULT_THRESHOLDS

  const performance = evaluatePerformance(prs, thresholds, goalType)
  const physical    = evaluatePhysical(measurements, thresholds, goalType)
  const fitness     = evaluateFitness(attributes, thresholds, goalType)

  // Overall: worst of the three non-insufficient dimensions
  const priority = [STATUS.DECLINING, STATUS.NEEDS_ATTN, STATUS.STAGNANT, STATUS.IMPROVING]
  const active = [performance, physical, fitness].filter(d => d.status !== STATUS.INSUFFICIENT)
  const overall = active.length === 0 ? STATUS.INSUFFICIENT
    : priority.find(s => active.some(d => d.status === s)) || STATUS.IMPROVING

  return { overall, performance, physical, fitness, goalType }
}
