"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, setDoc } from "firebase/firestore";

import type { PRRecord } from "./types";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addPR(
  db: Firestore,
  uid: string,
  input: Omit<PRRecord, "id" | "createdAt">,
) {
  const pr: PRRecord = {
    id: generateId(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  await setDoc(
    doc(db, "users", uid),
    {
      prs: arrayUnion(pr),
    },
    { merge: true },
  );

  return pr;
}

