"use client";

import type { Analytics } from "firebase/analytics";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirebaseApp } from "./client";

let cachedAnalytics: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

export function getClientAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (cachedAnalytics) return Promise.resolve(cachedAnalytics);
  if (initPromise) return initPromise;

  initPromise = isSupported()
    .then((supported) => {
      if (!supported) return null;
      cachedAnalytics = getAnalytics(getFirebaseApp());
      return cachedAnalytics;
    })
    .catch(() => null);

  return initPromise;
}

