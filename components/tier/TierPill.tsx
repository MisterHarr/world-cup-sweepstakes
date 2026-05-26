"use client";

function tierLabel(tier: number) {
  if (tier === 1) return "Elite";
  if (tier === 2) return "Strong";
  if (tier === 3) return "Competitive";
  return "Underdog";
}

function tierPillClass(tier: number) {
  if (tier === 1) {
    return "bg-gradient-to-br from-amber-400/20 to-yellow-500/10 text-amber-100 border-amber-400/45 shadow-[0_8px_18px_rgba(251,191,36,0.28)]";
  }
  if (tier === 2) {
    return "bg-gradient-to-br from-slate-300/20 to-zinc-300/10 text-slate-100 border-slate-300/45 shadow-[0_8px_18px_rgba(203,213,225,0.18)]";
  }
  if (tier === 3) {
    return "bg-gradient-to-br from-orange-500/18 to-amber-600/12 text-orange-100 border-orange-500/45 shadow-[0_8px_18px_rgba(249,115,22,0.20)]";
  }
  return "bg-gradient-to-br from-zinc-500/18 to-zinc-700/14 text-zinc-100 border-zinc-400/35 shadow-[0_8px_18px_rgba(113,113,122,0.20)]";
}

type TierPillProps = {
  tier: number;
};

export function TierPill({ tier }: TierPillProps) {
  return (
    <div
      className={[
        "inline-flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-center min-w-[88px]",
        tierPillClass(tier),
      ].join(" ")}
    >
      <span className="text-[10px] font-black leading-none tracking-[0.08em] uppercase">
        Tier {tier}
      </span>
      <span className="text-[11px] font-semibold leading-tight mt-0.5">
        {tierLabel(tier)}
      </span>
    </div>
  );
}
