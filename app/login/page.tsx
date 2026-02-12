"use client";

import { ensureUserDoc } from "@/lib/userBootstrap";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
  
      if (u) {
        try {
          await ensureUserDoc({
            uid: u.uid,
            displayName: u.displayName ?? "",
            email: u.email ?? "",
            photoURL: u.photoURL,
          });
        } catch (err) {
          console.error("ensureUserDoc failed:", err);
        }
      }
    });
  
    return () => unsub();
  }, []);
  

  async function loginWithGoogle() {
    setStatus("Signing in...");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setStatus("✅ Signed in successfully");
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Sign-in failed: ${err?.message ?? String(err)}`);
    }
  }

  async function logout() {
    await signOut(auth);
    setStatus("Signed out");
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>

      {user ? (
        <div className="space-y-2">
          <div className="text-sm">Signed in as:</div>
          <div className="font-medium">{user.displayName}</div>
          <div className="text-sm text-gray-600">{user.email}</div>

          <button
            onClick={logout}
            className="px-4 py-2 rounded border"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={loginWithGoogle}
          className="px-4 py-2 rounded bg-black text-white"
        >
          Sign in with Google
        </button>
      )}

      <div className="text-sm text-gray-700">{status}</div>
    </div>
  );
}
