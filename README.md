# Coach by Sam

A mobile-first PWA for fitness coaches to track client progress, PRs, measurements, and payments.

## Features

- **Clients** — add/remove clients, toggle paid/unpaid status, unpaid banner alert
- **PR log** — log personal records for weight, time, and rep-based exercises; custom exercises supported
- **Attributes** — rate client fitness qualities (mobility, flexibility, stamina, etc.) on a 1–10 slider
- **Measurements** — log body measurements with delta indicators between sessions
- **Progress report** — radar chart, PR trend lines, weight trend, shareable via print/PDF

## Tech stack

| Layer    | Choice                          |
|----------|---------------------------------|
| Frontend | React 18 + Vite                 |
| Styling  | Custom CSS (no framework)       |
| Charts   | Recharts                        |
| Auth     | Firebase Authentication (Google)|
| Database | Firebase Firestore              |
| Hosting  | Firebase Hosting (free tier)    |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add your Firebase config
#    Edit src/lib/firebase.js and paste your project config

# 3. Run locally
npm run dev
# Opens at http://localhost:5173

# 4. Build for production
npm run build

# 5. Deploy
firebase deploy
```

See [SETUP.md](./SETUP.md) for the full Firebase setup walkthrough.

## Project structure

```
src/
  components/
    BottomNav.jsx       # Fixed bottom navigation bar
    ClientPicker.jsx    # Client selector dropdown (shared across pages)
  data/
    exercises.js        # Built-in exercise library + attribute/measurement defaults
  lib/
    firebase.js         # Firebase app initialisation (add your config here)
    firestore.js        # All Firestore read/write helpers
    utils.js            # Formatting, avatar colours, groupBy
  pages/
    ClientsPage.jsx     # Client list + payment status
    PRLogPage.jsx       # PR logging + custom exercise management
    AttributesPage.jsx  # Attribute scoring with sliders
    MeasurementsPage.jsx# Body measurement logging
    ProgressPage.jsx    # Charts and shareable progress report
  App.jsx               # Root component, auth gate, tab state
  index.css             # Global styles and design tokens
  main.jsx              # React entry point
public/
  manifest.json         # PWA manifest (add to home screen)
```

## Security

Firestore rules lock the database to Sam's Google account UID only.  
See `SETUP.md` → Step 7 for exact rule configuration.

## Adding to home screen (Android)

Once deployed, open the URL in Chrome → tap the three-dot menu → **Add to Home Screen**.  
The app will install as a standalone icon with no browser chrome.
