"use client"

import { useState } from "react"
import { Trophy, TrendingUp, Star, Zap, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const myTeams = [
  {
    code: "ARG",
    name: "Argentina",
    flag: "🇦🇷",
    group: "A",
    tier: 1,
    points: 45,
    isChosen: true,
    status: "active",
    nextMatch: "vs Mexico",
    nextMatchTime: "Tomorrow 18:00",
    form: ["W", "W", "D", "W", "W"],
  },
  {
    code: "GER",
    name: "Germany",
    flag: "🇩🇪",
    group: "C",
    tier: 1,
    points: 38,
    isChosen: false,
    status: "active",
    nextMatch: "vs France",
    nextMatchTime: "Today 21:00",
    form: ["W", "D", "W", "L", "W"],
  },
  {
    code: "JPN",
    name: "Japan",
    flag: "🇯🇵",
    group: "E",
    tier: 3,
    points: 22,
    isChosen: false,
    status: "active",
    nextMatch: "vs Australia",
    nextMatchTime: "Wed 15:00",
    form: ["W", "W", "W", "D", "L"],
  },
  {
    code: "MAR",
    name: "Morocco",
    flag: "🇲🇦",
    group: "F",
    tier: 2,
    points: 31,
    isChosen: false,
    status: "active",
    nextMatch: "vs Senegal",
    nextMatchTime: "Thu 18:00",
    form: ["D", "W", "W", "W", "D"],
  },
  {
    code: "CRO",
    name: "Croatia",
    flag: "🇭🇷",
    group: "H",
    tier: 2,
    points: 28,
    isChosen: false,
    status: "eliminated",
    nextMatch: null,
    nextMatchTime: null,
    form: ["L", "D", "W", "L", "L"],
  },
  {
    code: "TUN",
    name: "Tunisia",
    flag: "🇹🇳",
    group: "L",
    tier: 4,
    points: 8,
    isChosen: false,
    status: "eliminated",
    nextMatch: null,
    nextMatchTime: null,
    form: ["L", "L", "D", "L", "L"],
  },
]

const tierColors: Record<number, string> = {
  1: "from-amber-500 to-yellow-300",
  2: "from-slate-400 to-slate-200",
  3: "from-amber-700 to-amber-500",
  4: "from-zinc-600 to-zinc-400",
}

const tierLabels: Record<number, string> = {
  1: "Elite",
  2: "Contender",
  3: "Dark Horse",
  4: "Underdog",
}

export function MyPortfolioPage() {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  const totalPoints = myTeams.reduce((sum, t) => sum + t.points, 0)
  const activeTeams = myTeams.filter((t) => t.status === "active").length
  const eliminatedTeams = myTeams.filter((t) => t.status === "eliminated").length

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">My Portfolio</h1>
                <p className="text-xs text-muted-foreground">6 Teams Assigned</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Points Summary Card */}
        <div className="bg-gradient-to-br from-primary/20 via-card to-card border border-primary/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Points</p>
              <p className="text-5xl font-bold text-foreground">{totalPoints}</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-primary">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+12 today</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Rank #7 of 98</p>
            </div>
          </div>

          {/* Team Status Summary */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{activeTeams}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-destructive">{eliminatedTeams}</p>
              <p className="text-xs text-muted-foreground">Eliminated</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-foreground">1</p>
              <p className="text-xs text-muted-foreground">Transfer Left</p>
            </div>
          </div>
        </div>

        {/* Tier Legend */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Object.entries(tierLabels).map(([tier, label]) => (
            <div
              key={tier}
              className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shrink-0"
            >
              <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", tierColors[Number(tier)])} />
              <span className="text-xs text-muted-foreground">
                T{tier}: {label}
              </span>
            </div>
          ))}
        </div>

        {/* Teams List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Teams</h2>

          {myTeams.map((team) => (
            <div
              key={team.code}
              className={cn(
                "bg-card border border-border rounded-xl overflow-hidden transition-all duration-300",
                team.status === "eliminated" && "opacity-60",
                expandedTeam === team.code && "ring-2 ring-primary/30",
              )}
            >
              {/* Main Row */}
              <button
                onClick={() => setExpandedTeam(expandedTeam === team.code ? null : team.code)}
                className="w-full p-4 flex items-center gap-4"
              >
                {/* Flag & Status */}
                <div className="relative">
                  <span className="text-4xl">{team.flag}</span>
                  {team.isChosen && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Star className="w-3 h-3 text-primary-foreground fill-primary-foreground" />
                    </div>
                  )}
                  {team.status === "eliminated" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-2 border-destructive rounded-full flex items-center justify-center bg-background/80">
                        <span className="text-destructive text-xs font-bold">OUT</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Team Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{team.name}</span>
                    {team.isChosen && (
                      <Badge variant="secondary" className="text-[10px]">
                        Your Pick
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] border-0 bg-gradient-to-r text-white", tierColors[team.tier])}
                    >
                      Tier {team.tier}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Group {team.group}</span>
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{team.points}</p>
                  <p className="text-xs text-muted-foreground">pts</p>
                </div>

                <ChevronRight
                  className={cn(
                    "w-5 h-5 text-muted-foreground transition-transform",
                    expandedTeam === team.code && "rotate-90",
                  )}
                />
              </button>

              {/* Expanded Details */}
              {expandedTeam === team.code && (
                <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                  <div className="pt-4 space-y-4">
                    {/* Form */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Recent Form</p>
                      <div className="flex gap-1">
                        {team.form.map((result, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                              result === "W" && "bg-primary/20 text-primary",
                              result === "D" && "bg-muted text-muted-foreground",
                              result === "L" && "bg-destructive/20 text-destructive",
                            )}
                          >
                            {result}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Next Match */}
                    {team.nextMatch && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Clock className="w-3 h-3" />
                          <span>Next Match</span>
                        </div>
                        <p className="font-medium text-foreground">{team.nextMatch}</p>
                        <p className="text-xs text-muted-foreground">{team.nextMatchTime}</p>
                      </div>
                    )}

                    {/* Points Breakdown */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Points Breakdown</p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-foreground">18</p>
                          <p className="text-[10px] text-muted-foreground">Wins</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-foreground">12</p>
                          <p className="text-[10px] text-muted-foreground">Goals</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-foreground">9</p>
                          <p className="text-[10px] text-muted-foreground">C.Sheets</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-sm font-bold text-foreground">6</p>
                          <p className="text-[10px] text-muted-foreground">Bonus</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Transfer CTA */}
        {eliminatedTeams > 0 && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-foreground">Transfer Window Open</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You have {eliminatedTeams} eliminated team(s). Swap them for active teams at a point cost.
                </p>
                <Button className="mt-3" size="sm">
                  Open Transfer Market
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
