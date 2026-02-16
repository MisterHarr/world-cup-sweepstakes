"use client"

import { Trophy, Medal, TrendingUp, TrendingDown, Minus, Crown, Target, Zap } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const leaderboardData = [
  { rank: 1, name: "Sarah Chen", team: "Argentina", teamFlag: "🇦🇷", points: 2450, change: "up", wins: 8, avatar: "SC" },
  { rank: 2, name: "Mike Johnson", team: "Brazil", teamFlag: "🇧🇷", points: 2380, change: "up", wins: 7, avatar: "MJ" },
  { rank: 3, name: "Emma Wilson", team: "France", teamFlag: "🇫🇷", points: 2290, change: "down", wins: 7, avatar: "EW" },
  { rank: 4, name: "James Lee", team: "Germany", teamFlag: "🇩🇪", points: 2150, change: "same", wins: 6, avatar: "JL" },
  { rank: 5, name: "Lisa Park", team: "England", teamFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", points: 2080, change: "up", wins: 6, avatar: "LP" },
  { rank: 6, name: "David Kim", team: "Spain", teamFlag: "🇪🇸", points: 1990, change: "down", wins: 5, avatar: "DK" },
  {
    rank: 7,
    name: "Amy Zhang",
    team: "Netherlands",
    teamFlag: "🇳🇱",
    points: 1920,
    change: "up",
    wins: 5,
    avatar: "AZ",
  },
  { rank: 8, name: "Tom Brown", team: "Portugal", teamFlag: "🇵🇹", points: 1850, change: "same", wins: 5, avatar: "TB" },
  {
    rank: 9,
    name: "Rachel Green",
    team: "Belgium",
    teamFlag: "🇧🇪",
    points: 1780,
    change: "down",
    wins: 4,
    avatar: "RG",
  },
  {
    rank: 10,
    name: "Chris Taylor",
    team: "Croatia",
    teamFlag: "🇭🇷",
    points: 1710,
    change: "up",
    wins: 4,
    avatar: "CT",
  },
]

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
  return <span className="text-sm font-bold text-muted-foreground">{rank}</span>
}

const getChangeIcon = (change: string) => {
  if (change === "up") return <TrendingUp className="w-4 h-4 text-emerald-500" />
  if (change === "down") return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-muted-foreground" />
}

export function LeaderboardPage() {
  const currentUser = leaderboardData[4] // Simulating current user at rank 5

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
              <p className="text-xs text-muted-foreground">World Cup 2026 Sweepstakes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
          <div className="bg-card/50 backdrop-blur border border-border rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mx-auto mb-2">
              <Crown className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">2,450</p>
            <p className="text-xs text-muted-foreground">Top Score</p>
          </div>
          <div className="bg-card/50 backdrop-blur border border-border rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">24</p>
            <p className="text-xs text-muted-foreground">Players</p>
          </div>
          <div className="bg-card/50 backdrop-blur border border-border rounded-xl p-4 text-center">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
              <Zap className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">32</p>
            <p className="text-xs text-muted-foreground">Matches</p>
          </div>
        </div>

        {/* Your Position Card */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {currentUser.avatar}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Position</p>
                <p className="text-xl font-bold text-foreground">
                  #{currentUser.rank} - {currentUser.name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-2xl">{currentUser.teamFlag}</span>
                <span className="text-lg font-bold text-primary">{currentUser.points} pts</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">370 pts behind leader</p>
            </div>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-card/30 backdrop-blur border border-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5 md:col-span-4">Player</div>
            <div className="col-span-3 md:col-span-3 hidden md:block">Team</div>
            <div className="col-span-3 md:col-span-2 text-right">Points</div>
            <div className="col-span-3 md:col-span-2 text-right">Wins</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/50">
            {leaderboardData.map((player, index) => (
              <div
                key={player.rank}
                className={cn(
                  "grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-muted/20",
                  player.rank <= 3 && "bg-primary/5",
                  player.name === currentUser.name && "bg-primary/10 border-l-2 border-l-primary",
                )}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    {getRankIcon(player.rank)}
                  </div>
                </div>

                {/* Player */}
                <div className="col-span-5 md:col-span-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                      player.rank === 1
                        ? "bg-yellow-500/20 text-yellow-500"
                        : player.rank === 2
                          ? "bg-gray-400/20 text-gray-400"
                          : player.rank === 3
                            ? "bg-amber-600/20 text-amber-600"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    {player.avatar}
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{player.name}</p>
                    <div className="flex items-center gap-1 md:hidden">
                      <span className="text-base">{player.teamFlag}</span>
                      <span className="text-xs text-muted-foreground">{player.team}</span>
                    </div>
                  </div>
                </div>

                {/* Team - Hidden on mobile */}
                <div className="col-span-3 hidden md:flex items-center gap-2">
                  <span className="text-xl">{player.teamFlag}</span>
                  <span className="text-sm text-muted-foreground">{player.team}</span>
                </div>

                {/* Points */}
                <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-2">
                  <span className="font-bold text-foreground">{player.points.toLocaleString()}</span>
                  {getChangeIcon(player.change)}
                </div>

                {/* Wins */}
                <div className="col-span-3 md:col-span-2 text-right">
                  <Badge variant="secondary" className="font-medium">
                    {player.wins} W
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prize Pool */}
        <div className="mt-8 bg-card/30 backdrop-blur border border-border rounded-xl p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Prize Pool</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                <Crown className="w-6 h-6 text-yellow-500" />
              </div>
              <p className="font-bold text-foreground">$500</p>
              <p className="text-xs text-muted-foreground">1st Place</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-400/20 flex items-center justify-center mx-auto mb-2">
                <Medal className="w-6 h-6 text-gray-400" />
              </div>
              <p className="font-bold text-foreground">$250</p>
              <p className="text-xs text-muted-foreground">2nd Place</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-600/20 flex items-center justify-center mx-auto mb-2">
                <Medal className="w-6 h-6 text-amber-600" />
              </div>
              <p className="font-bold text-foreground">$100</p>
              <p className="text-xs text-muted-foreground">3rd Place</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
