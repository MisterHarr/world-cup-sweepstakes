"use client";

import { useEffect, useState } from "react";

import {
  type AdminEnvironmentInfo,
  getAdminEnvironmentInfo,
} from "@/components/admin/adminEnvironment";

const LABEL_STYLES = {
  LOCAL: "border-amber-500/50 bg-amber-500/15 text-amber-100",
  STAGING: "border-sky-500/50 bg-sky-500/15 text-sky-100",
  PRODUCTION: "border-rose-500/50 bg-rose-500/15 text-rose-100",
} as const;

export function AdminEnvironmentBadge() {
  const [info, setInfo] = useState<AdminEnvironmentInfo | null>(null);

  useEffect(() => {
    setInfo(getAdminEnvironmentInfo(window.location.hostname));
  }, []);

  if (!info) return null;

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/70 px-3 py-2 text-right">
      <div
        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${LABEL_STYLES[info.label]}`}
      >
        {info.label}
      </div>
      <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
        Project:{" "}
        <span className="font-semibold text-slate-200">
          {info.projectId || "unset"}
        </span>
      </div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
        Mode: <span className="font-semibold text-slate-200">{info.mode}</span>
      </div>
    </div>
  );
}
