# Firebase setup guide

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com
2. Click **Add project** → name it (e.g. `coach-sam`) → Continue
3. Disable Google Analytics → **Create project**

## 2. Enable Google Authentication

1. Firebase Console → **Build → Authentication → Get started**
2. Click **Google** under Sign-in providers → Enable
3. Add your support email → Save

## 3. Create Firestore database

1. **Build → Firestore Database → Create database**
2. Choose **Start in production mode** → pick a nearby region → Enable

## 4. Register a web app

1. Project Overview → click the **</>** (web) icon
2. App nickname: `coach-app` → Register app
3. Copy the `firebaseConfig` object shown — you need it in the next step

## 5. Paste config into the app

Open `src/lib/firebase.js` and replace all `YOUR_*` placeholders with your values.

## 6. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with Google.  
On the same WiFi network, you can also open `http://YOUR_LOCAL_IP:5173` on your phone.

## 7. Lock Firestore to Sam's account only

After Sam signs in once:

1. Firebase Console → **Authentication → Users**
2. Copy Sam's **UID** (long alphanumeric string in the UID column)
3. Firebase Console → **Firestore → Rules** → paste and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == "PASTE_SAMS_UID_HERE";
    }
  }
}
```

This ensures nobody else can read or write any data even if they know the project ID.

## 8. Deploy to Firebase Hosting

```bash
# Install Firebase CLI (once)
npm install -g firebase-tools

# Log in
firebase login

# Already configured — just build and deploy
npm run build
firebase deploy
```

Your app will be live at `https://YOUR_PROJECT_ID.web.app`

## 9. Add the deployed domain to Firebase Auth

Firebase Console → **Authentication → Settings → Authorized domains**  
→ Add `YOUR_PROJECT_ID.web.app`

Google Sign-in won't work on the live URL until this is done.

## Done

Sam opens `https://YOUR_PROJECT_ID.web.app` on her Android phone, signs in with Google,  
and she's in. Bookmark it or use **Add to Home Screen** in Chrome for an app-like experience.

---

## Optional: test on iPhone / iOS Safari

Local dev (`http://localhost:5173`) works in Safari.  
Google Sign-in popup may behave differently — use Chrome on iOS for best compatibility.
