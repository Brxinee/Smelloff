"use client";

/**
 * Firebase Auth, lazy-loaded. Nothing here runs until a user explicitly
 * opts to sign in (or after purchase), so it never blocks first paint or
 * checkout. Import via `await getFirebaseAuth()`.
 */

import type { Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let cachedAuth: Auth | null = null;

export async function getFirebaseAuth(): Promise<Auth | null> {
  if (!firebaseConfigured()) return null;
  if (cachedAuth) return cachedAuth;
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  const app = getApps().length ? getApp() : initializeApp(config);
  cachedAuth = getAuth(app);
  return cachedAuth;
}
