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

// ── Billing cycle helpers ─────────────────────────────────────────────────────

// Returns { cycleStart: 'DD-MM-YYYY', cycleEnd: 'DD-MM-YYYY', cycleIndex: number }
// or null if targetDate is before startDate or inputs are invalid.
export const getCycleWindow = (startDateStr, targetDateStr) => {
  const start  = parseDMY(startDateStr)
  const target = parseDMY(targetDateStr)
  if (!start || !target) return null
  const msPerDay   = 86400000
  const daysSince  = Math.floor((target - start) / msPerDay)
  if (daysSince < 0) return null
  const cycleIndex  = Math.floor(daysSince / 28)
  const windowStart = new Date(start.getTime() + cycleIndex * 28 * msPerDay)
  const windowEnd   = new Date(windowStart.getTime() + 27 * msPerDay)
  return {
    cycleStart: formatDMY(windowStart),
    cycleEnd:   formatDMY(windowEnd),
    cycleIndex,
  }
}

// Returns 'paid' | 'partial' | 'overdue' | 'unpaid'
export const getPaymentStatus = (client) => {
  // Classes-based: use cycle index to determine if current cycle is paid
  if (client.cycleType === 'classes') {
    const currentIndex  = client.currentCycleStartDate ? (client.currentCycleIndex ?? 0) : 0
    const lastPaidIndex = client.lastPaidCycleIndex ?? -1
    const balance       = client.balance ?? 0
    const carryForward  = client.carryForwardAmount ?? 0
    const cyclePaid     = lastPaidIndex >= currentIndex
    // carryForward is folded into effectiveFee, so balance >= 0 means fully settled
    const carrySettled  = carryForward === 0 || balance >= 0
    if (cyclePaid && carrySettled) return 'paid'
    if (cyclePaid || carryForward > 0) return 'partial'
    return 'unpaid'
  }

  if (!client.billingStartDate && !client.startDate) return 'unpaid'
  const anchorDate = client.billingStartDate || client.startDate
  const todayStr   = formatDMY(new Date())
  const cycle      = getCycleWindow(anchorDate, todayStr)
  if (!cycle) return 'unpaid'

  const { cycleStart } = cycle
  const balance        = client.balance ?? 0
  const fee            = client.monthlyFee || 0

  // Paid: last payment covers this cycle and balance ≥ 0
  if (client.lastPaidCycleStart === cycleStart && balance >= 0) return 'paid'

  // Partial: something paid but less than full fee
  if (balance > 0 && balance < fee) return 'partial'

  // Overdue: 14+ days into cycle, nothing paid
  const cycleStartDate = parseDMY(cycleStart)
  const today          = parseDMY(todayStr)
  const daysSince      = cycleStartDate ? Math.floor((today - cycleStartDate) / 86400000) : 0
  if (daysSince >= 14) return 'overdue'

  return 'unpaid'
}

// Formats a number as ₹X,XX,XXX (Indian locale)
export const formatINR = (amount) =>
  '₹' + Number(amount || 0).toLocaleString('en-IN')

// DD-MM-YYYY ↔ DD/MM/YYYY (for text date inputs — avoids browser locale on type="date")
export const dmy2display = (dmy)     => (dmy  || '').replace(/-/g, '/')
export const display2dmy = (display) => (display || '').replace(/\//g, '-')

// Returns cycle info for a classes-based client.
// attendanceRecords: array of { date: 'DD-MM-YYYY' }
// cycleIndex is now manually advanced by Sam — not derived from attendance count.
export const getClassCycleInfo = (client, attendanceRecords = []) => {
  const perCycle    = client.classesPerCycle || 10
  const cycleStart  = parseDMY(client.currentCycleStartDate) || parseDMY(client.startDate)
  const cycleIndex  = client.currentCycleIndex ?? 0
  if (!cycleStart) return { cycleIndex, attendedThisCycle: 0, classesPerCycle: perCycle, progress: 0, cycleComplete: false }
  const attended = attendanceRecords
    .filter(r => { const d = parseDMY(r.date); return d && d >= cycleStart })
    .length
  const cycleComplete = attended >= perCycle
  return { cycleIndex, attendedThisCycle: attended, classesPerCycle: perCycle, progress: Math.min(1, attended / perCycle), cycleComplete }
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
