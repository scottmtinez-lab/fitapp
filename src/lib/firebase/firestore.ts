"use client";

import type { Firestore } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "./client";

let cachedDb: Firestore | null = null;

export function getClientDb(): Firestore | null {
  if (typeof window === "undefined") return null;
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getFirebaseApp());
  return cachedDb;
}

