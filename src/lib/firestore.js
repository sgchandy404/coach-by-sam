import { db } from './firebase.js'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, writeBatch, query, orderBy, serverTimestamp,
} from 'firebase/firestore'

// ── Clients ───────────────────────────────────────────────────────────────────
export const getClients = () =>
  getDocs(query(collection(db, 'clients'), orderBy('name')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addClient = (data) =>
  addDoc(collection(db, 'clients'), { ...data, status: 'active', createdAt: serverTimestamp() })

export const updateClient = (id, data) =>
  updateDoc(doc(db, 'clients', id), data)

// Full delete: removes client doc + all subcollection documents
export const deleteClientFull = async (id) => {
  const subcols = ['prs', 'attributes', 'measurements']
  const batch = writeBatch(db)
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'clients', id, sub))
    snap.docs.forEach(d => batch.delete(d.ref))
  }
  batch.delete(doc(db, 'clients', id))
  return batch.commit()
}

// ── PRs ───────────────────────────────────────────────────────────────────────
export const getPRs = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'prs'), orderBy('date', 'desc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addPR = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'prs'), { ...data, createdAt: serverTimestamp() })

export const deletePR = (clientId, prId) =>
  deleteDoc(doc(db, 'clients', clientId, 'prs', prId))

// ── Attributes ────────────────────────────────────────────────────────────────
export const getAttributes = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'attributes'), orderBy('date', 'desc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addAttributes = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'attributes'), { ...data, createdAt: serverTimestamp() })

export const deleteAttributes = (clientId, id) =>
  deleteDoc(doc(db, 'clients', clientId, 'attributes', id))

// ── Measurements ──────────────────────────────────────────────────────────────
export const getMeasurements = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'measurements'), orderBy('date', 'desc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addMeasurement = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'measurements'), { ...data, createdAt: serverTimestamp() })

export const deleteMeasurement = (clientId, id) =>
  deleteDoc(doc(db, 'clients', clientId, 'measurements', id))

// ── Custom exercises ──────────────────────────────────────────────────────────
export const getCustomExercises = () =>
  getDocs(collection(db, 'customExercises'))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addCustomExercise = (data) =>
  addDoc(collection(db, 'customExercises'), data)

export const deleteCustomExercise = (id) =>
  deleteDoc(doc(db, 'customExercises', id))

// ── Seed / flush helpers ──────────────────────────────────────────────────────
// Seed: write a batch of pre-built client docs + subcollection entries
export const seedDummyData = async (clientsData) => {
  for (const { client, prs, attributes, measurements } of clientsData) {
    const cRef = await addDoc(collection(db, 'clients'), { ...client, createdAt: serverTimestamp() })
    const batch = writeBatch(db)
    for (const pr of prs)
      batch.set(doc(collection(db, 'clients', cRef.id, 'prs')), { ...pr, createdAt: serverTimestamp() })
    for (const a of attributes)
      batch.set(doc(collection(db, 'clients', cRef.id, 'attributes')), { ...a, createdAt: serverTimestamp() })
    for (const m of measurements)
      batch.set(doc(collection(db, 'clients', cRef.id, 'measurements')), { ...m, createdAt: serverTimestamp() })
    await batch.commit()
  }
}

// Flush: delete every client and their subcollections, plus custom exercises
export const flushAllData = async () => {
  const clients = await getDocs(collection(db, 'clients'))
  for (const cDoc of clients.docs) {
    await deleteClientFull(cDoc.id)
  }
  const exSnap = await getDocs(collection(db, 'customExercises'))
  const batch = writeBatch(db)
  exSnap.docs.forEach(d => batch.delete(d.ref))
  await batch.commit()
}

// Flush only seeded (dummy) clients — identified by isDummy flag
export const flushDummyData = async () => {
  const snap = await getDocs(collection(db, 'clients'))
  for (const cDoc of snap.docs) {
    if (cDoc.data().isDummy) await deleteClientFull(cDoc.id)
  }
}
