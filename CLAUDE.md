# CLAUDE.md — Coach App

Context file for future Claude sessions. Paste this at the start of a new conversation to resume work.

---

## What this project is

A mobile-first PWA for a single fitness coach (Sam) to track:
- Client list with status management (active / paused / deactivated) and payment tracking
- Personal records (PRs) for weight, time, and rep-based exercises
- Client attribute scores (mobility, flexibility, stamina, etc.) on a 1–10 scale
- Body measurements with delta tracking between sessions
- Progressive ranking system — evaluates each client monthly/weekly across three dimensions
- Shareable client progress card (screenshot-ready)
- Progress report (charts, radar, trend lines) accessible via client manage modal
- Settings: seed 10 dummy clients, flush dummy data, flush all data

## Tech stack

- React 18 + Vite — no TypeScript, no Tailwind, plain CSS with CSS variables
- Firebase Auth — Google sign-in, single user
- Firestore — subcollection structure per client
- Recharts — radar chart, line charts
- date-fns — date formatting
- No router — tab state managed in App.jsx via useState

## Nav tabs (6 total)

Clients · PRs · Attributes · Measurements · Rankings · Settings (gear icon)

## Client status model

| Status        | Clients tab              | ClientPicker           | Data     |
|---------------|--------------------------|------------------------|----------|
| `active`      | Active tab               | Yes                    | Retained |
| `paused`      | Paused/Off tab           | Yes (labelled)         | Retained |
| `deactivated` | Paused/Off tab           | Yes (labelled)         | Retained |
| deleted       | Removed                  | No                     | Wiped    |

## Rankings & evaluation system

### Files
- `src/lib/evaluate.js` — entire evaluation engine (pure functions, no Firebase)
- `src/pages/RankingsPage.jsx` — overview list + client detail + shareable card

### Goal types (stored as `goalType` on client doc)
weight_loss · muscle_gain · recomposition · athletic · rehabilitation · general

### Three evaluation dimensions
| Dimension   | Source data   | Cadence | Logic |
|-------------|--------------|---------|-------|
| Performance | PRs          | Weekly  | New PR in window = improving; no PR in N days = declining |
| Physical    | Measurements | Monthly | % change vs previous 30-day window, direction depends on goal |
| Fitness     | Attributes   | Monthly | Score point change vs previous 30-day window |

### Status values
improving · stagnant · declining · needs_attention · insufficient (not enough data)

### Label mapping
| Internal         | Sam sees          | Client sees           |
|-----------------|-------------------|-----------------------|
| improving       | Improving         | On track              |
| stagnant        | Stagnant          | Maintaining           |
| declining       | Declining         | Let's refocus here    |
| needs_attention | Needs attention   | Building momentum     |
| insufficient    | Not enough data   | (hidden)              |

### Per-client thresholds (stored as `evaluationSettings` on client doc)
- `measurementPct` — % change to count as meaningful (default 3, range 1–10)
- `attributePts` — score points to count as meaningful (default 1, range 1–3)
- `prStaleDays` — days without new PR before declining (default 30, range 14–60)

Thresholds edited in the client's manage modal → "Evaluation settings".

### Recomposition special case
waist↓ AND (arms↑ OR thighs↑) = improving. Only one = stagnant. Neither = declining.

## Progress report

Moved from dedicated tab into the client manage modal (three-dot menu → "View progress report").
Implemented as a shared component: `src/components/ProgressReport.jsx`.
Shows: stat summary, latest measurements, attribute radar chart, PR trend line, weight trend.

## Shareable card

In Rankings → client detail → "Share card" button (client view toggle must be active).
Generates a screenshot-ready card with client-facing language (warmer labels).

## Firestore data structure

```
/clients/{clientId}
  name, goal, goalType, dob, notes
  status: 'active' | 'paused' | 'deactivated'
  paymentStatus: 'paid' | 'unpaid'
  evaluationSettings: { measurementPct, attributePts, prStaleDays }
  isDummy: boolean
  createdAt: Timestamp

/clients/{clientId}/prs/{prId}
  exerciseId, exerciseName, value, type, unit, period, date, notes, createdAt

/clients/{clientId}/attributes/{entryId}
  date, scores: { Mobility: 7, ... }, createdAt

/clients/{clientId}/measurements/{entryId}
  date, values: { weight: 65, waist: 72, ... }, createdAt

/customExercises/{exerciseId}
  id, name, category, type, unit
```

## CSS design tokens (src/index.css)

- `--accent` #7F77DD · `--teal` #1D9E75 · `--coral` #D85A30 · `--amber` #BA7517
- `--bg` #f7f7f5 · `--surface` #fff · `--border` #e5e3dd
- `--r-sm` 8px · `--r-md` 12px · `--r-lg` 16px

## Key files

| File | Purpose |
|------|---------|
| `src/lib/evaluate.js`           | Evaluation engine — pure functions |
| `src/lib/firebase.js`           | Firebase init — paste config here  |
| `src/lib/firestore.js`          | All Firestore helpers + seed/flush |
| `src/data/exercises.js`         | Built-in exercises, attributes, measurements |
| `src/data/seed.js`              | 10 dummy clients with full data    |
| `src/components/ProgressReport.jsx` | Reusable report component     |
| `src/pages/RankingsPage.jsx`    | Rankings overview + client detail  |
| `src/pages/ClientsPage.jsx`     | Clients list, manage modal (edit/pause/thresholds/report) |
| `src/pages/SettingsPage.jsx`    | Seed / flush controls              |

## Patterns

- Pages receive `{ clientId, setClientId }` props from App.jsx (except RankingsPage — standalone)
- Modals are bottom-sheet style (`modal-backdrop` + `modal` CSS classes)
- All Firestore ops in `src/lib/firestore.js`
- evaluate.js is pure — no Firebase, fully testable
- ManageClientModal has internal view state: 'menu' | 'edit' | 'thresholds' | 'report'

## Known limitations / future ideas

- Rankings loads all client data on mount (parallel fetches) — fine for 30 clients, may need pagination at scale
- Evaluation windows are always relative to today — no historical snapshots
- Shareable card is screenshot-only — could add jsPDF for real PDF export
- Attribute list hardcoded in DEFAULT_ATTRIBUTES — could make per-client
- No offline support — could add vite-plugin-pwa + workbox
- `src/hooks/` reserved for future custom hooks

## Deployment

```bash
npm run build && firebase deploy
# Live at https://YOUR_PROJECT_ID.web.app
```
