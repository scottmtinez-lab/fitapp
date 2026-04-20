"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, setDoc } from "firebase/firestore";

type Note = {
  id: string;
  text: string;
  createdAt: string;
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addUserNote(db: Firestore, uid: string, text: string) {
  const note: Note = { id: generateId(), text: text.trim(), createdAt: new Date().toISOString() };

  await setDoc(
    doc(db, "users", uid),
    {
      notes: arrayUnion(note),
    },
    { merge: true },
  );

  return note;
}

