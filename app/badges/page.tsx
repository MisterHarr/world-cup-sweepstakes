"use client";

import { useState, useEffect } from "react";
import {
  Lock,
  CheckCircle2,
  Star,
  Zap,
  Shield,
  Target,
  Flame,
  Trophy as TrophyIcon,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AppShellV0 } from "@/components/app-shell-v0";
import { auth } from "@/lib/firebase";
import { buildMainNavItems } from "@/lib/mainNav";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { cn } from "@/lib/utils";

// Badges will be fetched from Firestore when implemented
// For now, show empty state until tournament starts
const achievements: any[] = [];

const rarityColors: Record<string, string> = {
  common: "from-zinc-500 to-zinc-400",
  uncommon: "from-green-500 to-emerald-400",
  rare: "from-blue-500 to-cyan-400",
  epic: "from-purple-500 to-violet-400",
  legendary: "from-amber-500 to-yellow-400",
};

const rarityBorders: Record<string, string> = {
  common: "border-zinc-500/30",
  uncommon: "border-green-500/30",
  rare: "border-blue-500/30",
  epic: "border-purple-500/30",
  legendary: "border-amber-500/30 shadow-lg shadow-amber-500/20",
};

const rarityText: Record<string, string> = {
  common: "text-zinc-400",
  uncommon: "text-green-400",
  rare: "text-cyan-400",
  epic: "text-violet-400",
  legendary: "text-amber-400",
};

export default function BadgesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPercent = Math.round((unlockedCount / achievements.length) * 100);

  async function handleGoogleSignIn() {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
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
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between lg:pr-[34rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-md p-1 overflow-hidden border border-white/10">
                <img
                  src="https://www.gardenschool.edu.my/wp-content/uploads/2021/09/gis-logo.png"
                  alt="GIS Logo"
                  className="w-full h-full object-contain"
                  onError={(e: any) => (e.currentTarget.style.display = "none")}
                />
              </div>
              <h1 className="font-bold text-lg tracking-tight">
                GIS 2026{" "}
                <span className="text-muted-foreground/70 font-normal">
                  WORLD CUP SWEEPSTAKE
                </span>
              </h1>
            </div>
            <div className="hidden md:block text-[12px] text-muted-foreground">
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
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground">Badges</h1>
              <p className="text-sm text-muted-foreground">
                {unlockedCount}/{achievements.length} unlocked
              </p>
            </div>
            <Badge variant="outline" className="bg-zinc-800/70 border-border text-foreground">
              {progressPercent}% complete
            </Badge>
          </div>

          {/* Progress Overview */}
          <div className="bg-gradient-to-br from-primary/25 to-zinc-800/60 backdrop-blur-sm border border-primary/40 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Achievement Progress</span>
              <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Rarity Legend */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
            {Object.entries(rarityColors).map(([rarity, colors]) => (
              <div
                key={rarity}
                className="flex items-center gap-2 bg-zinc-800/70 backdrop-blur-sm border border-border/60 rounded-lg px-3 py-1.5 shrink-0 shadow-sm"
              >
                <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", colors)} />
                <span className="text-xs text-muted-foreground capitalize">{rarity}</span>
              </div>
            ))}
          </div>

          {/* Achievements Grid or Empty State */}
          {achievements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => {
              const Icon = achievement.icon;
              const hasProgress = typeof achievement.progress === "number";

              return (
                <div
                  key={achievement.id}
                  className={cn(
                    "bg-zinc-800/60 backdrop-blur-sm border rounded-xl p-5 transition-all duration-300 shadow-md",
                    rarityBorders[achievement.rarity],
                    achievement.unlocked
                      ? "hover:shadow-lg hover:-translate-y-0.5"
                      : "opacity-75",
                  )}
                >
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
                              {achievement.progress}/{achievement.total}
                            </span>
                          </div>
                          <Progress
                            value={(achievement.progress! / achievement.total!) * 100}
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
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <TrophyIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">No Badges Yet</h3>
                <p className="text-sm text-muted-foreground">
                  Badges will be awarded during the tournament based on your team's performance and achievements.
                  Check back when the World Cup begins!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShellV0>
  );
}
