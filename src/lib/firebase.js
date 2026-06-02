import { initializeApp } from 'firebase/app'
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Paste your Firebase project config here.
// Get it from: Firebase Console → Project Settings → Your apps → Web app
const firebaseConfig = {
  apiKey: "AIzaSyAl3oKG99cQubleHUW3Hd8zGMPTSbhNCFM",
  authDomain: "coach-by-sam.firebaseapp.com",
  projectId: "coach-by-sam",
  storageBucket: "coach-by-sam.firebasestorage.app",
  messagingSenderId: "123251915114",
  appId: "1:123251915114:web:1bc4d4f92fbf7c17dfcd13",
  measurementId: "G-521BXY91GV"
};

const app = initializeApp(firebaseConfig)

export const auth     = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
})
export const db       = getFirestore(app)
export const provider = new GoogleAuthProvider()
