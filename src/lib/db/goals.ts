"use client";

import type { Firestore } from "firebase/firestore";
import { doc, setDoc } from "firebase/firestore";

export type UserGoals = {
  weightGoal?: number;
  weightUnit?: "lb" | "kg";
  caloriesGoal?: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
};

export async function setUserGoals(db: Firestore, uid: string, goals: UserGoals) {
  await setDoc(
    doc(db, "users", uid),
    {
      goals,
    },
    { merge: true },
  );
}

