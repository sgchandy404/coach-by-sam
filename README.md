# Coach by Sam

A mobile-first Progressive Web App for a personal fitness coach to manage clients, track progress, and evaluate performance — all from a phone.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%2B%20Auth-FFCA28?logo=firebase&logoColor=black)

---

## Features

| Module | What it does |
|--------|-------------|
| **Clients** | Active / paused / deactivated lifecycle, smart reactivation with start-date reset, payment status |
| **PR Log** | Personal records per exercise (weight, time, reps), custom exercise support, weekly/monthly cadence |
| **Attributes** | Fitness qualities (mobility, stamina, flexibility, etc.) scored 1–10 per session |
| **Measurements** | Body measurements over time with delta indicators between sessions |
| **Attendance** | Global calendar view, per-day class toggling, 28-day billing cycles anchored to each client's start date |
| **Rankings** | Automated evaluation across Performance, Physical, Fitness, and Attendance dimensions with coach/client label modes |
| **Progress Report** | Radar chart, PR trend lines, weight trend — accessible from each client's manage modal |
| **Settings** | Seed 10 dummy clients, flush dummy data, flush all data |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite — no TypeScript, no UI framework |
| Styling | Plain CSS with custom design tokens |
| Charts | Recharts (radar, line charts) |
| Auth | Firebase Authentication — Google Sign-In, single authorised user |
| Database | Firebase Firestore — subcollection structure per client |
| Hosting | Firebase Hosting |
| Dates | date-fns |

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/sgchandy404/coach-by-sam.git
cd coach-by-sam
npm install
```

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**
2. Enable **Authentication** → Sign-in method → **Google**
3. Enable **Firestore Database** (start in production mode)
4. Register a **Web app** → copy the config values

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Firebase project values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### 4. Set Firestore security rules

In the Firebase console → Firestore → **Rules**, restrict access to your Google account UID only:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == "YOUR_GOOGLE_UID_HERE";
    }
  }
}
```

To find your UID: sign in to the app once, then check Firebase Console → Authentication → Users.

### 5. Run locally

```bash
npm run dev
# http://localhost:5173
```

### 6. Deploy

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # point to dist/, single-page app: yes
npm run build
firebase deploy
```

---

## Project structure

```
src/
├── components/
│   ├── BottomNav.jsx        # Fixed tab bar (6 tabs)
│   ├── ClientPicker.jsx     # Shared client selector
│   ├── PageLoader.jsx       # Full-screen branded loader + BrandMark
│   └── ProgressReport.jsx   # Reusable report (radar, trends, stats)
├── data/
│   ├── exercises.js         # Built-in exercise library, attributes, measurements
│   └── seed.js              # 10 dummy clients with full data
├── lib/
│   ├── evaluate.js          # Pure evaluation engine (no Firebase dependency)
│   ├── firebase.js          # Firebase init — reads from env vars
│   ├── firestore.js         # All Firestore helpers + seed/flush
│   └── utils.js             # Formatting, avatar colours, date helpers
├── pages/
│   ├── AttendancePage.jsx   # Calendar + day-sheet attendance logging
│   ├── AttributesPage.jsx   # Attribute scoring
│   ├── ClientsPage.jsx      # Client list + manage modal
│   ├── MeasurementsPage.jsx # Body measurements
│   ├── PRLogPage.jsx        # Personal records
│   ├── RankingsPage.jsx     # Rankings overview + client detail + share card
│   └── SettingsPage.jsx     # Seed / flush controls
├── App.jsx                  # Auth gate, tab state, iOS sign-in handling
├── index.css                # Global styles and CSS design tokens
└── main.jsx                 # React entry point
```

---

## Evaluation engine

`src/lib/evaluate.js` is a pure module (no Firebase, fully testable) that scores each client across four dimensions:

| Dimension | Source | Cadence |
|-----------|--------|---------|
| Performance | PRs | Weekly — new PR = improving, no PR in N days = declining |
| Physical | Measurements | Monthly — % change vs previous 30-day window |
| Fitness | Attributes | Monthly — score point change vs previous 30-day window |
| Attendance | Attendance records | Monthly — attended / expected based on membership type |

Status values: `improving` · `stagnant` · `declining` · `needs_attention` · `insufficient`

Per-client thresholds (measurement %, attribute pts, PR stale days) are configurable from each client's manage modal.

---

## Attendance cycles

Attendance is tracked on **28-day rolling cycles anchored to each client's start date** — not calendar months. When a client is reactivated after a pause, their start date resets to the resumption date (with the original preserved as `originalStartDate` for reference).

---

## Add to home screen

Deploy the app, then in Chrome on Android/iOS: tap the menu → **Add to Home Screen**. Runs as a standalone app with no browser chrome.

---

## Branch structure

```
dev      ← integration branch; all feature branches cut from here
staging  ← pre-production
prod     ← production
```

Feature branches follow the pattern `feat/<name>`, cut from `dev` and merged back via no-FF merge.
