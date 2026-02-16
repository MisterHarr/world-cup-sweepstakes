"use client"

import { useState } from "react"
import { Trophy, Crown, Medal, TrendingUp, TrendingDown, Minus, Building2, Sparkles, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const participants = [
  { rank: 1, name: "Sarah Chen", dept: "Engineering", points: 234, change: 2, teams: ["🇦🇷", "🇫🇷", "🇧🇷"], isYou: false },
  {
    rank: 2,
    name: "Mike Johnson",
    dept: "Marketing",
    points: 228,
    change: -1,
    teams: ["🇩🇪", "🇪🇸", "🇳🇱"],
    isYou: false,
  },
  { rank: 3, name: "Emma Wilson", dept: "Design", points: 221, change: 1, teams: ["🇬🇧", "🇵🇹", "🇧🇪"], isYou: false },
  { rank: 4, name: "James Lee", dept: "Engineering", points: 215, change: 0, teams: ["🇯🇵", "🇰🇷", "🇦🇺"], isYou: false },
  { rank: 5, name: "Lisa Park", dept: "Sales", points: 208, change: 3, teams: ["🇲🇦", "🇸🇳", "🇳🇬"], isYou: false },
  { rank: 6, name: "Tom Brown", dept: "HR", points: 195, change: -2, teams: ["🇺🇾", "🇨🇱", "🇵🇾"], isYou: false },
  { rank: 7, name: "You", dept: "Engineering", points: 172, change: 1, teams: ["🇦🇷", "🇩🇪", "🇯🇵"], isYou: true },
  { rank: 8, name: "Amy Taylor", dept: "Finance", points: 168, change: -1, teams: ["🇭🇷", "🇷🇸", "🇨🇭"], isYou: false },
  { rank: 9, name: "Chris Davis", dept: "Operations", points: 162, change: 2, teams: ["🇵🇱", "🇸🇪", "🇺🇦"], isYou: false },
  { rank: 10, name: "Nina Patel", dept: "Product", points: 155, change: 0, teams: ["🏴󠁧󠁢󠁷󠁬󠁳󠁿", "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "🇦🇹"], isYou: false },
]

const departments = [
  { name: "Engineering", points: 621, members: 24, rank: 1 },
  { name: "Marketing", points: 534, members: 18, rank: 2 },
  { name: "Design", points: 489, members: 15, rank: 3 },
  { name: "Sales", points: 445, members: 20, rank: 4 },
  { name: "Finance", points: 398, members: 12, rank: 5 },
]

const specialAwards = [
  { title: "Underdog Champion", desc: "Most points from Tier 4 teams", leader: "Chris Davis", points: 48, icon: "🐕" },
  { title: "Giant Slayer", desc: "Most upset wins", leader: "Lisa Park", points: 5, icon: "⚔️" },
  { title: "Consistency King", desc: "Smallest rank variance", leader: "James Lee", points: 2, icon: "📊" },
  { title: "Wooden Spoon", desc: "Last place (with pride!)", leader: "Bob Smith", points: 42, icon: "🥄" },
]

export function EnhancedLeaderboardPage() {
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [showWhatIf, setShowWhatIf] = useState(false)

  const filteredParticipants = selectedDept ? participants.filter((p) => p.dept === selectedDept) : participants

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Leaderboard</h1>
                <p className="text-xs text-muted-foreground">98 Participants</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowWhatIf(!showWhatIf)}>
              <Sparkles className="w-4 h-4 mr-1" />
              What If?
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="overall" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="overall">Overall</TabsTrigger>
            <TabsTrigger value="department">By Dept</TabsTrigger>
            <TabsTrigger value="special">Awards</TabsTrigger>
          </TabsList>

          {/* Overall Leaderboard */}
          <TabsContent value="overall" className="space-y-4">
            {/* Top 3 Podium */}
            <div className="grid grid-cols-3 gap-2 mb-6">
              {/* 2nd Place */}
              <div className="flex flex-col items-center pt-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-400 to-slate-200 flex items-center justify-center text-2xl font-bold text-slate-800">
                    2
                  </div>
                  <Medal className="absolute -top-1 -right-1 w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-foreground mt-2 text-center">{participants[1].name}</p>
                <p className="text-xs text-muted-foreground">{participants[1].points} pts</p>
                <div className="flex gap-0.5 mt-1">
                  {participants[1].teams.map((t, i) => (
                    <span key={i} className="text-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-yellow-300 flex items-center justify-center text-3xl font-bold text-amber-900 ring-4 ring-amber-500/30">
                    1
                  </div>
                  <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-500" />
                </div>
                <p className="text-sm font-bold text-foreground mt-2 text-center">{participants[0].name}</p>
                <p className="text-xs text-primary font-medium">{participants[0].points} pts</p>
                <div className="flex gap-0.5 mt-1">
                  {participants[0].teams.map((t, i) => (
                    <span key={i} className="text-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center pt-8">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-700 to-amber-500 flex items-center justify-center text-xl font-bold text-amber-100">
                    3
                  </div>
                  <Medal className="absolute -top-1 -right-1 w-5 h-5 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-foreground mt-2 text-center">{participants[2].name}</p>
                <p className="text-xs text-muted-foreground">{participants[2].points} pts</p>
                <div className="flex gap-0.5 mt-1">
                  {participants[2].teams.map((t, i) => (
                    <span key={i} className="text-sm">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Department Filter */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedDept === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDept(null)}
                className="shrink-0"
              >
                <Filter className="w-4 h-4 mr-1" />
                All
              </Button>
              {[...new Set(participants.map((p) => p.dept))].map((dept) => (
                <Button
                  key={dept}
                  variant={selectedDept === dept ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDept(selectedDept === dept ? null : dept)}
                  className="shrink-0"
                >
                  {dept}
                </Button>
              ))}
            </div>

            {/* Rankings List */}
            <div className="space-y-2">
              {filteredParticipants.slice(3).map((p) => (
                <div
                  key={p.rank}
                  className={cn(
                    "flex items-center gap-4 p-4 bg-card border border-border rounded-xl transition-all",
                    p.isYou && "border-primary ring-2 ring-primary/30 bg-primary/5",
                  )}
                >
                  {/* Rank */}
                  <div className="w-8 text-center">
                    <span className={cn("text-lg font-bold", p.isYou ? "text-primary" : "text-muted-foreground")}>
                      {p.rank}
                    </span>
                  </div>

                  {/* Change Indicator */}
                  <div className="w-6">
                    {p.change > 0 && (
                      <div className="flex items-center text-primary">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    )}
                    {p.change < 0 && (
                      <div className="flex items-center text-destructive">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    )}
                    {p.change === 0 && <Minus className="w-4 h-4 text-muted-foreground" />}
                  </div>

                  {/* Name & Dept */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", p.isYou ? "text-primary" : "text-foreground")}>{p.name}</span>
                      {p.isYou && <Badge className="text-[10px]">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.dept}</p>
                  </div>

                  {/* Teams */}
                  <div className="flex gap-0.5">
                    {p.teams.slice(0, 3).map((t, i) => (
                      <span key={i} className="text-lg">
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* Points */}
                  <div className="text-right w-16">
                    <span className="text-lg font-bold text-foreground">{p.points}</span>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Your Position (if scrolled) */}
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40">
              <div className="bg-card/95 backdrop-blur-xl border border-primary/50 rounded-xl p-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="font-bold text-primary">7</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Your Position</p>
                    <p className="text-xs text-muted-foreground">4 pts behind #6</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-foreground">172</p>
                    <div className="flex items-center gap-1 text-primary text-xs">
                      <TrendingUp className="w-3 h-3" />
                      +1
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Department Leaderboard */}
          <TabsContent value="department" className="space-y-4">
            <div className="space-y-3">
              {departments.map((dept, i) => (
                <div
                  key={dept.name}
                  className={cn(
                    "p-4 bg-card border border-border rounded-xl",
                    i === 0 && "border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-transparent",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                        i === 0 && "bg-gradient-to-br from-amber-500 to-yellow-300 text-amber-900",
                        i === 1 && "bg-gradient-to-br from-slate-400 to-slate-200 text-slate-800",
                        i === 2 && "bg-gradient-to-br from-amber-700 to-amber-500 text-amber-100",
                        i > 2 && "bg-muted text-muted-foreground",
                      )}
                    >
                      {dept.rank}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="font-bold text-foreground">{dept.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dept.members} members</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{dept.points}</p>
                      <p className="text-xs text-muted-foreground">total pts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Special Awards */}
          <TabsContent value="special" className="space-y-4">
            <p className="text-center text-muted-foreground mb-4">Additional prizes for unique achievements</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {specialAwards.map((award) => (
                <div key={award.title} className="p-4 bg-card border border-border rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{award.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">{award.title}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{award.desc}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{award.leader}</span>
                        <Badge variant="secondary">
                          {award.points} {award.title === "Giant Slayer" ? "wins" : "pts"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* What If Simulator */}
        {showWhatIf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowWhatIf(false)} />
            <div className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                What If Simulator
              </h3>
              <p className="text-sm text-muted-foreground mb-4">See how match results could affect your position</p>

              <div className="space-y-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">If Argentina beats Mexico (3-1):</p>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Your new position:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground line-through">#7</span>
                      <span className="text-xl font-bold text-primary">#5</span>
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">If Germany draws vs France (1-1):</p>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Your new position:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground line-through">#7</span>
                      <span className="text-xl font-bold text-foreground">#6</span>
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-4" onClick={() => setShowWhatIf(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
