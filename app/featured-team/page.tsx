"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, CheckCircle2, Crown, Loader2, Sparkles, Trophy } from "lucide-react";

import { auth, db, functions } from "@/lib/firebase";
import type { Team } from "@/types";
import { httpsCallable } from "firebase/functions";

import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UITeam = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

type ConfirmFeaturedTeamResponse = {
  ok: boolean;
  featured?: Team;
  drawn?: Team[];
};

function TierBadge({ tier }: { tier: number }) {
  const configs = {
    1: { 
      label: "Elite", 
      class: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-300 border-yellow-500/40 shadow-sm shadow-yellow-500/20" 
    },
    2: { 
      label: "Strong", 
      class: "bg-gradient-to-r from-slate-400/20 to-gray-300/20 text-slate-200 border-slate-400/40 shadow-sm shadow-slate-400/20" 
    },
    3: { 
      label: "Competitive", 
      class: "bg-gradient-to-r from-orange-600/20 to-amber-700/20 text-orange-300 border-orange-600/40 shadow-sm shadow-orange-600/20" 
    },
    4: { 
      label: "Underdog", 
      class: "bg-gradient-to-r from-rose-900/20 to-red-950/20 text-rose-300 border-rose-800/40 shadow-sm shadow-rose-900/20" 
    },
  };

  const config = configs[tier as keyof typeof configs] || configs[4];

  const icons = {
    1: "👑",
    2: "⚡",
    3: "🔥",
    4: "💪",
  };

  const icon = icons[tier as keyof typeof icons] || icons[4];

  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${config.class}`}>
      {icon} Tier {tier} • {config.label}
    </Badge>
  );
}

export default function FeaturedTeamPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [checking, setChecking] = useState(true);

  const [teams, setTeams] = useState<UITeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [checkingProfile, setCheckingProfile] = useState(true);
  const [didAutoForward, setDidAutoForward] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmFeaturedTeamResponse | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUid(u?.uid ?? null);
      setDisplayName(u?.displayName ?? "");
      setUser(u);
      setChecking(false);

      if (!u) {
        setCheckingProfile(false);
        setDidAutoForward(false);
        return;
      }

      setCheckingProfile(true);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.data() as any;

        const dept = data?.department ?? null;
        if (!dept) {
          router.replace("/department?next=/featured-team");
          return;
        }

        const existingFeatured = data?.portfolio?.find((p: any) => p.role === "featured")?.teamId;
        if (existingFeatured) setSelectedTeamId(existingFeatured);

        const isLocked =
          Boolean(data?.entry?.confirmedAt) ||
          Boolean(
            existingFeatured &&
              ((data?.portfolio?.filter((p: any) => p.role === "drawn")?.length ?? 0) >= 5)
          );

        if (isLocked) {
          setConfirmed(true);
          setStatus("✅ Entry already confirmed.");

          if (!didAutoForward) {
            setDidAutoForward(true);
            router.replace("/dashboard");
            return;
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Failed to load your profile.");
      } finally {
        setCheckingProfile(false);
      }
    });

    return () => unsub();
  }, [router, didAutoForward]);

  // Load teams
  useEffect(() => {
    (async () => {
      const q = query(collection(db, "teams"), orderBy("group"), orderBy("name"));
      const snap = await getDocs(q);

      const list: UITeam[] = snap.docs
        .map((d) => {
          const t = d.data() as any;
          const id = (t.id ?? d.id) as string;

          return {
            id,
            name: String(t.name ?? "Unknown Team"),
            group: String(t.group ?? "?"),
            tier: Number(t.tier ?? 4),
            flagUrl: String(t.flagUrl ?? ""),
          };
        })
        .filter((t) => typeof t.id === "string" && t.id.length > 0);

      setTeams(list);
    })();
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  );

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(search.toLowerCase()) ||
        team.id.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = !filterGroup || team.group === filterGroup;
      return matchesSearch && matchesGroup;
    });
  }, [teams, search, filterGroup]);

  const groups = useMemo(() => [...new Set(teams.map((t) => t.group))].sort(), [teams]);

  const gridLocked = checkingProfile || confirmed || isSubmitting || successOpen;

  async function handleConfirm() {
    setError("");
    setStatus("");

    if (!uid) {
      setError("Please sign in first.");
      return;
    }
    if (!selectedTeamId) return;

    if (confirmed) {
      setStatus("✅ Entry already confirmed.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Confirming your Featured Team...");

    try {
      const confirmFn = httpsCallable(functions, "confirmFeaturedTeam");
      const res = await confirmFn({ teamId: selectedTeamId });

      const data = res.data as ConfirmFeaturedTeamResponse;

      setConfirmResult(data);
      setSuccessOpen(true);

      const refreshed = await getDoc(doc(db, "users", uid));
      setConfirmed(true);
      setStatus("✅ Featured Team confirmed + 5 teams drawn!");
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to confirm featured team.");
      setStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeSuccessAndGoDashboard() {
    setSuccessOpen(false);
    router.push("/dashboard");
  }

  if (checking || checkingProfile) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center"
        role="status"
        aria-label="Loading page"
      >
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!uid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">You&apos;re not signed in.</p>
          <Button onClick={() => router.push("/")}>Go to Landing Page</Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell user={user}>
      <div className="min-h-[calc(100vh-73px)] pb-32 bg-gradient-to-br from-zinc-600/90 via-zinc-700/70 to-zinc-800/50">
        <div className="container mx-auto px-4 py-6">
          {/* Page Title */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/40 mb-4 shadow-lg shadow-primary/20">
              <Trophy className="w-10 h-10 text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Select Your Featured Team
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Choose one team to be the star of your squad. It will earn{" "}
              <span className="font-semibold text-primary">double points</span>.
            </p>
          </div>

          {/* Error / Status */}
          {error && (
            <div
              className="mb-4 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-sm text-destructive max-w-2xl mx-auto"
              role="alert"
            >
              {error}
            </div>
          )}
          {status && (
            <div
              className="mb-4 p-3 rounded-xl border border-primary/20 bg-primary/10 text-sm text-primary max-w-2xl mx-auto"
              role="status"
              aria-live="polite"
            >
              {status}
            </div>
          )}

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 max-w-4xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                disabled={gridLocked}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              <Button
                variant={filterGroup === null ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterGroup(null)}
                disabled={gridLocked}
                className="shrink-0"
              >
                <Filter className="w-4 h-4 mr-1" />
                All
              </Button>
              {groups.slice(0, 6).map((group) => (
                <Button
                  key={group}
                  variant={filterGroup === group ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterGroup(filterGroup === group ? null : group)}
                  disabled={gridLocked}
                  className="shrink-0"
                >
                  {group}
                </Button>
              ))}
            </div>
          </div>

          {/* Team Grid */}
          <div
            className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto ${
              gridLocked ? "pointer-events-none opacity-70" : ""
            }`}
          >
            {filteredTeams.map((team) => {
              const isSelected = selectedTeamId === team.id;

              return (
                <div
                  key={team.id}
                  onClick={() => {
                    if (gridLocked) return;
                    setSelectedTeamId(team.id);
                    setConfirmed(false);
                    setStatus("");
                    setError("");
                  }}
                  className={`
                    relative p-4 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-all duration-200 group
                    ${
                      isSelected
                        ? "bg-gradient-to-br from-primary/25 via-primary/15 to-primary/5 border-2 border-primary shadow-xl shadow-primary/30 transform scale-105 z-10"
                        : "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-md hover:shadow-xl hover:border-primary/50 hover:-translate-y-1 hover:from-primary/15 hover:via-primary/8"
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md z-20 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" /> SELECTED
                    </div>
                  )}

                  <div
                    className={`
                      w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-md border overflow-hidden bg-background/50
                      ${
                        isSelected
                          ? "border-primary ring-4 ring-primary/30 shadow-lg shadow-primary/20"
                          : "border-primary/30"
                      }
                    `}
                  >
                    {team.flagUrl ? (
                      <img
                        src={team.flagUrl}
                        alt={team.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <h4 className="font-bold text-foreground text-base mb-1 leading-tight line-clamp-1">
                    {team.name}
                  </h4>
                  <div className="text-xs text-muted-foreground font-medium mb-2">
                    Group {team.group}
                  </div>

                  <TierBadge tier={team.tier} />
                </div>
              );
            })}
          </div>

          {filteredTeams.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No teams found matching your search.
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border/60 p-4 shadow-2xl">
          <div className="container mx-auto max-w-4xl flex flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                  selectedTeamId
                    ? "bg-card border-border"
                    : "bg-muted border-dashed border-border"
                }`}
              >
                {selectedTeam ? (
                  <img
                    src={selectedTeam.flagUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <Trophy className="text-muted-foreground w-5 h-5" />
                )}
              </div>

              <div className="hidden sm:block">
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                  Your Selection
                </div>
                <div
                  className={`text-sm font-bold ${
                    selectedTeam ? "text-foreground" : "text-muted-foreground italic"
                  }`}
                >
                  {selectedTeam ? selectedTeam.name : "No team selected"}
                </div>
              </div>
            </div>

            <Button
              disabled={!uid || !selectedTeamId || confirmed || isSubmitting || checkingProfile}
              onClick={handleConfirm}
              size="lg"
              className="flex-1 md:flex-none md:w-64"
            >
              {confirmed ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmed
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...
                </>
              ) : checkingProfile ? (
                "Checking..."
              ) : (
                "Confirm Featured Team"
              )}
            </Button>
          </div>
        </div>

        {/* Success Dialog */}
        <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                You&apos;re In!
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your featured team is locked and your 5 teams have been drawn.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1 mb-2">
                    <Crown className="w-3 h-3" /> Featured
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-background">
                      {confirmResult?.featured?.flagUrl ? (
                        <img
                          src={confirmResult.featured.flagUrl}
                          alt={confirmResult.featured.name}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {confirmResult?.featured?.name ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Drawn Teams (5)
                  </div>
                  <div className="space-y-2">
                    {(confirmResult?.drawn ?? []).map((t: any) => (
                      <div key={t.id ?? t.name} className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-border bg-background">
                          {t.flagUrl ? (
                            <img
                              src={t.flagUrl}
                              alt={t.name}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="text-sm text-foreground">{t.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={closeSuccessAndGoDashboard} className="w-full" size="lg">
                Continue to Dashboard →
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
