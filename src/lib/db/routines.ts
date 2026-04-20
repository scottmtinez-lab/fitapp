"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";

import type { Routine, RoutineExerciseRef } from "./types";

export type NewRoutineInput = {
  name: string;
  description?: string;
  exercises?: RoutineExerciseRef[];
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRoutineForUser(db: Firestore, uid: string, input: NewRoutineInput) {
  const routine: Routine = {
    id: generateId(),
    name: input.name.trim(),
    description: input.description?.trim() || "",
    exercises: input.exercises ?? [],
    createdAt: new Date().toISOString(),
    createdBy: uid,
  };

  await updateDoc(doc(db, "users", uid), {
    routines: arrayUnion(routine),
  });

  return routine;
}

export async function deleteRoutineForUser(db: Firestore, uid: string, routineId: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User document not found.");

  const data = snap.data() as { routines?: unknown } | undefined;
  const routines = Array.isArray(data?.routines) ? (data!.routines as unknown[]) : [];

  const next = routines.filter((r) => {
    if (!r || typeof r !== "object") return true;
    const id = (r as Record<string, unknown>).id;
    return typeof id !== "string" || id !== routineId;
  });

  await updateDoc(ref, { routines: next });
}

export async function updateRoutineForUser(
  db: Firestore,
  uid: string,
  routineId: string,
  input: NewRoutineInput,
) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("User document not found.");

  const data = snap.data() as { routines?: unknown } | undefined;
  const routines = Array.isArray(data?.routines) ? (data!.routines as unknown[]) : [];

  let found = false;
  const next = routines.map((r) => {
    if (!r || typeof r !== "object") return r;
    const obj = r as Record<string, unknown>;
    if (obj.id !== routineId) return r;

    found = true;
    return {
      ...obj,
      id: routineId,
      name: input.name.trim(),
      description: input.description?.trim() || "",
      exercises: input.exercises ?? [],
    };
  });

  if (!found) throw new Error("Routine not found.");
  await updateDoc(ref, { routines: next });
}
