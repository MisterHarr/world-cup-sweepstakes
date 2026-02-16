"use client"

import { useState } from "react"
import { Trophy, Radio, Clock, Calendar, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const liveMatches = [
  {
    id: 1,
    status: "live",
    minute: 67,
    homeTeam: { name: "Argentina", code: "ARG", flag: "🇦🇷", score: 2 },
    awayTeam: { name: "Mexico", code: "MEX", flag: "🇲🇽", score: 1 },
    stadium: "MetLife Stadium",
    group: "A",
  },
  {
    id: 2,
    status: "live",
    minute: 34,
    homeTeam: { name: "France", code: "FRA", flag: "🇫🇷", score: 0 },
    awayTeam: { name: "Germany", code: "GER", flag: "🇩🇪", score: 0 },
    stadium: "SoFi Stadium",
    group: "C",
  },
]

const upcomingMatches = [
  {
    id: 3,
    status: "upcoming",
    time: "18:00",
    date: "Today",
    homeTeam: { name: "Brazil", code: "BRA", flag: "🇧🇷" },
    awayTeam: { name: "Colombia", code: "COL", flag: "🇨🇴" },
    stadium: "AT&T Stadium",
    group: "B",
  },
  {
    id: 4,
    status: "upcoming",
    time: "21:00",
    date: "Today",
    homeTeam: { name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    awayTeam: { name: "Netherlands", code: "NED", flag: "🇳🇱" },
    stadium: "Rose Bowl",
    group: "D",
  },
  {
    id: 5,
    status: "upcoming",
    time: "15:00",
    date: "Tomorrow",
    homeTeam: { name: "Spain", code: "ESP", flag: "🇪🇸" },
    awayTeam: { name: "Italy", code: "ITA", flag: "🇮🇹" },
    stadium: "Hard Rock Stadium",
    group: "C",
  },
]

const recentMatches = [
  {
    id: 6,
    status: "finished",
    homeTeam: { name: "Portugal", code: "POR", flag: "🇵🇹", score: 3 },
    awayTeam: { name: "Belgium", code: "BEL", flag: "🇧🇪", score: 2 },
    stadium: "Levi's Stadium",
    group: "D",
  },
  {
    id: 7,
    status: "finished",
    homeTeam: { name: "Japan", code: "JPN", flag: "🇯🇵", score: 1 },
    awayTeam: { name: "South Korea", code: "KOR", flag: "🇰🇷", score: 1 },
    stadium: "BC Place",
    group: "E",
  },
]

export function LiveScoresPage() {
  const [activeTab, setActiveTab] = useState<"live" | "upcoming" | "results">("live")

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
              <h1 className="text-lg font-bold text-foreground">Live Scores</h1>
              <p className="text-xs text-muted-foreground">World Cup 2026</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 p-1 bg-card/50 rounded-xl border border-border w-fit">
          <Button
            variant={activeTab === "live" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("live")}
            className="gap-2"
          >
            <Radio className="w-4 h-4" />
            Live
            {liveMatches.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center animate-pulse">
                {liveMatches.length}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === "upcoming" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("upcoming")}
            className="gap-2"
          >
            <Calendar className="w-4 h-4" />
            Upcoming
          </Button>
          <Button
            variant={activeTab === "results" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("results")}
            className="gap-2"
          >
            <Clock className="w-4 h-4" />
            Results
          </Button>
        </div>

        {/* Live Matches */}
        {activeTab === "live" && (
          <div className="space-y-4">
            {liveMatches.length === 0 ? (
              <div className="bg-card/30 border border-border rounded-xl p-12 text-center">
                <Radio className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No live matches right now</p>
              </div>
            ) : (
              liveMatches.map((match) => (
                <div
                  key={match.id}
                  className="bg-card/50 backdrop-blur border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
                >
                  {/* Match Status Bar */}
                  <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm font-medium text-red-500">LIVE</span>
                      <span className="text-sm text-muted-foreground">{match.minute}'</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Group {match.group}
                    </Badge>
                  </div>

                  {/* Score Display */}
                  <div className="p-6">
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex-1 text-center">
                        <span className="text-4xl mb-2 block">{match.homeTeam.flag}</span>
                        <p className="font-bold text-foreground">{match.homeTeam.code}</p>
                        <p className="text-xs text-muted-foreground">{match.homeTeam.name}</p>
                      </div>

                      {/* Score */}
                      <div className="px-8">
                        <div className="flex items-center gap-4">
                          <span className="text-4xl font-bold text-foreground">{match.homeTeam.score}</span>
                          <span className="text-2xl text-muted-foreground">-</span>
                          <span className="text-4xl font-bold text-foreground">{match.awayTeam.score}</span>
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 text-center">
                        <span className="text-4xl mb-2 block">{match.awayTeam.flag}</span>
                        <p className="font-bold text-foreground">{match.awayTeam.code}</p>
                        <p className="text-xs text-muted-foreground">{match.awayTeam.name}</p>
                      </div>
                    </div>

                    <p className="text-center text-xs text-muted-foreground mt-4">{match.stadium}</p>
                  </div>

                  {/* Match Details Link */}
                  <div className="px-4 py-3 bg-muted/20 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Match Timeline Available</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Upcoming Matches */}
        {activeTab === "upcoming" && (
          <div className="space-y-3">
            {upcomingMatches.map((match) => (
              <div
                key={match.id}
                className="bg-card/50 backdrop-blur border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {match.date} • {match.time}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Group {match.group}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">{match.homeTeam.flag}</span>
                    <div>
                      <p className="font-medium text-foreground">{match.homeTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{match.homeTeam.code}</p>
                    </div>
                  </div>

                  <span className="text-muted-foreground font-medium px-4">VS</span>

                  {/* Away Team */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="text-right">
                      <p className="font-medium text-foreground">{match.awayTeam.name}</p>
                      <p className="text-xs text-muted-foreground">{match.awayTeam.code}</p>
                    </div>
                    <span className="text-2xl">{match.awayTeam.flag}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-3">{match.stadium}</p>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {activeTab === "results" && (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match.id}
                className="bg-card/50 backdrop-blur border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="secondary" className="text-xs">
                    Full Time
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Group {match.group}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  {/* Home Team */}
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">{match.homeTeam.flag}</span>
                    <div>
                      <p className="font-medium text-foreground">{match.homeTeam.name}</p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-3 px-4">
                    <span
                      className={cn(
                        "text-xl font-bold",
                        match.homeTeam.score > match.awayTeam.score ? "text-primary" : "text-foreground",
                      )}
                    >
                      {match.homeTeam.score}
                    </span>
                    <span className="text-muted-foreground">-</span>
                    <span
                      className={cn(
                        "text-xl font-bold",
                        match.awayTeam.score > match.homeTeam.score ? "text-primary" : "text-foreground",
                      )}
                    >
                      {match.awayTeam.score}
                    </span>
                  </div>

                  {/* Away Team */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    <div className="text-right">
                      <p className="font-medium text-foreground">{match.awayTeam.name}</p>
                    </div>
                    <span className="text-2xl">{match.awayTeam.flag}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center mt-3">{match.stadium}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
