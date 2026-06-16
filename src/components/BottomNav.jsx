export default function BottomNav({ tab, setTab, onSettings, onClientsTab }) {
  const items = [
    { key:'clients',      label:'Clients',    Icon: PeopleIcon, onClick: onClientsTab },
    { key:'prs',          label:'PRs',        Icon: TrophyIcon  },
    { key:'attributes',   label:'Attributes', Icon: RadarIcon   },
    { key:'measurements', label:'Measures',   Icon: RulerIcon   },
    { key:'rankings',     label:'Rankings',   Icon: RankingsIcon},
    { key:'attendance',   label:'Attendance', Icon: AttendIcon  },
    { key:'revenue',      label:'Revenue',    Icon: RevenueIcon },
  ]
  return (
    <nav className="bottom-nav">
      {items.map(({ key, label, Icon, onClick }) => (
        <button key={key} className={`nav-item${tab === key ? ' active' : ''}`} onClick={onClick || (() => setTab(key))}>
          <Icon />
          {label}
        </button>
      ))}
      <button className="nav-item" onClick={onSettings} aria-label="Settings">
        <SettingsIcon />
        Settings
      </button>
    </nav>
  )
}

const PeopleIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const TrophyIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="11"/><path d="M7 4H17l-1 7H8L7 4z"/><path d="M5 4H3s0 7 4 7"/><path d="M19 4h2s0 7-4 7"/></svg>
const RadarIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 19 7 19 17 12 22 5 17 5 7"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="5" y1="7" x2="19" y2="17"/><line x1="19" y1="7" x2="5" y2="17"/></svg>
const RulerIcon    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 17L17 2l5 5L7 22z"/><line x1="8" y1="14" x2="10" y2="12"/><line x1="11" y1="11" x2="13" y2="9"/><line x1="14" y1="8" x2="16" y2="6"/></svg>
const RankingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
const AttendIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
const RevenueIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a2.5 2.5 0 0 0-5 0c0 1.5 1 2 2.5 2.5S15 13 15 14.5a2.5 2.5 0 0 1-5 0"/><line x1="12" y1="6.5" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="17.5"/></svg>
const SettingsIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
