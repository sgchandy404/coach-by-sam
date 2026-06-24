import { db } from './firebase.js'
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  getDocs, writeBatch, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { getClassCycleInfo, parseDMY } from './utils.js'

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
  const subcols = ['prs', 'attributes', 'measurements', 'attendance', 'payments', 'billingPeriods']
  const refs = []
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'clients', id, sub))
    snap.docs.forEach(d => refs.push(d.ref))
  }
  refs.push(doc(db, 'clients', id))
  // Firestore batch limit is 500 — commit in chunks
  for (let i = 0; i < refs.length; i += 499) {
    const batch = writeBatch(db)
    refs.slice(i, i + 499).forEach(r => batch.delete(r))
    await batch.commit()
  }
}

// ── PRs ───────────────────────────────────────────────────────────────────────
export const getPRs = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'prs'), orderBy('date', 'desc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addPR = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'prs'), { ...data, createdAt: serverTimestamp() })

export const deletePR = (clientId, prId) =>
  deleteDoc(doc(db, 'clients', clientId, 'prs', prId))

export const updatePR = (clientId, prId, data) =>
  updateDoc(doc(db, 'clients', clientId, 'prs', prId), data)

// Rewrite all PR docs referencing oldEx across every client to point to targetEx,
// then delete the custom exercise document.
export const mergeExercise = async (oldEx, targetEx, clients) => {
  for (const client of clients) {
    const prs = await getPRs(client.id)
    const toUpdate = prs.filter(p => p.exerciseId === oldEx.id || p.exerciseName === oldEx.name)
    if (toUpdate.length === 0) continue
    const batch = writeBatch(db)
    toUpdate.forEach(p =>
      batch.update(doc(db, 'clients', client.id, 'prs', p.id), {
        exerciseId:   targetEx.id,
        exerciseName: targetEx.name,
        type:         targetEx.type,
        unit:         targetEx.unit,
      })
    )
    await batch.commit()
  }
  await deleteDoc(doc(db, 'customExercises', oldEx.id))
}

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

// ── Attendance ────────────────────────────────────────────────────────────────
// doc ID = DD-MM-YYYY; one doc per attended date per client
export const getAttendance = (clientId) =>
  getDocs(collection(db, 'clients', clientId, 'attendance'))
    .then(s => s.docs.map(d => ({ id: d.id, date: d.id, ...d.data() })))

export const markAttended = (clientId, date) =>
  setDoc(doc(db, 'clients', clientId, 'attendance', date), { date, createdAt: serverTimestamp() })

export const unmarkAttended = (clientId, date) =>
  deleteDoc(doc(db, 'clients', clientId, 'attendance', date))

export const updateAttendanceExercises = (clientId, date, exercises) =>
  updateDoc(doc(db, 'clients', clientId, 'attendance', date), { exercises })

// ── Payments ──────────────────────────────────────────────────────────────────
// One doc per payment event: { amount, date (DD-MM-YYYY), cycleStart, cycleEnd, createdAt }
export const addPayment = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'payments'), { ...data, createdAt: serverTimestamp() })

export const getPayments = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'payments'), orderBy('createdAt', 'desc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const deletePayment = (clientId, paymentId) =>
  deleteDoc(doc(db, 'clients', clientId, 'payments', paymentId))

export const getAllClientsPayments = (clientIds) =>
  Promise.all(clientIds.map(id => getPayments(id).then(payments => ({ clientId: id, payments }))))

export const getAllClientsBillingPeriods = (clientIds) =>
  Promise.all(clientIds.map(id => getBillingPeriods(id).then(periods => ({ clientId: id, periods }))))

export const getAllClientsAttendance = (clientIds) =>
  Promise.all(clientIds.map(id => getAttendance(id).then(records => ({ clientId: id, records }))))

// ── Billing periods ───────────────────────────────────────────────────────────
export const getBillingPeriods = (clientId) =>
  getDocs(query(collection(db, 'clients', clientId, 'billingPeriods'), orderBy('createdAt')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))

export const addBillingPeriod = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'billingPeriods'), { ...data, createdAt: serverTimestamp() })

export const closeBillingPeriod = (clientId, periodId, endDate) =>
  updateDoc(doc(db, 'clients', clientId, 'billingPeriods', periodId), { endDate })

// Recomputes balance from payments in the current billing period.
// periodStartDate (DD-MM-YYYY): only payments on/after this date are counted.
// carryForwardAmount: outstanding debt carried from the previous billing period.
//   Folded into effectiveFee so balance naturally drains to 0 as payments accumulate.
//   Cleared on the client doc automatically once balance >= 0.
export const recomputeClientPaymentFields = async (clientId, fee, periodStartDate = null, carryForwardAmount = 0) => {
  const allPayments = await getPayments(clientId)
  const periodStart = periodStartDate ? parseDMY(periodStartDate) : null
  const payments    = periodStart
    ? allPayments.filter(p => { const d = parseDMY(p.date); return d && d >= periodStart })
    : allPayments
  const totalPaid     = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const effectiveFee  = (fee || 0) + (carryForwardAmount || 0)
  const balance       = totalPaid - effectiveFee
  const mostRecent    = payments[0] || null
  const lastPaidCycleIndex = payments.reduce((max, p) =>
    p.cycleIndex != null ? Math.max(max, p.cycleIndex) : max, -1)
  await updateDoc(doc(db, 'clients', clientId), {
    balance,
    lastPaidCycleStart:  mostRecent?.cycleStart ?? null,
    lastPaidCycleEnd:    mostRecent?.cycleEnd   ?? null,
    lastPaidCycleIndex:  lastPaidCycleIndex >= 0 ? lastPaidCycleIndex : null,
    // carryForwardAmount is set here so it persists across payment recordings.
    // Do NOT auto-clear when balance >= 0 — the display formula depends on it.
    // It resets only when billing changes (change-billing handler passes the new value).
    carryForwardAmount:  carryForwardAmount || 0,
  })
}

// Recomputes attendedThisCycle for a classes-based client.
// currentCycleIndex is NOT recomputed here — it is advanced manually via startNextCycle.
export const recomputeClassCycleFields = async (clientId, client) => {
  const attendance = await getAttendance(clientId)
  const info = getClassCycleInfo(client, attendance)
  await updateDoc(doc(db, 'clients', clientId), {
    attendedThisCycle: info.attendedThisCycle,
  })
}

// Manually advance to the next cycle. Called when Sam taps "Start next cycle".
export const startNextCycle = async (clientId, client, newStartDate) => {
  await updateDoc(doc(db, 'clients', clientId), {
    currentCycleIndex:     (client.currentCycleIndex ?? 0) + 1,
    currentCycleStartDate: newStartDate,
    attendedThisCycle:     0,
  })
}

// ── Custom exercises ──────────────────────────────────────────────────────────
export const getCustomExercises = () =>
  getDocs(collection(db, 'customExercises'))
    .then(s => s.docs.map(d => ({ ...d.data(), id: d.id })))

export const addCustomExercise = (data) =>
  addDoc(collection(db, 'customExercises'), data)

export const updateCustomExercise = (id, data) =>
  updateDoc(doc(db, 'customExercises', id), data)

export const deleteCustomExercise = (id) =>
  deleteDoc(doc(db, 'customExercises', id))

// ── Seed / flush helpers ──────────────────────────────────────────────────────
// Seed: write a batch of pre-built client docs + subcollection entries
export const seedDummyData = async (clientsData) => {
  for (const { client, prs, attributes, measurements, attendance = [], payments = [] } of clientsData) {
    const cRef = await addDoc(collection(db, 'clients'), { ...client, createdAt: serverTimestamp() })
    const batch = writeBatch(db)
    for (const pr of prs)
      batch.set(doc(collection(db, 'clients', cRef.id, 'prs')), { ...pr, createdAt: serverTimestamp() })
    for (const a of attributes)
      batch.set(doc(collection(db, 'clients', cRef.id, 'attributes')), { ...a, createdAt: serverTimestamp() })
    for (const m of measurements)
      batch.set(doc(collection(db, 'clients', cRef.id, 'measurements')), { ...m, createdAt: serverTimestamp() })
    for (const att of attendance)
      batch.set(doc(db, 'clients', cRef.id, 'attendance', att.date), { ...att, createdAt: serverTimestamp() })
    for (const p of payments)
      batch.set(doc(collection(db, 'clients', cRef.id, 'payments')), { ...p, createdAt: serverTimestamp() })
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
