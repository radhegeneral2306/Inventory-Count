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
  where,
  writeBatch,
  type Timestamp,
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
        groupName: item.groupName,
        sortIndex: item.sortIndex,
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
    const items = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        itemName: data.itemName as string,
        unit: (data.unit as string) ?? '',
        assignedSection: (data.assignedSection as string | null) ?? null,
        // Lists imported before groups existed carry neither field.
        groupName: (data.groupName as string) ?? '',
        sortIndex: (data.sortIndex as number) ?? 0,
      }
    })
    items.sort((a, b) => a.sortIndex - b.sortIndex)
    cb(items)
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

/**
 * Staff may only read the counts they entered, and Firestore rejects any listen
 * it cannot prove matches that rule, so the filter has to live in the query
 * rather than only in the rules. Admin passes no filter and sees everything.
 */
export function listenStockCounts(
  sessionId: string,
  cb: (counts: StockCount[]) => void,
  countedBy?: string,
): Unsubscribe {
  const counts = collection(db, SESSIONS, sessionId, 'stockCounts')
  const scoped = countedBy ? query(counts, where('countedBy', '==', countedBy)) : counts
  return onSnapshot(scoped, (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data()
        // updatedAt is written via serverTimestamp(), which comes back as a
        // Firestore Timestamp object, not the plain number the type declares.
        const updatedAt = data.updatedAt as Timestamp | undefined
        return {
          id: d.id,
          liveQty: data.liveQty as number,
          countedBy: data.countedBy as string,
          updatedAt: updatedAt ? updatedAt.toMillis() : 0,
          assignedSection: (data.assignedSection as string | null) ?? null,
        }
      }),
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

/** Erasing a count box back to empty should return the item to "pending", not just hide the old value locally. */
export async function clearLiveCount(sessionId: string, itemId: string) {
  await deleteDoc(doc(db, SESSIONS, sessionId, 'stockCounts', itemId))
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
