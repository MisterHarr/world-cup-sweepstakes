"use client";

import { useState, useEffect } from "react";
import {
  Lock,
  CheckCircle2,
  Sparkles,
  Trophy as TrophyIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { cn } from "@/lib/utils";

type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type BadgeFilter = "all" | BadgeRarity;

type BadgeAchievement = {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  rarity: BadgeRarity;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  total?: number;
};

const achievements: BadgeAchievement[] = [];

const rarityOrder: BadgeRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

const rarityColors: Record<BadgeRarity, string> = {
  common: "from-zinc-500 to-zinc-400",
  uncommon: "from-emerald-500 to-lime-400",
  rare: "from-sky-500 to-cyan-400",
  epic: "from-fuchsia-500 to-pink-400",
  legendary: "from-amber-500 to-yellow-300",
};

const rarityBorders: Record<BadgeRarity, string> = {
  common: "border-zinc-400/35",
  uncommon: "border-emerald-400/35",
  rare: "border-sky-400/35",
  epic: "border-fuchsia-400/35",
  legendary: "border-amber-400/45",
};

const rarityGlow: Record<BadgeRarity, string> = {
  common: "shadow-[0_12px_28px_rgba(148,163,184,0.16)]",
  uncommon: "shadow-[0_14px_30px_rgba(16,185,129,0.2)]",
  rare: "shadow-[0_14px_30px_rgba(14,165,233,0.24)]",
  epic: "shadow-[0_14px_30px_rgba(217,70,239,0.24)]",
  legendary: "shadow-[0_16px_34px_rgba(245,158,11,0.28)]",
};

const rarityText: Record<BadgeRarity, string> = {
  common: "text-zinc-400",
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  epic: "text-fuchsia-300",
  legendary: "text-amber-400",
};

export default function BadgesPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>("all");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPercent =
    achievements.length > 0
      ? Math.round((unlockedCount / achievements.length) * 100)
      : 0;
  const filteredAchievements =
    activeFilter === "all"
      ? achievements
      : achievements.filter((achievement) => achievement.rarity === activeFilter);
  const rarityCounts: Record<BadgeRarity, number> = {
    common: achievements.filter((achievement) => achievement.rarity === "common").length,
    uncommon: achievements.filter((achievement) => achievement.rarity === "uncommon").length,
    rare: achievements.filter((achievement) => achievement.rarity === "rare").length,
    epic: achievements.filter((achievement) => achievement.rarity === "epic").length,
    legendary: achievements.filter((achievement) => achievement.rarity === "legendary").length,
  };

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signInWithGoogle(auth);
    } catch (err) {
      console.error("Sign-in failed:", err);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign-out failed:", err);
    } finally {
      setAuthBusy(false);
    }
  }

  const navItems = buildMainNavItems({
    signedIn: Boolean(user),
    authBusy: loading || authBusy,
    onSignIn: handleGoogleSignIn,
    onSignOut: handleSignOut,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppShellV0 navItems={navItems} activeId="badges">
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 text-foreground selection:bg-primary/20 pb-8">
        <header className="sticky top-0 z-20 bg-card/60 backdrop-blur-md text-foreground border-b border-border shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <div className="max-w-6xl mx-auto px-4 pr-16 sm:pr-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src={BRANDING.logoSrc}
                  alt={BRANDING.logoAlt}
                  className="w-full h-full object-contain"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">{BRANDING.appName}</h1>
            </div>
            <div className="text-[11px] sm:text-[12px] text-muted-foreground max-w-[45vw] sm:max-w-none truncate text-right">
              {user
                ? user.displayName
                  ? `Signed in as ${user.displayName}`
                  : "Signed in"
                : "Signed out"}
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 max-w-6xl">

          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Badge Vault</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {unlockedCount}/{achievements.length} unlocked
              </p>
            </div>
            <Badge
              variant="outline"
              className="w-fit rounded-full border-white/15 bg-zinc-900/70 px-3 py-1 text-xs text-foreground"
            >
              {progressPercent}% complete
            </Badge>
          </div>

          {/* Progress Overview */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-900/75 to-zinc-950/75 p-6 mb-6 shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.18),transparent_52%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.16),transparent_52%)]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Achievement Progress</span>
                <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
          </div>

          {/* Rarity Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            {rarityOrder.map((rarity) => (
              <div
                key={rarity}
                className={cn(
                  "relative overflow-hidden rounded-xl border bg-zinc-900/65 backdrop-blur-sm px-3 py-2",
                  rarityBorders[rarity],
                  rarityGlow[rarity],
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 opacity-30",
                    "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.28),transparent_58%)]",
                  )}
                />
                <div className="relative flex items-center gap-2">
                  <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", rarityColors[rarity])} />
                  <span className={cn("text-xs font-semibold capitalize", rarityText[rarity])}>{rarity}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Rarity Filters */}
          <div className="mb-6 overflow-x-auto pb-1">
            <div className="inline-flex min-w-full sm:min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 p-1">
              {(["all", ...rarityOrder] as BadgeFilter[]).map((filter) => {
                const isActive = activeFilter === filter;
                const label = filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1);
                const count =
                  filter === "all" ? achievements.length : rarityCounts[filter];
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                      isActive
                        ? "bg-foreground text-background shadow-[0_8px_20px_rgba(255,255,255,0.18)]"
                        : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                        isActive
                          ? "bg-background/20 text-background"
                          : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Achievements Grid or Empty State */}
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAchievements.length > 0 ? filteredAchievements.map((achievement) => {
              const Icon = achievement.icon;
              const progressValue =
                typeof achievement.progress === "number"
                  ? achievement.progress
                  : null;
              const totalValue =
                typeof achievement.total === "number" ? achievement.total : null;
              const hasProgress =
                progressValue !== null &&
                totalValue !== null &&
                totalValue > 0;

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    "relative overflow-hidden border rounded-xl p-5 transition-all duration-300 bg-zinc-900/65 backdrop-blur-sm",
                    rarityBorders[achievement.rarity],
                    rarityGlow[achievement.rarity],
                    achievement.unlocked
                      ? "hover:shadow-xl hover:-translate-y-0.5"
                      : "opacity-75",
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 opacity-20",
                      achievement.unlocked ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]" : "",
                    )}
                  />
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        achievement.unlocked
                          ? cn("bg-gradient-to-br", rarityColors[achievement.rarity])
                          : "bg-muted",
                      )}
                    >
                      {achievement.unlocked ? (
                        <Icon className="w-6 h-6 text-white" />
                      ) : (
                        <Lock className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-foreground">{achievement.title}</h3>
                        {achievement.unlocked && (
                          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{achievement.desc}</p>

                      {/* Progress or Unlock Date */}
                      {achievement.unlocked && achievement.unlockedAt ? (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] border-0 bg-gradient-to-r text-white", rarityColors[achievement.rarity])}
                          >
                            {achievement.rarity.toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Unlocked {achievement.unlockedAt}
                          </span>
                        </div>
                      ) : hasProgress ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className={cn("font-medium", rarityText[achievement.rarity])}>
                              {progressValue}/{totalValue}
                            </span>
                          </div>
                          <Progress
                            value={((progressValue ?? 0) / (totalValue ?? 1)) * 100}
                            className="h-2"
                          />
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] border-0 bg-gradient-to-r text-white", rarityColors[achievement.rarity])}
                        >
                          {achievement.rarity.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
              }) : (
                <div className="md:col-span-2 rounded-xl border border-white/10 bg-zinc-900/60 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No {activeFilter === "all" ? "" : activeFilter + " "}badges in this view yet.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative overflow-hidden border border-white/10 rounded-2xl p-12 text-center bg-gradient-to-br from-zinc-900/90 via-zinc-900/75 to-zinc-950/70 shadow-[0_18px_42px_rgba(0,0,0,0.35)]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.2),transparent_52%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.16),transparent_52%)]" />
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full border border-white/15 bg-zinc-800/70 flex items-center justify-center mx-auto mb-4 shadow-[0_10px_20px_rgba(0,0,0,0.25)]">
                  <TrophyIcon className="w-8 h-8 text-amber-300" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Badge Vault Ready</h3>
                <p className="text-sm text-muted-foreground">
                  Your achievement catalog is active. Badge unlocks will light up here with rarity glows as progress is recorded.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-800/70 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Premium rarity tiers enabled
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShellV0>
  );
}
