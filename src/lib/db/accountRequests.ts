"use client";

import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";

type AccountRequestDoc = {
  uid?: unknown;
  email?: unknown;
  status?: unknown;
  displayName?: unknown;
  photoURL?: unknown;
  requestedAt?: unknown;
};

async function getAccountRequestStatus(db: Firestore, uid: string) {
  try {
    const snap = await getDoc(doc(db, "accountRequests", uid));
    if (!snap.exists()) return null;
    const data = snap.data() as AccountRequestDoc | undefined;
    return typeof data?.status === "string" ? data.status : null;
  } catch {
    return null;
  }
}

export async function isUserApproved(db: Firestore, uid: string) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as { approved?: unknown } | undefined;
      if (data?.approved === true) return true;
    }
  } catch {
    // ignore (permission denied etc); fall back to accountRequests status
  }

  const status = await getAccountRequestStatus(db, uid);
  return status === "approved";
}

export async function requestAccountAccess(db: Firestore, user: User) {
  const email = user.email || "";
  await setDoc(
    doc(db, "accountRequests", user.uid),
    {
      uid: user.uid,
      email,
      emailLower: email.toLowerCase(),
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      emailVerified: user.emailVerified === true,
      providerIds: (user.providerData || []).map((p) => p.providerId).filter(Boolean),
      status: "pending",
      requestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function ensureApprovedOrRequest(db: Firestore, user: User) {
  const approved = await isUserApproved(db, user.uid);
  if (approved) return true;
  await requestAccountAccess(db, user);
  return false;
}

export type AccountRequest = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: string;
  requestedAt?: unknown;
};

function requestFromDoc(id: string, data: AccountRequestDoc): AccountRequest {
  const uid = typeof data.uid === "string" ? data.uid : id;
  const email = typeof data.email === "string" ? data.email : "";
  const displayName = typeof data.displayName === "string" ? data.displayName : "";
  const photoURL = typeof data.photoURL === "string" ? data.photoURL : "";
  const status = typeof data.status === "string" ? data.status : "pending";
  return { id, uid, email, displayName, photoURL, status, requestedAt: data.requestedAt };
}

export function subscribeAccountRequests(
  db: Firestore,
  onChange: (requests: AccountRequest[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, "accountRequests"), orderBy("requestedAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => requestFromDoc(d.id, d.data() as AccountRequestDoc));
      onChange(items);
    },
    (err) => onError?.(err),
  );
}

export function subscribeHasPendingAccountRequests(
  db: Firestore,
  onChange: (hasPending: boolean) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  // Show a badge if there's anything in the collection at all.
  // Some older docs might not have a `status` field, and approved requests are deleted.
  const q = query(collection(db, "accountRequests"), limit(1));
  return onSnapshot(
    q,
    (snap) => onChange(!snap.empty),
    (err) => onError?.(err),
  );
}

export async function approveAccountRequest(db: Firestore, req: AccountRequest) {
  await setDoc(
    doc(db, "users", req.uid),
    {
      uid: req.uid,
      email: req.email,
      displayName: req.displayName,
      photoURL: req.photoURL,
      approved: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await deleteDoc(doc(db, "accountRequests", req.uid));
}

export async function denyAccountRequest(db: Firestore, uid: string) {
  await deleteDoc(doc(db, "accountRequests", uid));
}
