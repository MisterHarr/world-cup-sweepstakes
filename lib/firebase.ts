// lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";

type FirebaseSingleton = {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
  functions: Functions | null;
  initError: string | null;
};

// Read env safely
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

function missingKeys(cfg: Record<string, string>) {
  return Object.entries(cfg)
    .filter(([_, v]) => !v || String(v).trim().length === 0)
    .map(([k]) => k);
}

let singleton: FirebaseSingleton | null = null;

export function getFirebase(): FirebaseSingleton {
  if (singleton) return singleton;

  const missing = missingKeys(firebaseConfig);
  if (missing.length > 0) {
    singleton = {
      app: null,
      db: null,
      auth: null,
      functions: null,
      initError:
        `Firebase env vars missing: ${missing.join(", ")}.\n` +
        `Fix .env.local and restart \`npm run dev\`.`,
    };
    return singleton;
  }

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

  singleton = {
    app,
    db: getFirestore(app),
    auth: getAuth(app),
    functions: getFunctions(app, "asia-southeast1"),
    initError: null,
  };

  return singleton;
}

// Backwards-compatible named exports (so you don’t have to refactor imports)
const fb = getFirebase();
export const app = fb.app as FirebaseApp;
export const db = fb.db as Firestore;
export const auth = fb.auth as Auth;
export const functions = fb.functions as Functions;
export const firebaseInitError = fb.initError;
