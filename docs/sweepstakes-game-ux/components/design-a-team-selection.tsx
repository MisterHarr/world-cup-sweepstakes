"use client"

import { useState } from "react"
import { Trophy, Users, Clock, Search, Filter, CheckCircle2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const teams = [
  { code: "ARG", name: "Argentina", group: "A", flag: "🇦🇷" },
  { code: "MEX", name: "Mexico", group: "A", flag: "🇲🇽" },
  { code: "USA", name: "United States", group: "A", flag: "🇺🇸" },
  { code: "CAN", name: "Canada", group: "A", flag: "🇨🇦" },
  { code: "BRA", name: "Brazil", group: "B", flag: "🇧🇷" },
  { code: "COL", name: "Colombia", group: "B", flag: "🇨🇴" },
  { code: "ECU", name: "Ecuador", group: "B", flag: "🇪🇨" },
  { code: "PER", name: "Peru", group: "B", flag: "🇵🇪" },
  { code: "GER", name: "Germany", group: "C", flag: "🇩🇪" },
  { code: "FRA", name: "France", group: "C", flag: "🇫🇷" },
  { code: "ESP", name: "Spain", group: "C", flag: "🇪🇸" },
  { code: "ITA", name: "Italy", group: "C", flag: "🇮🇹" },
  { code: "ENG", name: "England", group: "D", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "NED", name: "Netherlands", group: "D", flag: "🇳🇱" },
  { code: "POR", name: "Portugal", group: "D", flag: "🇵🇹" },
  { code: "BEL", name: "Belgium", group: "D", flag: "🇧🇪" },
  { code: "JPN", name: "Japan", group: "E", flag: "🇯🇵" },
  { code: "KOR", name: "South Korea", group: "E", flag: "🇰🇷" },
  { code: "AUS", name: "Australia", group: "E", flag: "🇦🇺" },
  { code: "SAU", name: "Saudi Arabia", group: "E", flag: "🇸🇦" },
  { code: "MAR", name: "Morocco", group: "F", flag: "🇲🇦" },
  { code: "SEN", name: "Senegal", group: "F", flag: "🇸🇳" },
  { code: "NGA", name: "Nigeria", group: "F", flag: "🇳🇬" },
  { code: "GHA", name: "Ghana", group: "F", flag: "🇬🇭" },
  { code: "URU", name: "Uruguay", group: "G", flag: "🇺🇾" },
  { code: "CHI", name: "Chile", group: "G", flag: "🇨🇱" },
  { code: "PAR", name: "Paraguay", group: "G", flag: "🇵🇾" },
  { code: "BOL", name: "Bolivia", group: "G", flag: "🇧🇴" },
  { code: "CRO", name: "Croatia", group: "H", flag: "🇭🇷" },
  { code: "SRB", name: "Serbia", group: "H", flag: "🇷🇸" },
  { code: "SUI", name: "Switzerland", group: "H", flag: "🇨🇭" },
  { code: "DEN", name: "Denmark", group: "H", flag: "🇩🇰" },
  { code: "POL", name: "Poland", group: "I", flag: "🇵🇱" },
  { code: "SWE", name: "Sweden", group: "I", flag: "🇸🇪" },
  { code: "UKR", name: "Ukraine", group: "I", flag: "🇺🇦" },
  { code: "CZE", name: "Czech Rep.", group: "I", flag: "🇨🇿" },
  { code: "WAL", name: "Wales", group: "J", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "SCO", name: "Scotland", group: "J", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { code: "AUT", name: "Austria", group: "J", flag: "🇦🇹" },
  { code: "TUR", name: "Turkey", group: "J", flag: "🇹🇷" },
  { code: "QAT", name: "Qatar", group: "K", flag: "🇶🇦" },
  { code: "IRN", name: "Iran", group: "K", flag: "🇮🇷" },
  { code: "IRQ", name: "Iraq", group: "K", flag: "🇮🇶" },
  { code: "UAE", name: "UAE", group: "K", flag: "🇦🇪" },
  { code: "CMR", name: "Cameroon", group: "L", flag: "🇨🇲" },
  { code: "ALG", name: "Algeria", group: "L", flag: "🇩🇿" },
  { code: "EGY", name: "Egypt", group: "L", flag: "🇪🇬" },
  { code: "TUN", name: "Tunisia", group: "L", flag: "🇹🇳" },
]

export function DesignATeamSelection() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterGroup, setFilterGroup] = useState<string | null>(null)

  const filteredTeams = teams.filter((team) => {
    const matchesSearch =
      team.name.toLowerCase().includes(search.toLowerCase()) || team.code.toLowerCase().includes(search.toLowerCase())
    const matchesGroup = !filterGroup || team.group === filterGroup
    return matchesSearch && matchesGroup
  })

  const groups = [...new Set(teams.map((t) => t.group))].sort()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">World Cup 2026</h1>
                <p className="text-xs text-muted-foreground">Office Sweepstakes</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>24 participants</span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Closes in 3 days</span>
              </div>
              <Button variant="outline" size="sm">
                Leaderboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Title Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Choose Your Team</h2>
          <p className="text-muted-foreground">Select one team to represent you in the sweepstakes</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant={filterGroup === null ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterGroup(null)}
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
                className="shrink-0"
              >
                {group}
              </Button>
            ))}
          </div>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {filteredTeams.map((team) => (
            <button
              key={team.code}
              onClick={() => setSelectedTeam(team.code)}
              className={cn(
                "group relative aspect-square rounded-xl transition-all duration-300",
                "bg-card border border-border hover:border-primary/50",
                "hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1",
                "flex flex-col items-center justify-center gap-2 p-3",
                selectedTeam === team.code && "border-primary bg-primary/10 ring-2 ring-primary/30",
              )}
            >
              {/* Selected Indicator */}
              {selectedTeam === team.code && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              {/* Flag */}
              <span className="text-3xl md:text-4xl">{team.flag}</span>

              {/* Team Code */}
              <span className="text-xs font-bold text-foreground">{team.code}</span>

              {/* Group Badge */}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 absolute bottom-2">
                Grp {team.group}
              </Badge>

              {/* Hover Effect */}
              <div
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity",
                  "bg-gradient-to-t from-primary/20 to-transparent",
                  "group-hover:opacity-100",
                )}
              />
            </button>
          ))}
        </div>

        {/* Selection Summary */}
        {selectedTeam && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t border-border">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{teams.find((t) => t.code === selectedTeam)?.flag}</span>
                <div>
                  <p className="font-bold text-foreground">{teams.find((t) => t.code === selectedTeam)?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Group {teams.find((t) => t.code === selectedTeam)?.group}
                  </p>
                </div>
              </div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Confirm Selection</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
