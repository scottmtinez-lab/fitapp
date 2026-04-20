"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";

import type { BodyWeightEntry } from "./types";

export async function addBodyWeightEntry(
  db: Firestore,
  uid: string,
  entry: Omit<BodyWeightEntry, "createdAt">,
) {
  const payload: BodyWeightEntry = {
    ...entry,
    createdAt: serverTimestamp(),
  };

  await updateDoc(doc(db, "users", uid), {
    weightHistory: arrayUnion(payload),
  });
}
