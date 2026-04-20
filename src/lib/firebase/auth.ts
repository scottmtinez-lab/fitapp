"use client";

import type { Auth } from "firebase/auth";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseApp } from "./client";

let cachedAuth: Auth | null = null;
let cachedGoogleProvider: GoogleAuthProvider | null = null;

export function getClientAuth(): Auth | null {
  if (typeof window === "undefined") return null;
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

export function getGoogleProvider(): GoogleAuthProvider | null {
  if (typeof window === "undefined") return null;
  if (cachedGoogleProvider) return cachedGoogleProvider;
  cachedGoogleProvider = new GoogleAuthProvider();
  return cachedGoogleProvider;
}

export async function signInWithGooglePopup() {
  const auth = getClientAuth();
  const provider = getGoogleProvider();
  if (!auth || !provider) return null;
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutClient() {
  const auth = getClientAuth();
  if (!auth) return;
  await signOut(auth);
}
