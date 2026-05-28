"use client";

import { useEffect, useMemo, useState } from "react";

import { getAdminEnvironmentInfo } from "@/components/admin/adminEnvironment";

type LocalhostProductionWarningProps = {
  onConfirmedChange?: (confirmed: boolean) => void;
};

export function LocalhostProductionWarning(
  props: LocalhostProductionWarningProps
) {
  const { onConfirmedChange } = props;
  const [typed, setTyped] = useState("");

  const info = useMemo(() => {
    if (typeof window === "undefined") {
      return getAdminEnvironmentInfo();
    }
    return getAdminEnvironmentInfo(window.location.hostname);
  }, []);

  const confirmed = !info.requiresProductionAck || typed.trim() === "PRODUCTION";

  useEffect(() => {
    onConfirmedChange?.(confirmed);
  }, [confirmed, onConfirmedChange]);

  if (!info.requiresProductionAck) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-100 space-y-3">
      <div className="font-semibold uppercase tracking-[0.18em] text-rose-200">
        ⚠️ Connected to live data
      </div>
      <p>
        You are running locally against the live site. Type
        <span className="px-1 font-semibold text-white">PRODUCTION</span>
        to unlock actions below.
      </p>
      <input
        type="text"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder="Type PRODUCTION to continue"
        className="block w-full rounded-xl border border-rose-400/40 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
      />
    </div>
  );
}
