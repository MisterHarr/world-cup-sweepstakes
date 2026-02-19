"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { auth, db } from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";

type RevealTeam = {
  code: string;
  name: string;
  flag: string;
  tier: number;
  isChosen: boolean;
};

const tierColors: Record<number, string> = {
  1: "from-amber-500 to-yellow-300",
  2: "from-slate-400 to-slate-200",
  3: "from-amber-700 to-amber-500",
  4: "from-zinc-600 to-zinc-400",
};

const tierLabels: Record<number, string> = {
  1: "Elite",
  2: "Contender",
  3: "Dark Horse",
  4: "Underdog",
};

export default function TeamRevealPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedTeams, setAssignedTeams] = useState<RevealTeam[]>([]);

  const [revealedCount, setRevealedCount] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const revealComplete = revealedCount >= assignedTeams.length && assignedTeams.length > 0;

  // Auth and data fetch
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        await loadUserTeams(u.uid);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function loadUserTeams(uid: string) {
    try {
      const userDocRef = doc(db, "users", uid);
      const userSnap = await getDoc(userDocRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();

      // If user has already seen reveal, redirect to dashboard
      if (userData.hasSeenReveal) {
        router.replace("/dashboard");
        return;
      }

      const featuredTeamId = userData.entry?.featuredTeamId;
      const drawnTeamIds = userData.entry?.drawnTeamIds || [];

      // Fetch all 6 teams (featured + 5 drawn)
      const allTeamIds = Array.from(
        new Set([featuredTeamId, ...drawnTeamIds].filter(Boolean))
      );
      const teams: RevealTeam[] = [];

      for (const teamId of allTeamIds) {
        const teamRef = doc(db, "teams", teamId);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          teams.push({
            code: teamData.code || teamId,
            name: teamData.name || teamId,
            flag: teamData.flagUrl || "🏳️",
            tier: teamData.tier || 4,
            isChosen: teamId === featuredTeamId,
          });
        }
      }

      // Sort: featured first (already revealed), then by tier
      teams.sort((a, b) => {
        if (a.isChosen) return -1;
        if (b.isChosen) return 1;
        return a.tier - b.tier;
      });

      setAssignedTeams(teams);
      // Auto-reveal the featured team (first card)
      if (teams.length > 0 && teams[0].isChosen) {
        setRevealedCount(1);
      }
    } catch (err) {
      console.error("Error loading teams:", err);
    }
  }

  const handleRevealNext = (index?: number) => {
    // If index provided, reveal that specific card
    const targetIndex = index !== undefined ? index : revealedCount;

    if (targetIndex >= assignedTeams.length || isRevealing) return;
    if (targetIndex < revealedCount) return; // Already revealed

    setIsRevealing(true);

    setTimeout(() => {
      setRevealedCount(targetIndex + 1);
      setIsRevealing(false);

      // Show confetti on every reveal
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
    }, 300);
  };

  const handleRevealAll = () => {
    let count = revealedCount;
    const interval = setInterval(() => {
      if (count >= assignedTeams.length) {
        clearInterval(interval);
        return;
      }
      setRevealedCount((prev) => prev + 1);
      count++;
    }, 400);
  };

  const handleViewPortfolio = async () => {
    // Mark reveal as seen
    if (user?.uid) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          hasSeenReveal: true,
        });
      } catch (err) {
        console.error("Error updating hasSeenReveal:", err);
      }
    }
    router.push("/dashboard");
  };

  if (loading || assignedTeams.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="min-h-[calc(100vh-73px)] relative overflow-hidden pb-8 bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50">
        {/* Confetti Effect */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-20px`,
                  backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"][
                    Math.floor(Math.random() * 5)
                  ],
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Background Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] pointer-events-none" />

        <main className="container mx-auto px-4 py-8 relative z-10">
          {/* Intro Section */}
          <div className="text-center mb-8 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight mb-3">
              Your World Cup Squad
            </h1>
            <p className="text-primary text-base sm:text-lg font-semibold">
              Featured Team earns <span className="font-black">2x points</span> while active.
            </p>
            <p className="text-muted-foreground text-sm sm:text-base mt-2">
              Tap each card to reveal your full squad.
            </p>
          </div>

          {/* Reveal Progress */}
          <div className="flex justify-center gap-2 mb-8">
            {assignedTeams.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  i < revealedCount ? "bg-primary scale-100" : "bg-muted scale-75"
                )}
              />
            ))}
          </div>

          {/* Team Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto mb-8">
            {assignedTeams.map((team, index) => (
              <div
                key={`${team.code}:${index}`}
                onClick={() => handleRevealNext(index)}
                className={cn(
                  "relative aspect-[3/4] sm:aspect-[4/5] rounded-2xl transition-all duration-500 perspective-1000",
                  index >= revealedCount && "cursor-pointer hover:scale-105"
                )}
              >
                {/* Card Container - Flip Animation */}
                <div
                  className={cn(
                    "relative w-full h-full transition-transform duration-700 transform-style-preserve-3d"
                  )}
                  style={{
                    transform: index < revealedCount ? "rotateY(0deg)" : "rotateY(180deg)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* Front of Card (Revealed) */}
                  <div
                    className={cn(
                      "absolute inset-0 backface-hidden rounded-2xl border overflow-hidden",
                      "bg-gradient-to-br from-card via-card to-muted/50 border-border",
                      team.tier === 1 && "border-amber-500/50 shadow-lg shadow-amber-500/20",
                      team.isChosen &&
                        "border-primary shadow-[0_20px_45px_rgba(16,185,129,0.28)] ring-2 ring-primary/40"
                    )}
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    {/* Tier Banner */}
                    <div
                      className={cn(
                        "absolute top-0 left-0 right-0 py-1 text-center text-[10px] sm:text-xs font-bold text-white bg-gradient-to-r",
                        tierColors[team.tier]
                      )}
                    >
                      Tier {team.tier}: {tierLabels[team.tier]}
                    </div>

                    {/* Featured Badge */}
                    {team.isChosen && (
                      <div className="absolute top-8 sm:top-10 left-1/2 -translate-x-1/2 rounded-full border border-primary/50 bg-primary/20 px-2.5 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-primary">
                        Featured · 2x
                      </div>
                    )}

                    {/* Team Content */}
                    <div className="flex flex-col items-center justify-center h-full pt-7 sm:pt-9">
                      <div
                        className={cn(
                          "w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl overflow-hidden mb-2.5 sm:mb-4 border-2",
                          team.isChosen ? "border-primary/70" : "border-border"
                        )}
                      >
                        {team.flag ? (
                          <img src={team.flag} alt={team.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-4xl">🏳️</span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-[28px] font-black text-foreground text-center px-2 sm:px-3 leading-tight">
                        {team.name}
                      </h3>
                      <p className="text-[11px] sm:text-lg text-muted-foreground font-semibold tracking-wider mt-0.5 sm:mt-1">
                        {team.code}
                      </p>
                    </div>

                    {/* Shine Effect for Tier 1 */}
                    {team.tier === 1 && index < revealedCount && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent animate-shine pointer-events-none" />
                    )}
                  </div>

                  {/* Back of Card (Hidden) */}
                  <div
                    className="absolute inset-0 backface-hidden rounded-2xl border border-border bg-card flex items-center justify-center"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                        <span className="text-4xl">?</span>
                      </div>
                      <p className="text-sm text-muted-foreground font-semibold">
                        Team #{index + 1}
                      </p>
                      {index === 0 && (
                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">
                          Featured Team
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-20 sm:pb-0">
            {!revealComplete ? (
              <Button
                variant="outline"
                size="lg"
                onClick={handleRevealAll}
                className="w-full sm:w-auto"
              >
                Reveal All
              </Button>
            ) : null}
          </div>

          {revealComplete ? (
            <div className="fixed inset-x-0 bottom-4 z-40 px-4">
              <div className="mx-auto max-w-sm">
                <Button
                  size="lg"
                  onClick={handleViewPortfolio}
                  className="w-full h-14 text-lg font-black tracking-tight shadow-[0_18px_40px_rgba(16,185,129,0.35)]"
                >
                  See My Teams
                </Button>
              </div>
            </div>
          ) : null}
        </main>

        <style jsx>{`
          @keyframes confetti {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          .animate-confetti {
            animation: confetti linear forwards;
          }
          @keyframes shine {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .animate-shine {
            animation: shine 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    </AppShell>
  );
}
