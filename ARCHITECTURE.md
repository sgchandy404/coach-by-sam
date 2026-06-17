# Architecture — Coach by Sam

Technical reference for the codebase. Covers data models, key design decisions, patterns, and extension points.

---

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 + Vite | No TypeScript, no UI framework |
| Styling | Plain CSS + custom properties | No Tailwind — full control via design tokens |
| Charts | Recharts | Radar chart, line charts |
| Auth | Firebase Auth — Google Sign-In | Single authorised user (one coach) |
| Database | Firestore | Subcollection structure per client |
| Dates | date-fns | Formatting + arithmetic |
| Routing | None | Tab state via `useState` in `App.jsx` |

---

## Application structure

```
src/
├── components/
│   ├── BottomNav.jsx        # Fixed 7-tab navigation bar
│   ├── ClientPicker.jsx     # Shared client selector (used by PRs, Attributes, Measurements)
│   ├── PageLoader.jsx       # Full-screen branded loader + exported BrandMark component
│   └── ProgressReport.jsx   # Reusable report: radar chart, PR trends, weight trend
├── data/
│   ├── exercises.js         # Built-in exercise library, DEFAULT_ATTRIBUTES, DEFAULT_MEASUREMENTS
│   └── seed.js              # 10 dummy clients with realistic attendance, PRs, attributes
├── lib/
│   ├── evaluate.js          # Pure evaluation engine — zero Firebase imports
│   ├── firebase.js          # Firebase app init — reads from VITE_* env vars
│   ├── firestore.js         # All Firestore read/write helpers + seed/flush utilities
│   └── utils.js             # getInitials, avatarColor, parseDMY, formatDMY, getMonthWindow, …
├── pages/
│   ├── AttendancePage.jsx   # Monthly calendar grid + day-sheet modal
│   ├── AttributesPage.jsx   # Attribute score logging
│   ├── ClientsPage.jsx      # Client list + full ManageClientModal (billing, payments, history)
│   ├── MeasurementsPage.jsx # Body measurement logging with deltas
│   ├── PRLogPage.jsx        # PR log + custom exercise management + edit/delete
│   ├── RankingsPage.jsx     # Evaluation overview + client detail + shareable card
│   ├── RevenuePage.jsx      # Monthly revenue dashboard — expected vs collected
│   └── SettingsPage.jsx     # Seed / flush controls
├── App.jsx                  # Auth gate, tab state, iOS redirect handling
├── index.css                # Global styles and CSS design tokens
└── main.jsx                 # React entry point
```

---

## Navigation

Seven tabs, no router. `App.jsx` holds `tab` state and renders the active page conditionally:

```
Clients · PRs · Attributes · Measurements · Rankings · Attendance · Revenue
```

Settings opens as a modal overlay triggered from the nav bar gear icon, not a tab.

Pages that operate on a selected client receive `{ clientId, setClientId }` as props from `App.jsx`. `RankingsPage`, `AttendancePage`, and `RevenuePage` are standalone — they load their own data.

---

## Client lifecycle

```
         ┌─────────────┐
         │   active    │◄──── reactivate (start date resets to today)
         └──────┬──────┘
                │ pause / deactivate
        ┌───────┴────────┐
        ▼                ▼
   ┌─────────┐    ┌─────────────┐
   │ paused  │    │ deactivated │
   └─────────┘    └─────────────┘
        │                │
        └───────┬────────┘
                │ delete
                ▼
          (data wiped)
```

| Status | Clients tab | ClientPicker | Data |
|--------|-------------|--------------|------|
| `active` | Active tab | Yes | Retained |
| `paused` | Paused/Off tab | Yes (labelled) | Retained |
| `deactivated` | Paused/Off tab | Yes (labelled) | Retained |
| deleted | Gone | No | Wiped |

**Reactivation flow:** tapping Reactivate shows a confirmation modal (not a `window.confirm`) explaining that `startDate` will be reset to today. On confirm, `startDate` is overwritten and the previous value is saved as `originalStartDate` — written once, never overwritten on subsequent reactivations. This ensures attendance cycle calculations anchor to the actual return date, not the original join date.

---

## Firestore data model

```
/clients/{clientId}
  name, goal, goalType, dob, notes
  status:                'active' | 'paused' | 'deactivated'
  membershipType:        3 | 4 | 5              // classes per week (time-based)
  cycleType:             'time' | 'classes'
  classesPerCycle:       number | null           // classes-based only
  billingType:           'monthly' | 'per_session'
  monthlyFee:            number | null
  sessionRate:           number | null           // per-session billing only
  startDate:             'DD-MM-YYYY'            // resets on reactivation
  billingStartDate:      'DD-MM-YYYY'            // anchor for billing cycle; updated on billing change
  originalStartDate:     'DD-MM-YYYY'            // preserved from first join
  balance:               number                  // totalPaid − effectiveFee (current period)
  carryForwardAmount:    number                  // outstanding from previous billing period
  lastPaidCycleStart:    'DD-MM-YYYY' | null     // time-based payment tracking
  lastPaidCycleEnd:      'DD-MM-YYYY' | null
  lastPaidCycleIndex:    number | null           // classes-based payment tracking
  currentCycleIndex:     number | null           // classes-based: manually advanced
  currentCycleStartDate: 'DD-MM-YYYY' | null     // start of current classes cycle
  attendedThisCycle:     number | null           // denormalised; updated on attendance toggle
  evaluationSettings:    { measurementPct, attributePts, prStaleDays }
  isDummy:               boolean
  createdAt:             Timestamp

/clients/{clientId}/billingPeriods/{periodId}
  startDate:       'DD-MM-YYYY'
  endDate:         'DD-MM-YYYY' | null    // null = currently active period
  cycleType:       'time' | 'classes'
  membershipType:  number | null
  classesPerCycle: number | null
  billingType:     'monthly' | 'per_session'
  monthlyFee:      number | null
  sessionRate:     number | null
  label:           null                   // reserved for future custom labels
  createdAt:       Timestamp

/clients/{clientId}/payments/{paymentId}
  amount:      number
  date:        'DD-MM-YYYY'
  cycleStart:  'DD-MM-YYYY' | null
  cycleEnd:    'DD-MM-YYYY' | null
  cycleIndex:  number | null              // classes-based cycles only
  notes:       string | null
  createdAt:   Timestamp

/clients/{clientId}/prs/{prId}
  exerciseId, exerciseName, value, type, unit, date, notes, createdAt

/clients/{clientId}/attributes/{entryId}
  date, scores: { Mobility: 7, Flexibility: 5, … }, createdAt

/clients/{clientId}/measurements/{entryId}
  date, values: { weight: 65, waist: 72, … }, createdAt

/clients/{clientId}/attendance/{dateString}
  date: 'DD-MM-YYYY', createdAt: Timestamp
  // doc ID = date string — enforces uniqueness structurally

/customExercises/{exerciseId}
  id, name, category, type, unit
```

All Firestore operations go through `src/lib/firestore.js`. No page imports `db` directly.

---

## Billing model

### Cycle types

**Time-based (`cycleType: 'time'`)** — 28-day rolling cycles anchored to `billingStartDate`. Expected classes = `membershipType × 4`. Payment status compares `lastPaidCycleStart` to the current cycle window computed by `getCycleWindow()`.

**Classes-based (`cycleType: 'classes'`)** — a cycle ends after `classesPerCycle` attended sessions. The coach manually advances to the next cycle ("Start next cycle"). Payment status compares `lastPaidCycleIndex` to `currentCycleIndex`. `attendedThisCycle` is denormalised on the client doc and updated on every attendance toggle via `recomputeClassCycleFields`.

### Billing types

| `billingType` | Fee field | Display balance formula |
|---------------|-----------|------------------------|
| `monthly` | `monthlyFee` | `balance` |
| `per_session` (classes) | `sessionRate` | `balance + (classesPerCycle − attendedThisCycle) × sessionRate` |

The per-session `displayBalance` formula accounts for sessions not yet attended in the current cycle — showing the total projected outstanding rather than just what has been underpaid so far.

### Payment status — 4 states

`paid` · `partial` · `overdue` · `unpaid`

Time-based status is cycle-aware: `lastPaidCycleStart` must match the current cycle start for `paid`. Classes-based status compares cycle indexes and carries `carryForwardAmount` into the check.

### Carry-forward across billing changes

When a mid-cycle billing change creates an outstanding balance:

- **Write off** — balance forgiven; new period starts with `carryForwardAmount = 0`
- **Carry forward** — `carryForwardAmount` is stored on the client doc and folded into `effectiveFee` in `recomputeClientPaymentFields`. It drains passively as payments accumulate. It is **not auto-cleared** when `balance >= 0` — the `displayBalance` formula for per-session clients depends on it persisting.

### Billing history

Each client has a `billingPeriods` subcollection. Periods are created on client add and on every billing change (old period gets `endDate`, new period is created). Payments are mapped to periods at render time by date range — no extra field on payment docs. Clients with no `billingPeriods` subcollection fall back to a synthetic period derived from their current client doc fields (in-memory only, never written).

---

## Attendance model

Attendance is toggled per client per day. Each attended date is a single Firestore document whose **ID is the date string** (`DD-MM-YYYY`). Toggling present writes the doc; toggling absent deletes it. No save button — writes happen immediately on tap.

For classes-based clients, toggling attendance also calls `recomputeClassCycleFields`, which fetches all attendance records for the client, recomputes `attendedThisCycle` via `getClassCycleInfo`, and updates the client doc. This keeps the denormalised field in sync for card-list display without loading full attendance on every list render.

The global calendar (AttendancePage) loads all client records on mount and shows a count badge per day. Tapping a day opens a day-sheet modal listing all active + paused clients with their toggle state.

### 28-day billing cycles

Expected attendance counts use **28-day rolling cycles anchored to each client's `billingStartDate`**, not calendar months. This solves a real problem: a client who joins mid-month would show artificially low attendance against a full calendar-month expectation.

`getMonthWindow(startDateStr, targetDateStr)` in `src/lib/utils.js` returns `{ windowStart, windowEnd }` for the 28-day cycle containing any target date:

```js
const msPerDay    = 86400000
const daysSince   = Math.floor((target - start) / msPerDay)
const cycleIndex  = Math.floor(daysSince / 28)
const windowStart = new Date(start + cycleIndex * 28 * msPerDay)
const windowEnd   = new Date(windowStart + 27 * msPerDay)
```

Expected per cycle = `membershipType × 4`.

---

## Evaluation engine

`src/lib/evaluate.js` — **pure functions only, no Firebase imports**. Takes plain arrays as input, returns status objects. Fully testable without mocking.

### Four dimensions

| Dimension | Source | Cadence | Logic |
|-----------|--------|---------|-------|
| Performance | PRs | Weekly | New PR in window → improving; no PR for N days → declining |
| Physical | Measurements | Monthly | % change vs previous 30-day window; direction depends on `goalType` |
| Fitness | Attributes | Monthly | Score point change vs previous 30-day window |
| Attendance | Attendance docs | Monthly | Attended / expected (membershipType × 4) |

### Status values

`improving` · `stagnant` · `declining` · `needs_attention` · `insufficient`

### Goal types

`weight_loss` · `muscle_gain` · `recomposition` · `athletic` · `rehabilitation` · `general`

Physical dimension direction is goal-aware. Recomposition special case: waist↓ AND (arms↑ OR thighs↑) = improving; only one direction = stagnant; neither = declining.

### Per-client thresholds (`evaluationSettings` on client doc)

| Field | Default | Range | Meaning |
|-------|---------|-------|---------|
| `measurementPct` | 3% | 1–10 | Min % change to count as meaningful |
| `attributePts` | 1 pt | 1–3 | Min score point change to count as meaningful |
| `prStaleDays` | 30 days | 14–60 | Days without a new PR before performance → declining |

### Label mapping (coach vs client)

| Internal | Coach sees | Client sees |
|----------|------------|-------------|
| `improving` | Improving | On track |
| `stagnant` | Stagnant | Maintaining |
| `declining` | Declining | Let's refocus here |
| `needs_attention` | Needs attention | Building momentum |
| `insufficient` | Not enough data | (hidden) |

---

## ManageClientModal — internal view state

`ClientsPage.jsx` renders one modal component that handles all client management via internal `view` state. Each view is an early return so views never render simultaneously:

```
'menu'               — action list (default)
'edit'               — edit profile form (corrections only — does not create a new billing period)
'change-billing'     — billing type / fee / cycle change (closes current period, opens a new one)
'thresholds'         — evaluation settings sliders
'reactivate-confirm' — confirmation before status change
'report'             — inline ProgressReport component
'attendance'         — per-client attendance mini-calendar
```

**Edit vs Change billing:** the Edit view is for correcting typos and profile fields. It does not create a new billing period. Change billing is the intentional flow for switching billing type, fee, or cycle model — it closes the open period, opens a new one with the chosen start date, and prompts the coach to handle any outstanding balance.

---

## CSS design tokens

Defined in `src/index.css` `:root`. A `@media (prefers-color-scheme: dark)` block re-declares the same tokens to force the light theme on dark-mode devices.

```css
--bg:           #F0EDE7   /* warm off-white page background */
--surface:      #FFFFFF   /* card / modal surface */
--border:       #E2DDD6
--border-mid:   #CBC6BD

--text:         #18160F   /* primary text */
--text-2:       #6B6660   /* secondary text */
--text-3:       #9E9890   /* muted / hint text */

--accent:       #1AAF96   /* teal — primary action colour */
--accent-light: #DCF5EF
--accent-text:  #0B6B5A

--teal:         #1AAF96   /* positive states */
--amber:        #D4900A   /* warning / unpaid */
--coral:        #E05545   /* negative / error */
--purple:       #7C6BCC   /* needs_attention */

--r-sm: 10px  --r-md: 14px  --r-lg: 20px
```

---

## Auth — iOS handling

Standard `signInWithPopup` fails silently on iOS Chrome/Safari (WKWebView blocks cross-origin popups). The fix has two parts:

1. **`initializeAuth` with persistence set at init time** — not via `setPersistence()` which runs too late:
   ```js
   initializeAuth(app, {
     persistence: browserLocalPersistence,
     popupRedirectResolver: browserPopupRedirectResolver,
   })
   ```
2. **iOS detection → `signInWithRedirect`** — user-agent check in `App.jsx` switches to redirect flow on iOS devices. `getRedirectResult(auth)` is awaited before the `onAuthStateChanged` subscription is set up.

---

## Known limitations & future ideas

| Area | Current state | Possible extension |
|------|--------------|-------------------|
| Rankings data load | Fetches all client data on mount in parallel | Pagination / lazy load at scale |
| Evaluation snapshots | Windows always relative to today | Historical snapshot model |
| Shareable card | Screenshot only | jsPDF for real PDF export |
| Attribute list | Hardcoded in `DEFAULT_ATTRIBUTES` | Per-client custom attributes |
| Offline support | None | vite-plugin-pwa + Workbox |
| Multi-coach | Single UID in Firestore rules | Full auth + tenant model |
| `src/hooks/` | Empty — reserved | Custom hooks as complexity grows |
