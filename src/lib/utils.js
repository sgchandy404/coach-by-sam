export const formatTime = (totalSec) => {
  if (!totalSec) return '—'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export const formatValue = (value, type, unit) => {
  if (value == null) return '—'
  if (type === 'time') return formatTime(value)
  return `${value} ${unit}`
}

export const getInitials = (name) =>
  (name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

export const avatarColor = (name) => {
  // Warm earthy palette
  const palette = [
    '#C4633A', '#5C7A4E', '#A8720A', '#7A4E2D',
    '#8B6B4A', '#3D6B5C', '#B84C2A', '#6B5C3E',
    '#4E7A6B', '#8B4513',
  ]
  let hash = 0
  for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

export const groupBy = (arr, key) =>
  arr.reduce((acc, item) => {
    const k = item[key] || 'Other'
    acc[k] = acc[k] || []
    acc[k].push(item)
    return acc
  }, {})

// ── Date helpers (DD-MM-YYYY format used throughout the app) ──────────────────

export const parseDMY = (str) => {
  if (!str) return null
  const [d, m, y] = str.split('-').map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

export const formatDMY = (date) => {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}-${m}-${date.getFullYear()}`
}

// Convert DD-MM-YYYY → YYYY-MM-DD for <input type="date">
export const toHTMLDate = (ddmmyyyy) => {
  if (!ddmmyyyy) return ''
  const [d, m, y] = ddmmyyyy.split('-')
  return `${y}-${m}-${d}`
}

// Convert YYYY-MM-DD → DD-MM-YYYY from <input type="date">
export const fromHTMLDate = (yyyymmdd) => {
  if (!yyyymmdd) return ''
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}-${m}-${y}`
}

// Returns { windowStart: Date, windowEnd: Date } for the 28-day cycle
// anchored to startDate that contains targetDate.
// Returns null if targetDate is before startDate or inputs are invalid.
export const getMonthWindow = (startDateStr, targetDateStr) => {
  const start  = parseDMY(startDateStr)
  const target = parseDMY(targetDateStr)
  if (!start || !target) return null
  const msPerDay   = 86400000
  const daysSince  = Math.floor((target - start) / msPerDay)
  if (daysSince < 0) return null
  const cycleIndex  = Math.floor(daysSince / 28)
  const windowStart = new Date(start.getTime() + cycleIndex * 28 * msPerDay)
  const windowEnd   = new Date(windowStart.getTime() + 27 * msPerDay)
  return { windowStart, windowEnd }
}

// Next Monday from today as DD-MM-YYYY
export const nextMondayDMY = () => {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon…
  const daysUntil = day === 0 ? 1 : 8 - day
  const next = new Date(now)
  next.setDate(now.getDate() + daysUntil)
  return formatDMY(next)
}
