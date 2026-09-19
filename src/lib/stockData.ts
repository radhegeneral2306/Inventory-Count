import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ParsedItem } from './importExcel'
import type { StockCount, StockItem, StockSession, TallyQty } from '../types'

const SESSIONS = 'stockSessions'

/**
 * tallyQty is written to a separate `tallyQuantities` subcollection (not a field on
 * stockItems) so Firestore Security Rules can let staff read item name/unit while
 * blocking all read access to the actual tally figures.
 */
export async function createSessionWithItems(
  sessionName: string,
  items: ParsedItem[],
  createdBy: string,
): Promise<string> {
  const sessionRef = await addDoc(collection(db, SESSIONS), {
    name: sessionName,
    importedAt: Date.now(),
    createdBy,
    status: 'open',
  })

  // Firestore batched writes are capped at 500 ops; chunk the import accordingly.
  const chunkSize = 200
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = writeBatch(db)
    for (const item of items.slice(i, i + chunkSize)) {
      const itemRef = doc(collection(db, SESSIONS, sessionRef.id, 'stockItems'))
      batch.set(itemRef, {
        itemName: item.itemName,
        unit: item.unit,
        assignedSection: null,
      })
      const tallyRef = doc(db, SESSIONS, sessionRef.id, 'tallyQuantities', itemRef.id)
      batch.set(tallyRef, { tallyQty: item.tallyQty })
    }
    await batch.commit()
  }

  return sessionRef.id
}

export function listenSessions(cb: (sessions: StockSession[]) => void): Unsubscribe {
  const q = query(collection(db, SESSIONS), orderBy('importedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockSession, 'id'>),
      })),
    )
  })
}

export function listenStockItems(sessionId: string, cb: (items: StockItem[]) => void): Unsubscribe {
  return onSnapshot(collection(db, SESSIONS, sessionId, 'stockItems'), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockItem, 'id'>),
      })),
    )
  })
}

export function listenTallyQuantities(sessionId: string, cb: (rows: TallyQty[]) => void): Unsubscribe {
  return onSnapshot(collection(db, SESSIONS, sessionId, 'tallyQuantities'), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TallyQty, 'id'>),
      })),
    )
  })
}

export function listenStockCounts(sessionId: string, cb: (counts: StockCount[]) => void): Unsubscribe {
  return onSnapshot(collection(db, SESSIONS, sessionId, 'stockCounts'), (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<StockCount, 'id'>),
      })),
    )
  })
}

export async function setLiveCount(
  sessionId: string,
  itemId: string,
  liveQty: number,
  countedBy: string,
  assignedSection: string | null,
) {
  await setDoc(doc(db, SESSIONS, sessionId, 'stockCounts', itemId), {
    liveQty,
    countedBy,
    assignedSection,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Firestore does not cascade deletes, so every subcollection has to be cleared
 * before the session document itself goes. Deletes are batched because a list
 * can hold several hundred items across three subcollections.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const subcollections = ['stockItems', 'tallyQuantities', 'stockCounts']
  const batchLimit = 400

  for (const name of subcollections) {
    const snap = await getDocs(collection(db, SESSIONS, sessionId, name))
    for (let i = 0; i < snap.docs.length; i += batchLimit) {
      const batch = writeBatch(db)
      for (const docSnap of snap.docs.slice(i, i + batchLimit)) {
        batch.delete(docSnap.ref)
      }
      await batch.commit()
    }
  }

  await deleteDoc(doc(db, SESSIONS, sessionId))
}
