"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AppShellV0 } from "@/components/app-shell-v0";
import { BRANDING } from "@/lib/branding";
import { auth, db } from "@/lib/firebase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { buildMainNavItems } from "@/lib/mainNav";
import { BADGES } from "@/lib/badgeDefinitions";
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { cn } from "@/lib/utils";

type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
type DisplayBadgeRarity = "uncommon" | "rare" | "epic" | "legendary";
type BadgeFilter = "all" | DisplayBadgeRarity;

type BadgeAchievement = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rarity: DisplayBadgeRarity;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  total?: number;
};

const rarityOrder: DisplayBadgeRarity[] = [
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

const rarityColors: Record<DisplayBadgeRarity, string> = {
  uncommon: "from-emerald-500 to-lime-400",
  rare: "from-sky-500 to-cyan-400",
  epic: "from-fuchsia-500 to-pink-400",
  legendary: "from-amber-500 to-yellow-300",
};

const rarityBorders: Record<DisplayBadgeRarity, string> = {
  uncommon: "border-emerald-400/35",
  rare: "border-sky-400/35",
  epic: "border-fuchsia-400/35",
  legendary: "border-amber-400/45",
};

const rarityGlow: Record<DisplayBadgeRarity, string> = {
  uncommon: "shadow-[0_14px_30px_rgba(16,185,129,0.2)]",
  rare: "shadow-[0_14px_30px_rgba(14,165,233,0.24)]",
  epic: "shadow-[0_14px_30px_rgba(217,70,239,0.24)]",
  legendary: "shadow-[0_16px_34px_rgba(245,158,11,0.28)]",
};

const rarityText: Record<DisplayBadgeRarity, string> = {
  uncommon: "text-emerald-300",
  rare: "text-sky-300",
  epic: "text-fuchsia-300",
  legendary: "text-amber-400",
};

type BadgeUnlockMeta = {
  unlockedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toDisplayRarity(value: BadgeRarity | string | undefined): DisplayBadgeRarity {
  if (value === "rare") return "rare";
  if (value === "epic") return "epic";
  if (value === "legendary") return "legendary";
  return "uncommon";
}

function formatBadgeDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return value;
  }

  if (isRecord(value) && typeof value.toDate === "function") {
    try {
      const dt = value.toDate();
      if (dt instanceof Date && !Number.isNaN(dt.getTime())) {
        return dt.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }
    } catch {
      return undefined;
    }
  }

  if (isRecord(value) && typeof value.seconds === "number") {
    const dt = new Date(value.seconds * 1000);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  return undefined;
}

function readUnlockedBadges(value: unknown): Record<string, BadgeUnlockMeta> {
  const source = isRecord(value) ? value : {};
  const unlocked: Record<string, BadgeUnlockMeta> = {};

  const addUnlocked = (badgeId: unknown, unlockedAt?: unknown) => {
    if (typeof badgeId !== "string" || badgeId.trim().length === 0) return;
    unlocked[badgeId] = {
      unlockedAt: formatBadgeDate(unlockedAt),
    };
  };

  if (Array.isArray(source.earnedBadges)) {
    source.earnedBadges.forEach((entry: unknown) => {
      if (typeof entry === "string") {
        addUnlocked(entry);
        return;
      }
      if (!isRecord(entry)) return;
      if (entry.unlocked === false) return;
      addUnlocked(entry.badgeId, entry.unlockedAt);
    });
  }

  if (Array.isArray(source.badges)) {
    source.badges.forEach((entry: unknown) => {
      if (typeof entry === "string") {
        addUnlocked(entry);
        return;
      }
      if (!isRecord(entry)) return;
      if (entry.unlocked === false) return;
      addUnlocked(entry.badgeId, entry.unlockedAt);
    });
  }

  if (isRecord(source.badges)) {
    Object.entries(source.badges).forEach(([badgeId, badgeValue]) => {
      if (badgeValue === true) {
        addUnlocked(badgeId);
        return;
      }
      if (!isRecord(badgeValue)) return;
      if (badgeValue.unlocked === false) return;
      if (badgeValue.unlocked === true || badgeValue.unlockedAt) {
        addUnlocked(badgeId, badgeValue.unlockedAt);
      }
    });
  }

  return unlocked;
}

export default function BadgesPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [activeFilter, setActiveFilter] = useState<BadgeFilter>("all");
  const [unlockedBadgeMap, setUnlockedBadgeMap] = useState<
    Record<string, BadgeUnlockMeta>
  >({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setUnlockedBadgeMap({});
      return;
    }

    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setUnlockedBadgeMap(readUnlockedBadges(data));
      },
      () => {
        setUnlockedBadgeMap({});
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const achievements: BadgeAchievement[] = useMemo(
    () =>
      BADGES.map((badge) => {
        const unlock = unlockedBadgeMap[badge.id];
        return {
          id: badge.id,
          title: badge.name,
          desc: badge.description,
          icon: badge.icon,
          rarity: toDisplayRarity(badge.rarity),
          unlocked: Boolean(unlock),
          unlockedAt: unlock?.unlockedAt,
        };
      }),
    [unlockedBadgeMap]
  );

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPercent =
    achievements.length > 0
      ? Math.round((unlockedCount / achievements.length) * 100)
      : 0;
  const filteredAchievements =
    activeFilter === "all"
      ? achievements
      : achievements.filter((achievement) => achievement.rarity === activeFilter);
  const rarityCounts: Record<DisplayBadgeRarity, number> = {
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
            <div className="text-[11px] sm:text-[12px] text-muted-foreground max-w-[50vw] sm:max-w-[280px] truncate text-right leading-tight">
              {user ? (
                user.displayName ? (
                  <>
                    <span className="sm:hidden">{user.displayName}</span>
                    <span className="hidden sm:inline">{`Signed in as ${user.displayName}`}</span>
                  </>
                ) : (
                  "Signed in"
                )
              ) : (
                "Signed out"
              )}
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 max-w-6xl">

          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
              Badge Vault
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {unlockedCount}/{achievements.length} unlocked
            </p>
          </div>

          {/* Progress Overview */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6 mb-6 shadow-[0_12px_28px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Achievement Progress</span>
              <span className="text-2xl font-black text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Rarity Filters */}
          <div className="mb-6 overflow-x-auto pb-1">
            <div className="inline-flex min-w-full sm:min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 p-1">
              {(["all", ...rarityOrder] as BadgeFilter[]).map((filter) => {
                const isActive = activeFilter === filter;
                const label = filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1);
                const count =
                  filter === "all" ? achievements.length : rarityCounts[filter];
                const rarityTone = filter === "all" ? null : filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all border",
                      isActive
                        ? rarityTone
                          ? cn(
                              "bg-zinc-900 text-foreground",
                              rarityBorders[rarityTone],
                              rarityGlow[rarityTone]
                            )
                          : "bg-foreground text-background border-transparent shadow-[0_8px_20px_rgba(255,255,255,0.18)]"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:border-white/15",
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

          {/* Always-visible Badge Catalog */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAchievements.length > 0 ? (
              filteredAchievements.map((achievement) => {
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
                        : "opacity-65 saturate-50",
                    )}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 opacity-20",
                        achievement.unlocked
                          ? "bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_60%)]"
                          : "",
                      )}
                    />
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          achievement.unlocked
                            ? cn("bg-gradient-to-br", rarityColors[achievement.rarity])
                            : "bg-muted/70 border border-border",
                        )}
                      >
                        {achievement.unlocked ? (
                          <span className="text-2xl leading-none" aria-hidden="true">
                            {achievement.icon}
                          </span>
                        ) : (
                          <Lock className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-foreground">{achievement.title}</h3>
                          {achievement.unlocked ? (
                            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{achievement.desc}</p>

                        {achievement.unlocked && achievement.unlockedAt ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border border-white/20 bg-gradient-to-r text-white",
                                rarityColors[achievement.rarity],
                              )}
                            >
                              {achievement.rarity.toUpperCase()}
                            </span>
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
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border border-white/20 bg-gradient-to-r text-white",
                                rarityColors[achievement.rarity],
                              )}
                            >
                              {achievement.rarity.toUpperCase()}
                            </span>
                            <span className="text-xs text-muted-foreground">Locked</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="md:col-span-2 rounded-xl border border-white/10 bg-zinc-900/60 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No {activeFilter === "all" ? "" : activeFilter + " "}badges in this view yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShellV0>
  );
}
