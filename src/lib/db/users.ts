"use client";

import type { User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { doc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from "firebase/firestore";

import type { UserProfile } from "./types";

export function userDocRef(db: Firestore, uid: string) {
  return doc(db, "users", uid);
}

export async function upsertUserProfile(db: Firestore, user: User) {
  const profile: Omit<UserProfile, "createdAt" | "updatedAt"> = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };

  await setDoc(
    userDocRef(db, user.uid),
    {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeUserWorkouts(
  db: Firestore,
  uid: string,
  onChange: (workouts: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { workouts?: unknown; workout?: unknown } | undefined;
      const raw =
        (Array.isArray(data?.workouts) && data!.workouts) || (Array.isArray(data?.workout) && data!.workout) || [];
      const workouts = Array.isArray(raw) ? raw : [];
      onChange(workouts);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserRoutines(
  db: Firestore,
  uid: string,
  onChange: (routines: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { routines?: unknown } | undefined;
      const routines = Array.isArray(data?.routines) ? data!.routines : [];
      onChange(routines);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserNutrition(
  db: Firestore,
  uid: string,
  onChange: (nutrition: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { macros?: unknown; nutrition?: unknown } | undefined;
      const raw =
        (Array.isArray(data?.macros) && data!.macros) || (Array.isArray(data?.nutrition) && data!.nutrition) || [];
      const nutrition = Array.isArray(raw) ? raw : [];
      onChange(nutrition);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserMacros(
  db: Firestore,
  uid: string,
  onChange: (macros: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { macros?: unknown } | undefined;
      const macros = Array.isArray(data?.macros) ? data!.macros : [];
      onChange(macros);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserBodyWeights(
  db: Firestore,
  uid: string,
  onChange: (weightHistory: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { weightHistory?: unknown } | undefined;
      const weightHistory = Array.isArray(data?.weightHistory) ? data!.weightHistory : [];
      onChange(weightHistory);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserHomeSections(
  db: Firestore,
  uid: string,
  onChange: (homeSections: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { homeSections?: unknown } | undefined;
      const homeSections = Array.isArray(data?.homeSections) ? data!.homeSections : [];
      onChange(homeSections);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserPRs(
  db: Firestore,
  uid: string,
  onChange: (prs: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { prs?: unknown } | undefined;
      const prs = Array.isArray(data?.prs) ? data!.prs : [];
      onChange(prs);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserNotes(
  db: Firestore,
  uid: string,
  onChange: (notes: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { notes?: unknown } | undefined;
      const notes = Array.isArray(data?.notes) ? data!.notes : [];
      onChange(notes);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserGoals(
  db: Firestore,
  uid: string,
  onChange: (goals: unknown) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { goals?: unknown } | undefined;
      onChange(data?.goals ?? null);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserProgressSections(
  db: Firestore,
  uid: string,
  onChange: (progressSections: unknown[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { progressSections?: unknown } | undefined;
      const progressSections = Array.isArray(data?.progressSections) ? data!.progressSections : [];
      onChange(progressSections);
    },
    (err) => onError?.(err),
  );
}

export function subscribeUserRole(
  db: Firestore,
  uid: string,
  onChange: (role: string | null) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(db, uid),
    (snap) => {
      const data = snap.data() as { role?: unknown } | undefined;
      onChange(typeof data?.role === "string" ? data.role : null);
    },
    (err) => onError?.(err),
  );
}
