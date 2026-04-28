"use client";

import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import type { Exercise } from "./types";

export type NewExerciseInput = {
  name: string;
  bodyPart?: string;
  category?: string;
  duration?: string;
  trackingType?: "time" | "reps" | "weight_reps";
  muscleGroup?: string;
  equipment?: string;
  createdBy?: string;
};

export function subscribeExercises(
  db: Firestore,
  onChange: (items: Exercise[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const q = query(collection(db, "exercises"), orderBy("name", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      const items: Exercise[] = snap.docs.map((d) => {
        const data = d.data() as Omit<Exercise, "id">;
        return { id: d.id, ...data };
      });
      onChange(items);
    },
    (err) => onError?.(err),
  );
}

export async function createExercise(db: Firestore, input: NewExerciseInput) {
  const payload = {
    name: input.name.trim(),
    bodyPart: input.bodyPart?.trim() || "Full Body",
    category: input.category?.trim() || "Strength",
    duration: input.duration?.trim() || "",
    trackingType: input.trackingType || "weight_reps",
    muscleGroup: input.muscleGroup?.trim() || "",
    equipment: input.equipment?.trim() || "",
    createdBy: input.createdBy || "",
    createdAt: serverTimestamp(),
  };

  return addDoc(collection(db, "exercises"), payload);
}

export type UpdateExerciseInput = {
  name?: string;
  bodyPart?: string;
  category?: string;
  duration?: string;
  trackingType?: "time" | "reps" | "weight_reps";
  muscleGroup?: string;
  equipment?: string;
};

export async function updateExercise(db: Firestore, exerciseId: string, input: UpdateExerciseInput) {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.bodyPart === "string") payload.bodyPart = input.bodyPart.trim();
  if (typeof input.category === "string") payload.category = input.category.trim();
  if (typeof input.duration === "string") payload.duration = input.duration.trim();
  if (typeof input.trackingType === "string") payload.trackingType = input.trackingType;
  if (typeof input.muscleGroup === "string") payload.muscleGroup = input.muscleGroup.trim();
  if (typeof input.equipment === "string") payload.equipment = input.equipment.trim();

  await updateDoc(doc(db, "exercises", exerciseId), payload);
}

export async function deleteExercise(db: Firestore, exerciseId: string) {
  await deleteDoc(doc(db, "exercises", exerciseId));
}
