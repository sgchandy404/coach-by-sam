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
  getDocs(collection(db, 'clients', clientId, 'billingPeriods'))
    .then(s => {
      const docs = s.docs.map(d => ({ id: d.id, ...d.data() }))
      // Sort by startDate (DD-MM-YYYY) ascending; fall back to createdAt for same startDate
      return docs.sort((a, b) => {
        const [ad, am, ay] = (a.startDate || '').split('-').map(Number)
        const [bd, bm, by] = (b.startDate || '').split('-').map(Number)
        const aTime = new Date(ay, am - 1, ad).getTime() || 0
        const bTime = new Date(by, bm - 1, bd).getTime() || 0
        return aTime - bTime
      })
    })

export const addBillingPeriod = (clientId, data) =>
  addDoc(collection(db, 'clients', clientId, 'billingPeriods'), { ...data, createdAt: serverTimestamp() })

export const closeBillingPeriod = (clientId, periodId, endDate) =>
  updateDoc(doc(db, 'clients', clientId, 'billingPeriods', periodId), { endDate })

export const updateBillingPeriod = (clientId, periodId, data) =>
  updateDoc(doc(db, 'clients', clientId, 'billingPeriods', periodId), data)

// Recomputes balance and carryForwardAmount from actual payment data.
// When billing periods exist, carry-forward is derived dynamically from unpaid closed periods
// so that adding/deleting payments for old periods is always reflected correctly.
// Falls back to date-range filtering for clients with no billing periods.
export const recomputeClientPaymentFields = async (clientId, fee, periodStartDate = null, carryForwardAmount = 0) => {
  const [allPayments, periods] = await Promise.all([getPayments(clientId), getBillingPeriods(clientId)])

  const paymentsForPeriod = (period) => {
    const s = parseDMY(period.startDate)
    const e = period.endDate ? parseDMY(period.endDate) : null
    return allPayments.filter(p => {
      if (p.billingPeriodId) return p.billingPeriodId === period.id
      const d = parseDMY(p.date)
      return d && s && d >= s && (!e || d < e)
    })
  }

  let newCarryForward = carryForwardAmount
  let activePayments = []
  const mostRecent = allPayments[0] || null

  if (periods.length > 0) {
    const activePeriod = [...periods].reverse().find(p => !p.endDate)
    if (!activePeriod) {
      // All periods closed — nothing to recompute against; bail out safely
      await updateDoc(doc(db, 'clients', clientId), {
        balance: 0, carryForwardAmount: 0,
        lastPaidCycleStart: mostRecent?.cycleStart ?? null,
        lastPaidCycleEnd:   mostRecent?.cycleEnd   ?? null,
        lastPaidCycleIndex: null,
      })
      return
    }
    // Dynamically compute carry-forward from all closed periods
    newCarryForward = periods
      .filter(p => p.endDate)
      .reduce((carry, period) => {
        const periodFee = period.billingType === 'monthly'
          ? (period.monthlyFee || 0)
          : (period.classesPerCycle || 0) * (period.sessionRate || 0)
        if (!periodFee) return carry
        const paid = paymentsForPeriod(period).reduce((s, p) => s + (p.amount || 0), 0)
        return carry + Math.max(0, periodFee - paid)
      }, 0)
    activePayments = paymentsForPeriod(activePeriod)
  } else {
    // No billing periods — fall back to date-range filtering from periodStartDate
    const periodStart = periodStartDate ? parseDMY(periodStartDate) : null
    activePayments = periodStart
      ? allPayments.filter(p => { const d = parseDMY(p.date); return d && d >= periodStart })
      : allPayments
  }

  const activePaid = activePayments.reduce((s, p) => s + (p.amount || 0), 0)
  // lastPaidCycleIndex scoped to active period so billing resets don't pollute it
  const lastPaidCycleIndex = activePayments.reduce((max, p) =>
    p.cycleIndex != null ? Math.max(max, p.cycleIndex) : max, -1)

  const balance = activePaid - ((fee || 0) + newCarryForward)
  await updateDoc(doc(db, 'clients', clientId), {
    balance,
    carryForwardAmount:  newCarryForward,
    lastPaidCycleStart:  mostRecent?.cycleStart ?? null,
    lastPaidCycleEnd:    mostRecent?.cycleEnd   ?? null,
    lastPaidCycleIndex:  lastPaidCycleIndex >= 0 ? lastPaidCycleIndex : null,
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
