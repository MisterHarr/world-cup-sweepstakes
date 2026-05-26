"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getIdTokenResult, type User } from "firebase/auth";

import { auth } from "@/lib/firebase";

type AdminGateState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "denied"; uid: string }
  | { status: "error"; message: string }
  | { status: "ready"; uid: string; user: User };

type AdminGateProps = {
  children: (context: { uid: string; user: User }) => ReactNode;
};

export function AdminGate(props: AdminGateProps) {
  const { children } = props;
  const [state, setState] = useState<AdminGateState>({ status: "loading" });

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      setState({ status: "loading" });

      if (!user) {
        setState({ status: "signed-out" });
        return;
      }

      try {
        const token = await getIdTokenResult(user, true);
        if (token.claims.admin !== true) {
          setState({ status: "denied", uid: user.uid });
          return;
        }

        setState({ status: "ready", uid: user.uid, user });
      } catch (error: unknown) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Failed to verify admin access.";
        setState({ status: "error", message });
      }
    });

    return () => unsub();
  }, []);

  if (state.status === "loading") {
    return <div className="text-sm text-slate-400">Checking admin access…</div>;
  }

  if (state.status === "signed-out") {
    return (
      <div className="text-sm text-slate-400">
        Please sign in to access admin tools.
      </div>
    );
  }

  if (state.status === "denied") {
    return (
      <div className="space-y-1 text-sm">
        <div className="text-slate-300">Not authorized.</div>
        <div className="text-slate-500">Signed in as {state.uid}.</div>
      </div>
    );
  }

  if (state.status === "error") {
    return <div className="text-sm text-rose-300">{state.message}</div>;
  }

  return <>{children({ uid: state.uid, user: state.user })}</>;
}
