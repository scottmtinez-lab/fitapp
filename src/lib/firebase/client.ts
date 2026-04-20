"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

function getFirebaseWebConfig(): FirebaseWebConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  if (!apiKey) {
    throw new Error(
      "Missing Firebase env var for apiKey. Set NEXT_PUBLIC_FIREBASE_API_KEY in .env.local (see .env.local.example).",
    );
  }
  if (!authDomain) {
    throw new Error(
      "Missing Firebase env var for authDomain. Set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in .env.local (see .env.local.example).",
    );
  }
  if (!projectId) {
    throw new Error(
      "Missing Firebase env var for projectId. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local (see .env.local.example).",
    );
  }
  if (!storageBucket) {
    throw new Error(
      "Missing Firebase env var for storageBucket. Set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local (see .env.local.example).",
    );
  }
  if (!messagingSenderId) {
    throw new Error(
      "Missing Firebase env var for messagingSenderId. Set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID in .env.local (see .env.local.example).",
    );
  }
  if (!appId) {
    throw new Error(
      "Missing Firebase env var for appId. Set NEXT_PUBLIC_FIREBASE_APP_ID in .env.local (see .env.local.example).",
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId: measurementId || undefined,
  };
}

export function initFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp(getFirebaseWebConfig());
}

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = initFirebaseApp();
  return cachedApp;
}
