"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, CheckCircle2, Loader2, Trophy } from "lucide-react";

import { auth, db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UITeam = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

type ConfirmFeaturedTeamResponse = {
  ok: boolean;
  featured?: ConfirmFeaturedTeam;
  drawn?: ConfirmFeaturedTeam[];
};

type ConfirmFeaturedTeam = {
  id: string;
  name: string;
  group: string;
  tier: number;
  flagUrl: string;
};

type AppUser = {
  displayName: string | null;
  email?: string | null;
} | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback;
  const raw =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (!raw) return fallback;
  return raw.replace(/^FirebaseError:\s*/i, "").trim() || fallback;
}

type PortfolioItem = {
  role?: string;
  teamId?: string;
};

function readPortfolioItems(value: unknown): PortfolioItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      role: typeof item.role === "string" ? item.role : undefined,
      teamId: typeof item.teamId === "string" ? item.teamId : undefined,
    }));
}

function readEntryConfirmedAt(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Boolean(value.confirmedAt);
}

function compareGroups(a: string, b: string): number {
  const upperA = a.toUpperCase();
  const upperB = b.toUpperCase();
  const singleLetterA = /^[A-L]$/.test(upperA);
  const singleLetterB = /^[A-L]$/.test(upperB);

  if (singleLetterA && singleLetterB) return upperA.localeCompare(upperB);
  if (singleLetterA) return -1;
  if (singleLetterB) return 1;
  return upperA.localeCompare(upperB);
}

function parseConfirmFeaturedTeamPayload(payload: unknown): ConfirmFeaturedTeamResponse {
  if (!isRecord(payload)) return { ok: false };

  const parseTeam = (value: unknown): ConfirmFeaturedTeam | null => {
    if (!isRecord(value)) return null;
    const id = typeof value.id === "string" ? value.id : "";
    if (!id) return null;
    return {
      id,
      name: typeof value.name === "string" ? value.name : id,
      group: typeof value.group === "string" ? value.group : "?",
      tier:
        typeof value.tier === "number"
          ? value.tier
          : Number(value.tier ?? 4),
      flagUrl: typeof value.flagUrl === "string" ? value.flagUrl : "",
    };
  };

  const featured = parseTeam(payload.featured);
  const drawnRaw = Array.isArray(payload.drawn) ? payload.drawn : [];
  const drawn = drawnRaw
    .map((team) => parseTeam(team))
    .filter((team): team is ConfirmFeaturedTeam => team !== null);

  return {
    ok: payload.ok === true,
    featured: featured ?? undefined,
    drawn,
  };
}

function TierBadge({ tier }: { tier: number }) {
  const configs = {
    1: { 
      label: "Elite", 
      class: "bg-gradient-to-br from-amber-400/20 to-yellow-500/10 text-amber-100 border-amber-400/45 shadow-[0_8px_18px_rgba(251,191,36,0.28)]"
    },
    2: { 
      label: "Strong", 
      class: "bg-gradient-to-br from-slate-300/20 to-zinc-300/10 text-slate-100 border-slate-300/45 shadow-[0_8px_18px_rgba(203,213,225,0.18)]"
    },
    3: { 
      label: "Competitive", 
      class: "bg-gradient-to-br from-orange-500/18 to-amber-600/12 text-orange-100 border-orange-500/45 shadow-[0_8px_18px_rgba(249,115,22,0.20)]"
    },
    4: { 
      label: "Underdog", 
      class: "bg-gradient-to-br from-zinc-500/18 to-zinc-700/14 text-zinc-100 border-zinc-400/35 shadow-[0_8px_18px_rgba(113,113,122,0.20)]"
    },
  };

  const config = configs[tier as keyof typeof configs] || configs[4];

  return (
    <div
      className={[
        "inline-flex flex-col items-center rounded-xl border px-2.5 py-1.5 text-center min-w-[88px]",
        config.class,
      ].join(" ")}
    >
      <span className="text-[10px] font-black leading-none tracking-[0.08em] uppercase">
        Tier {tier}
      </span>
      <span className="text-[11px] font-semibold leading-tight mt-0.5">
        {config.label}
      </span>
    </div>
  );
}

export default function FeaturedTeamPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser>(null);
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
      setUser(
        u
          ? {
              displayName: u.displayName ?? null,
              email: u.email ?? null,
            }
          : null
      );
      setChecking(false);

      if (!u) {
        setCheckingProfile(false);
        setDidAutoForward(false);
        return;
      }

      setCheckingProfile(true);

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const rawData = snap.exists() ? snap.data() : null;
        const data = isRecord(rawData) ? rawData : null;

        const portfolio = readPortfolioItems(data?.portfolio);
        const existingFeatured =
          portfolio.find((p) => p.role === "featured")?.teamId ?? null;
        if (existingFeatured) setSelectedTeamId(existingFeatured);

        const isLocked =
          readEntryConfirmedAt(data?.entry) ||
          Boolean(
            existingFeatured &&
              (portfolio.filter((p) => p.role === "drawn").length >= 5)
          );

        if (isLocked) {
          setConfirmed(true);
          setStatus("✅ Entry already confirmed.");

          if (!didAutoForward) {
            setDidAutoForward(true);
            // If user hasn't seen reveal yet, show them the reveal screen
            const hasSeenReveal = data?.hasSeenReveal === true;
            router.replace(hasSeenReveal ? "/dashboard" : "/reveal");
            return;
          }
        }
      } catch (e: unknown) {
        console.error(e);
        setError(friendlyErrorMessage(e, "Failed to load your profile."));
      } finally {
        setCheckingProfile(false);
      }
    });

    return () => unsub();
  }, [router, didAutoForward]);

  // Load teams
  useEffect(() => {
    if (checking || !uid) return;

    (async () => {
      try {
        const q = query(collection(db, "teams"), orderBy("group"), orderBy("name"));
        const snap = await getDocs(q);

        const list: UITeam[] = snap.docs
          .map((d) => {
            const raw = d.data();
            const t = isRecord(raw) ? raw : {};
            const id = typeof t.id === "string" ? t.id : d.id;

            return {
              id,
              name: typeof t.name === "string" ? t.name : "Unknown Team",
              group: typeof t.group === "string" ? t.group : "?",
              tier: typeof t.tier === "number" ? t.tier : Number(t.tier ?? 4),
              flagUrl: typeof t.flagUrl === "string" ? t.flagUrl : "",
            };
          })
          .filter((t) => typeof t.id === "string" && t.id.length > 0);

        setTeams(list);
      } catch (e: unknown) {
        console.error(e);
        setError(friendlyErrorMessage(e, "Failed to load teams."));
      }
    })();
  }, [checking, uid]);

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

  const groups = useMemo(
    () => [...new Set(teams.map((t) => t.group))].sort(compareGroups),
    [teams]
  );

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
    setStatus("Confirming your Star Team...");

    try {
      const confirmFn = httpsCallable(functions, "confirmFeaturedTeam");
      const res = await confirmFn({ teamId: selectedTeamId });

      const data = parseConfirmFeaturedTeamPayload(res.data);

      setConfirmResult(data);
      setSuccessOpen(true);

      await getDoc(doc(db, "users", uid));
      setConfirmed(true);
      setStatus("✅ Star Team confirmed + 5 teams drawn!");
    } catch (e: unknown) {
      console.error(e);
      setError(friendlyErrorMessage(e, "Failed to confirm featured team."));
      setStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function closeSuccessAndGoReveal() {
    setSuccessOpen(false);
    router.push("/reveal");
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
          <div className="mb-7 text-center max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight mb-2">
              Pick Your Star Team
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Choose one team to be the star of your squad.
            </p>
            <p className="mt-3 text-sm sm:text-base font-semibold text-primary">
              Your Star Team earns <span className="font-black">2× points</span> — choose wisely.
            </p>
            <div className="mt-4 rounded-xl border border-border bg-background/60 px-4 py-3 text-left">
              <p className="text-xs sm:text-sm font-semibold text-foreground mb-1">
                After you pick:
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                You'll automatically get 5 more teams to complete your squad of 6.
                Everyone ends up with the <span className="font-semibold text-foreground">same mix
                of favourites and underdogs</span> — no matter who you choose as your Star —
                so the game is fair for everyone.
              </p>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Joining after the tournament started?</span>
                {" "}You'll only score from matches that haven't kicked off yet.
                Historical results don't count.
              </p>
            </div>
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
          <div className="mb-6 max-w-5xl mx-auto rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-4 sm:p-5">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11"
                disabled={gridLocked}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterGroup === null ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterGroup(null)}
                disabled={gridLocked}
                className="h-9"
              >
                <Filter className="w-4 h-4 mr-1" />
                All
              </Button>
              {groups.map((group) => (
                <Button
                  key={group}
                  variant={filterGroup === group ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterGroup(filterGroup === group ? null : group)}
                  disabled={gridLocked}
                  className="h-9"
                >
                  {group}
                </Button>
              ))}
            </div>
          </div>

          {/* Team Grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-w-5xl mx-auto ${
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
                    relative p-4 rounded-2xl border cursor-pointer transition-all duration-200
                    ${
                      isSelected
                        ? "bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border-primary shadow-xl shadow-primary/25"
                        : "bg-black/25 border-white/10 hover:border-primary/50 hover:bg-black/30"
                    }
                  `}
                >
                  {isSelected && (
                    <div className="absolute -top-2 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-20 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3" /> SELECTED
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <div
                        className={[
                          "w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border bg-black/30 flex items-center justify-center",
                          isSelected ? "border-primary shadow-lg shadow-primary/20" : "border-white/20",
                        ].join(" ")}
                      >
                        {team.flagUrl ? (
                          <img
                            src={team.flagUrl}
                            alt={team.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        )}
                      </div>

                      <div className="min-w-0 text-left">
                        <h4 className="font-bold text-foreground text-base sm:text-lg leading-tight truncate">
                          {team.name}
                        </h4>
                        <div className="text-xs text-muted-foreground font-medium mt-1">
                          {team.id}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-foreground">
                        Group {team.group}
                      </div>
                      <TierBadge tier={team.tier} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredTeams.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No teams found for this search or group.
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
                {selectedTeam ? (
                  <div className="text-[10px] text-primary font-semibold mt-0.5">
                    Featured team earns 2x points
                  </div>
                ) : null}
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
              <DialogTitle className="text-center text-3xl sm:text-4xl font-black tracking-tight">
                You&apos;re In! 🎉
              </DialogTitle>
              <DialogDescription className="text-center text-base sm:text-lg text-muted-foreground">
                Star Team confirmed. Five more teams are ready.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/12 to-primary/5 p-5 text-center shadow-[0_16px_36px_rgba(16,185,129,0.18)]">
                <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">
                  Your Star Team
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/30 bg-background">
                    {confirmResult?.featured?.flagUrl ? (
                      <img
                        src={confirmResult.featured.flagUrl}
                        alt={confirmResult.featured.name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                    {confirmResult?.featured?.name ?? "—"}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-primary">
                    Earns 2× points — your multiplier team
                  </div>
                </div>
              </div>

              <Button
                onClick={closeSuccessAndGoReveal}
                className="w-full h-14 text-base sm:text-lg font-black tracking-wide"
                size="lg"
              >
                Reveal Your Squad
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
