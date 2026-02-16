"use client"

import { Trophy, TrendingUp, Users, Target, Flame, Award, BarChart3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const topScorers = [
  { rank: 1, name: "L. Messi", team: "Argentina", flag: "🇦🇷", goals: 5, assists: 3 },
  { rank: 2, name: "K. Mbappe", team: "France", flag: "🇫🇷", goals: 4, assists: 2 },
  { rank: 3, name: "H. Kane", team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 4, assists: 1 },
  { rank: 4, name: "Vinicius Jr", team: "Brazil", flag: "🇧🇷", goals: 3, assists: 4 },
  { rank: 5, name: "J. Bellingham", team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", goals: 3, assists: 2 },
]

const teamStats = [
  { team: "Argentina", flag: "🇦🇷", played: 3, won: 3, drawn: 0, lost: 0, gf: 8, ga: 2, points: 9 },
  { team: "France", flag: "🇫🇷", played: 3, won: 2, drawn: 1, lost: 0, gf: 6, ga: 2, points: 7 },
  { team: "Germany", flag: "🇩🇪", played: 3, won: 2, drawn: 1, lost: 0, gf: 7, ga: 3, points: 7 },
  { team: "Brazil", flag: "🇧🇷", played: 3, won: 2, drawn: 0, lost: 1, gf: 5, ga: 3, points: 6 },
  { team: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", played: 3, won: 2, drawn: 0, lost: 1, gf: 6, ga: 4, points: 6 },
]

const tournamentStats = [
  { label: "Total Goals", value: 89, icon: Target, color: "text-primary" },
  { label: "Matches Played", value: 32, icon: BarChart3, color: "text-blue-500" },
  { label: "Average Goals/Match", value: "2.78", icon: TrendingUp, color: "text-emerald-500" },
  { label: "Total Cards", value: 67, icon: Award, color: "text-amber-500" },
]

export function StatsPage() {
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
              <h1 className="text-lg font-bold text-foreground">Tournament Stats</h1>
              <p className="text-xs text-muted-foreground">World Cup 2026</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Tournament Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          {tournamentStats.map((stat) => (
            <div key={stat.label} className="bg-card/50 backdrop-blur border border-border rounded-xl p-4">
              <div className={cn("w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Scorers */}
          <div className="bg-card/30 backdrop-blur border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="font-bold text-foreground">Top Scorers</h2>
            </div>
            <div className="divide-y divide-border/50">
              {topScorers.map((player) => (
                <div
                  key={player.rank}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                        player.rank === 1
                          ? "bg-yellow-500/20 text-yellow-500"
                          : player.rank === 2
                            ? "bg-gray-400/20 text-gray-400"
                            : player.rank === 3
                              ? "bg-amber-600/20 text-amber-600"
                              : "bg-muted text-muted-foreground",
                      )}
                    >
                      {player.rank}
                    </div>
                    <span className="text-xl">{player.flag}</span>
                    <div>
                      <p className="font-medium text-foreground text-sm">{player.name}</p>
                      <p className="text-xs text-muted-foreground">{player.team}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">{player.goals}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Goals</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{player.assists}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">Assists</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-card/30 backdrop-blur border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-foreground">Team Performance</h2>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase">
              <div className="col-span-4">Team</div>
              <div className="col-span-1 text-center">P</div>
              <div className="col-span-1 text-center">W</div>
              <div className="col-span-1 text-center">D</div>
              <div className="col-span-1 text-center">L</div>
              <div className="col-span-2 text-center">GD</div>
              <div className="col-span-2 text-center">Pts</div>
            </div>

            <div className="divide-y divide-border/50">
              {teamStats.map((team, index) => (
                <div
                  key={team.team}
                  className={cn(
                    "grid grid-cols-12 gap-1 px-4 py-3 items-center hover:bg-muted/20 transition-colors",
                    index < 2 && "bg-primary/5",
                  )}
                >
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="text-lg">{team.flag}</span>
                    <span className="font-medium text-foreground text-sm truncate">{team.team}</span>
                  </div>
                  <div className="col-span-1 text-center text-sm text-muted-foreground">{team.played}</div>
                  <div className="col-span-1 text-center text-sm text-emerald-500 font-medium">{team.won}</div>
                  <div className="col-span-1 text-center text-sm text-muted-foreground">{team.drawn}</div>
                  <div className="col-span-1 text-center text-sm text-red-500">{team.lost}</div>
                  <div className="col-span-2 text-center text-sm text-foreground">
                    {team.gf - team.ga > 0 ? "+" : ""}
                    {team.gf - team.ga}
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge variant="secondary" className="font-bold">
                      {team.points}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fun Facts */}
        <div className="mt-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Quick Facts
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">12</p>
              <p className="text-sm text-muted-foreground">Hat-tricks scored</p>
            </div>
            <div className="bg-card/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-sm text-muted-foreground">Own goals</p>
            </div>
            <div className="bg-card/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">94'</p>
              <p className="text-sm text-muted-foreground">Latest goal scored</p>
            </div>
            <div className="bg-card/50 rounded-lg p-4">
              <p className="text-2xl font-bold text-primary">5-0</p>
              <p className="text-sm text-muted-foreground">Biggest win margin</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
