"use client"

import { useState, useEffect } from "react"
import { Tv, Clock, MapPin, Bell, BellOff, Zap, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const liveMatches = [
  {
    id: 1,
    home: { code: "ARG", name: "Argentina", flag: "🇦🇷", score: 2 },
    away: { code: "MEX", name: "Mexico", flag: "🇲🇽", score: 1 },
    minute: 67,
    status: "live",
    stadium: "Lusail Stadium",
    events: [
      { minute: 12, type: "goal", team: "home", player: "Messi" },
      { minute: 34, type: "goal", team: "away", player: "Lozano" },
      { minute: 58, type: "goal", team: "home", player: "Alvarez" },
    ],
    yourTeam: true,
    pointsGained: 8,
  },
  {
    id: 2,
    home: { code: "GER", name: "Germany", flag: "🇩🇪", score: 1 },
    away: { code: "FRA", name: "France", flag: "🇫🇷", score: 1 },
    minute: 45,
    status: "live",
    stadium: "Al Bayt Stadium",
    events: [
      { minute: 22, type: "goal", team: "home", player: "Muller" },
      { minute: 41, type: "goal", team: "away", player: "Mbappe" },
    ],
    yourTeam: true,
    pointsGained: 4,
  },
]

const upcomingMatches = [
  {
    id: 3,
    home: { code: "JPN", name: "Japan", flag: "🇯🇵" },
    away: { code: "AUS", name: "Australia", flag: "🇦🇺" },
    time: "Wed 15:00",
    stadium: "Education City Stadium",
    yourTeam: true,
  },
  {
    id: 4,
    home: { code: "MAR", name: "Morocco", flag: "🇲🇦" },
    away: { code: "SEN", name: "Senegal", flag: "🇸🇳" },
    time: "Thu 18:00",
    stadium: "Ahmad Bin Ali Stadium",
    yourTeam: true,
  },
]

export function LiveMatchCenterPage() {
  const [notifications, setNotifications] = useState<Record<number, boolean>>({})
  const [pulseAnimation, setPulseAnimation] = useState(true)

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAnimation((prev) => !prev)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const toggleNotification = (matchId: number) => {
    setNotifications((prev) => ({ ...prev, [matchId]: !prev[matchId] }))
  }

  const totalLivePoints = liveMatches.filter((m) => m.yourTeam).reduce((sum, m) => sum + m.pointsGained, 0)

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-destructive" />
                </div>
                <div
                  className={cn(
                    "absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full",
                    pulseAnimation && "animate-ping",
                  )}
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Match Center</h1>
                <p className="text-xs text-muted-foreground">2 matches live</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Live Points Banner */}
        {totalLivePoints > 0 && (
          <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Points Gained Live</p>
                  <p className="text-xs text-muted-foreground">From your teams currently playing</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold text-primary">+{totalLivePoints}</span>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="live" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-sm">
            <TabsTrigger value="live" className="gap-1">
              <div className={cn("w-2 h-2 rounded-full bg-destructive", pulseAnimation && "animate-pulse")} />
              Live
            </TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          {/* Live Matches */}
          <TabsContent value="live" className="space-y-4">
            {liveMatches.map((match) => (
              <div
                key={match.id}
                className={cn(
                  "bg-card border rounded-xl overflow-hidden",
                  match.yourTeam ? "border-primary/50" : "border-border",
                )}
              >
                {/* Match Header */}
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full bg-destructive", pulseAnimation && "animate-pulse")} />
                    <span className="text-sm font-medium text-destructive">{match.minute}'</span>
                  </div>
                  {match.yourTeam && <Badge className="text-[10px]">Your Team Playing</Badge>}
                </div>

                {/* Score */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    {/* Home Team */}
                    <div className="flex-1 text-center">
                      <span className="text-4xl mb-2 block">{match.home.flag}</span>
                      <p className="font-bold text-foreground">{match.home.code}</p>
                    </div>

                    {/* Score */}
                    <div className="px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold text-foreground">{match.home.score}</span>
                        <span className="text-2xl text-muted-foreground">-</span>
                        <span className="text-4xl font-bold text-foreground">{match.away.score}</span>
                      </div>
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 text-center">
                      <span className="text-4xl mb-2 block">{match.away.flag}</span>
                      <p className="font-bold text-foreground">{match.away.code}</p>
                    </div>
                  </div>

                  {/* Points Gained */}
                  {match.yourTeam && match.pointsGained > 0 && (
                    <div className="mt-4 text-center">
                      <Badge variant="secondary" className="bg-primary/20 text-primary border-0">
                        <TrendingUp className="w-3 h-3 mr-1" />+{match.pointsGained} pts so far
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Match Timeline */}
                <div className="border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-2">Match Events</p>
                  <div className="space-y-2">
                    {match.events.map((event, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground w-8">{event.minute}'</span>
                        <span className="text-lg">⚽</span>
                        <span className="text-foreground">{event.player}</span>
                        <span className="text-muted-foreground">
                          ({event.team === "home" ? match.home.code : match.away.code})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stadium */}
                <div className="border-t border-border px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {match.stadium}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Upcoming Matches */}
          <TabsContent value="upcoming" className="space-y-3">
            {upcomingMatches.map((match) => (
              <div
                key={match.id}
                className={cn("bg-card border rounded-xl p-4", match.yourTeam ? "border-primary/30" : "border-border")}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {match.time}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleNotification(match.id)} className="gap-1">
                    {notifications[match.id] ? (
                      <>
                        <Bell className="w-4 h-4 text-primary fill-primary" />
                        <span className="text-xs">On</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-4 h-4" />
                        <span className="text-xs">Notify</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{match.home.flag}</span>
                    <span className="font-bold text-foreground">{match.home.code}</span>
                  </div>
                  <span className="text-muted-foreground">vs</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{match.away.code}</span>
                    <span className="text-3xl">{match.away.flag}</span>
                  </div>
                </div>

                {match.yourTeam && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <Badge variant="secondary" className="text-[10px]">
                      {match.home.code === "JPN" || match.home.code === "MAR" ? match.home.flag : match.away.flag} Your
                      team playing
                    </Badge>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {match.stadium}
                </div>
              </div>
            ))}
          </TabsContent>

          {/* Results */}
          <TabsContent value="results" className="space-y-3">
            <div className="text-center py-12 text-muted-foreground">
              <p>No completed matches yet</p>
              <p className="text-sm mt-1">Results will appear here after matches finish</p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
