"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, setDoc } from "firebase/firestore";

import type { HomeSection } from "./types";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `hs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addHomeSection(db: Firestore, uid: string, type: HomeSection["type"]) {
  const section: HomeSection = {
    id: generateId(),
    type,
    createdAt: new Date().toISOString(),
  };

  await setDoc(
    doc(db, "users", uid),
    {
      homeSections: arrayUnion(section),
    },
    { merge: true },
  );

  return section;
}

export async function setHomeSections(db: Firestore, uid: string, homeSections: HomeSection[]) {
  await setDoc(
    doc(db, "users", uid),
    {
      homeSections,
    },
    { merge: true },
  );
}
