import { collection, doc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import type { Role, UserProfile } from '../types'

const IDENTITY_TOOLKIT_SIGNUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp'

/**
 * Creates a new Firebase Auth user via the Identity Toolkit REST API directly
 * (not the client SDK's createUserWithEmailAndPassword, which would sign the
 * admin out and into the new account). This only needs the public web API key,
 * so it works entirely client-side without Cloud Functions or a service account.
 */
export async function createUserAccount(
  email: string,
  password: string,
  fullName: string,
  role: Role,
): Promise<string> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string
  const res = await fetch(`${IDENTITY_TOOLKIT_SIGNUP_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new CreateUserError(classifyAuthError(data?.error?.message))
  }

  const uid = data.localId as string
  await setDoc(doc(db, 'users', uid), { fullName, role })
  return uid
}

export async function updateUserProfile(uid: string, fullName: string, role: Role): Promise<void> {
  await setDoc(doc(db, 'users', uid), { fullName, role }, { merge: true })
}

export function listenUsers(cb: (users: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'users'), (snap) => {
    cb(
      snap.docs.map((d) => {
        const data = d.data() as { fullName: string; role: Role }
        return { uid: d.id, fullName: data.fullName, role: data.role }
      }),
    )
  })
}

export type CreateUserErrorReason = 'emailExists' | 'invalidEmail' | 'weakPassword' | 'unknown'

/** Carries a reason the caller can translate, rather than a fixed English string. */
export class CreateUserError extends Error {
  reason: CreateUserErrorReason

  constructor(reason: CreateUserErrorReason) {
    super(reason)
    this.name = 'CreateUserError'
    this.reason = reason
  }
}

function classifyAuthError(code: string | undefined): CreateUserErrorReason {
  if (code === 'EMAIL_EXISTS') return 'emailExists'
  if (code === 'INVALID_EMAIL') return 'invalidEmail'
  if (code?.startsWith('WEAK_PASSWORD')) return 'weakPassword'
  return 'unknown'
}
