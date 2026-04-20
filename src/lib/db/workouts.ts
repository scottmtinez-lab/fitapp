"use client";

import type { Firestore } from "firebase/firestore";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";

import type { WorkoutEntry, WorkoutExerciseLog } from "./types";

export type NewWorkoutInput = {
  title: string;
  routineId?: string;
  exercises?: WorkoutExerciseLog[];
  startedAt?: number;
  completedAt?: number;
  durationMinutes?: number;
  volume?: number;
};

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function addWorkoutForUser(db: Firestore, uid: string, input: NewWorkoutInput) {
  const now = Date.now();
  const startedAt = typeof input.startedAt === "number" ? input.startedAt : now;
  const completedAt = typeof input.completedAt === "number" ? input.completedAt : now;
  const workout: WorkoutEntry = {
    id: generateId(),
    title: input.title.trim(),
    routineId: input.routineId || "",
    exercises: input.exercises ?? [],
    durationMinutes: typeof input.durationMinutes === "number" ? input.durationMinutes : 0,
    volume: typeof input.volume === "number" ? input.volume : 0,
    date: completedAt,
    createdAt: now,
    startedAt,
    completedAt,
    createdBy: uid,
  };

  await updateDoc(doc(db, "users", uid), {
    workout: arrayUnion(workout),
  });

  return workout;
}
