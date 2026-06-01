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
  const palette = ['#7F77DD','#1D9E75','#D85A30','#D4537E','#378ADD','#639922','#BA7517','#E24B4A']
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
