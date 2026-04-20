"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";

export type NutritionEntry = {
  id: string;
  name: string;
  serving?: string;
  servingsEaten?: number;
  perServing?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  day: string; // YYYY-MM-DD
  loggedAt?: unknown;
};

export async function addNutritionEntry(db: Firestore, uid: string, entry: Omit<NutritionEntry, "loggedAt">) {
  const numOrZero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

  const base: NutritionEntry = {
    ...entry,
    servingsEaten: numOrZero(entry.servingsEaten) || 1,
    calories: numOrZero(entry.calories),
    protein: numOrZero(entry.protein),
    carbs: numOrZero(entry.carbs),
    fat: numOrZero(entry.fat),
    // Firestore disallows serverTimestamp() inside arrayUnion elements.
    loggedAt: Date.now(),
  };

  const payload: NutritionEntry = entry.perServing
    ? {
        ...base,
        perServing: {
          calories: numOrZero(entry.perServing.calories),
          protein: numOrZero(entry.perServing.protein),
          carbs: numOrZero(entry.perServing.carbs),
          fat: numOrZero(entry.perServing.fat),
        },
      }
    : base;

  await updateDoc(doc(db, "users", uid), {
    macros: arrayUnion(payload),
  });
}
