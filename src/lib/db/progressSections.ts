"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, setDoc } from "firebase/firestore";

import type { ProgressSection } from "./types";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addProgressSection(
  db: Firestore,
  uid: string,
  type: ProgressSection["type"],
) {
  const section: ProgressSection = {
    id: generateId(),
    type,
    createdAt: new Date().toISOString(),
  };

  await setDoc(
    doc(db, "users", uid),
    {
      progressSections: arrayUnion(section),
    },
    { merge: true },
  );

  return section;
}

export async function setProgressSections(
  db: Firestore,
  uid: string,
  progressSections: ProgressSection[],
) {
  await setDoc(
    doc(db, "users", uid),
    {
      progressSections,
    },
    { merge: true },
  );
}

