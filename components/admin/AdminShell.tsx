"use client";

import { usePathname } from "next/navigation";
import { AdminEnvironmentBadge } from "./AdminEnvironmentBadge";

const NAV = [
  { href: "/admin",                label: "Overview"   },
  { href: "/admin/fixtures",       label: "Match Data" },
  { href: "/admin/users",          label: "Players"    },
  { href: "/admin/leaderboard",    label: "Standings"  },
  { href: "/admin/pot",            label: "Prize Pot"  },
  { href: "/admin/seed-teams",     label: "Teams"      },
  { href: "/admin/runbook",        label: "Checklist"  },
];

interface AdminShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** When true, expand content to screen-xl rather than constraining width */
  wide?: boolean;
}

export function AdminShell({ title, subtitle, children, wide = false }: AdminShellProps) {
  const pathname = usePathname();
  const width = wide ? "max-w-screen-xl" : "max-w-screen-xl";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">

      {/* ── Top nav ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/95 backdrop-blur-sm">
        <div className={`${width} mx-auto px-4 md:px-6`}>
          <div className="flex items-center gap-3 h-11">
            {/* Brand */}
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 shrink-0 select-none">
              Admin
            </span>
            <div className="w-px h-4 bg-slate-800 shrink-0" />
            {/* Nav links */}
            <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
              {NAV.map((link) => {
                const active =
                  link.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(link.href);
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? "bg-slate-800 text-slate-100"
                        : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    {link.label}
                  </a>
                );
              })}
            </nav>
            <AdminEnvironmentBadge />
          </div>
        </div>
      </div>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className={`${width} mx-auto px-4 md:px-6 pt-5 pb-3`}>
        <h1 className="text-lg font-bold tracking-tight text-slate-100">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        ) : null}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className={`${width} mx-auto px-4 md:px-6 pb-16`}>
        {children}
      </div>
    </div>
  );
}

/** Consistent section label above a panel group */
export function AdminSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
      {children}
    </p>
  );
}
