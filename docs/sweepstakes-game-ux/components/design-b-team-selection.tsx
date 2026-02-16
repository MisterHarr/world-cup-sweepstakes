"use client"

import { useState } from "react"
import { Trophy, Users, Sparkles, Search, X, Check, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const teams = [
  { code: "ARG", name: "Argentina", group: "A", flag: "🇦🇷", color: "from-sky-400 to-white" },
  { code: "MEX", name: "Mexico", group: "A", flag: "🇲🇽", color: "from-green-500 to-red-500" },
  { code: "USA", name: "United States", group: "A", flag: "🇺🇸", color: "from-red-500 to-blue-600" },
  { code: "CAN", name: "Canada", group: "A", flag: "🇨🇦", color: "from-red-500 to-white" },
  { code: "BRA", name: "Brazil", group: "B", flag: "🇧🇷", color: "from-yellow-400 to-green-500" },
  { code: "COL", name: "Colombia", group: "B", flag: "🇨🇴", color: "from-yellow-400 to-blue-600" },
  { code: "ECU", name: "Ecuador", group: "B", flag: "🇪🇨", color: "from-yellow-400 to-blue-500" },
  { code: "PER", name: "Peru", group: "B", flag: "🇵🇪", color: "from-red-500 to-white" },
  { code: "GER", name: "Germany", group: "C", flag: "🇩🇪", color: "from-black to-yellow-400" },
  { code: "FRA", name: "France", group: "C", flag: "🇫🇷", color: "from-blue-600 to-red-500" },
  { code: "ESP", name: "Spain", group: "C", flag: "🇪🇸", color: "from-red-600 to-yellow-400" },
  { code: "ITA", name: "Italy", group: "C", flag: "🇮🇹", color: "from-green-500 to-red-500" },
  { code: "ENG", name: "England", group: "D", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", color: "from-white to-red-500" },
  { code: "NED", name: "Netherlands", group: "D", flag: "🇳🇱", color: "from-orange-500 to-white" },
  { code: "POR", name: "Portugal", group: "D", flag: "🇵🇹", color: "from-green-600 to-red-600" },
  { code: "BEL", name: "Belgium", group: "D", flag: "🇧🇪", color: "from-black to-yellow-400" },
  { code: "JPN", name: "Japan", group: "E", flag: "🇯🇵", color: "from-white to-red-500" },
  { code: "KOR", name: "South Korea", group: "E", flag: "🇰🇷", color: "from-white to-red-600" },
  { code: "AUS", name: "Australia", group: "E", flag: "🇦🇺", color: "from-blue-600 to-yellow-400" },
  { code: "SAU", name: "Saudi Arabia", group: "E", flag: "🇸🇦", color: "from-green-600 to-white" },
  { code: "MAR", name: "Morocco", group: "F", flag: "🇲🇦", color: "from-red-600 to-green-600" },
  { code: "SEN", name: "Senegal", group: "F", flag: "🇸🇳", color: "from-green-500 to-yellow-400" },
  { code: "NGA", name: "Nigeria", group: "F", flag: "🇳🇬", color: "from-green-600 to-white" },
  { code: "GHA", name: "Ghana", group: "F", flag: "🇬🇭", color: "from-red-500 to-green-500" },
  { code: "URU", name: "Uruguay", group: "G", flag: "🇺🇾", color: "from-sky-400 to-white" },
  { code: "CHI", name: "Chile", group: "G", flag: "🇨🇱", color: "from-red-600 to-white" },
  { code: "PAR", name: "Paraguay", group: "G", flag: "🇵🇾", color: "from-red-500 to-blue-600" },
  { code: "BOL", name: "Bolivia", group: "G", flag: "🇧🇴", color: "from-red-500 to-green-500" },
  { code: "CRO", name: "Croatia", group: "H", flag: "🇭🇷", color: "from-red-500 to-white" },
  { code: "SRB", name: "Serbia", group: "H", flag: "🇷🇸", color: "from-red-600 to-blue-600" },
  { code: "SUI", name: "Switzerland", group: "H", flag: "🇨🇭", color: "from-red-600 to-white" },
  { code: "DEN", name: "Denmark", group: "H", flag: "🇩🇰", color: "from-red-600 to-white" },
  { code: "POL", name: "Poland", group: "I", flag: "🇵🇱", color: "from-white to-red-500" },
  { code: "SWE", name: "Sweden", group: "I", flag: "🇸🇪", color: "from-blue-600 to-yellow-400" },
  { code: "UKR", name: "Ukraine", group: "I", flag: "🇺🇦", color: "from-blue-500 to-yellow-400" },
  { code: "CZE", name: "Czech Rep.", group: "I", flag: "🇨🇿", color: "from-blue-600 to-red-500" },
  { code: "WAL", name: "Wales", group: "J", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", color: "from-red-600 to-green-600" },
  { code: "SCO", name: "Scotland", group: "J", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", color: "from-blue-700 to-white" },
  { code: "AUT", name: "Austria", group: "J", flag: "🇦🇹", color: "from-red-600 to-white" },
  { code: "TUR", name: "Turkey", group: "J", flag: "🇹🇷", color: "from-red-600 to-white" },
  { code: "QAT", name: "Qatar", group: "K", flag: "🇶🇦", color: "from-purple-800 to-white" },
  { code: "IRN", name: "Iran", group: "K", flag: "🇮🇷", color: "from-green-500 to-red-500" },
  { code: "IRQ", name: "Iraq", group: "K", flag: "🇮🇶", color: "from-red-500 to-green-600" },
  { code: "UAE", name: "UAE", group: "K", flag: "🇦🇪", color: "from-green-500 to-red-500" },
  { code: "CMR", name: "Cameroon", group: "L", flag: "🇨🇲", color: "from-green-500 to-yellow-400" },
  { code: "ALG", name: "Algeria", group: "L", flag: "🇩🇿", color: "from-green-600 to-white" },
  { code: "EGY", name: "Egypt", group: "L", flag: "🇪🇬", color: "from-red-600 to-black" },
  { code: "TUN", name: "Tunisia", group: "L", flag: "🇹🇳", color: "from-red-600 to-white" },
]

export function DesignBTeamSelection() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null)
  const [showGroups, setShowGroups] = useState(false)
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
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent py-8 md:py-12">
        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <Trophy className="w-8 h-8 text-primary-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary-foreground/80">
                  Office Sweepstakes 2026
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-primary-foreground mb-2">Pick Your Champion! ⚽</h1>
              <p className="text-primary-foreground/80 text-sm md:text-base">
                48 teams, 1 winner. Make your choice count!
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Users className="w-5 h-5 mx-auto mb-1 text-primary-foreground" />
                <span className="block text-2xl font-bold text-primary-foreground">24</span>
                <span className="text-xs text-primary-foreground/80">Players</span>
              </div>
              <div className="text-center p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
                <Sparkles className="w-5 h-5 mx-auto mb-1 text-primary-foreground" />
                <span className="block text-2xl font-bold text-primary-foreground">$500</span>
                <span className="text-xs text-primary-foreground/80">Prize Pool</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 -mt-6 relative z-20">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search for a team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 h-14 text-lg bg-card shadow-xl border-2 border-border rounded-2xl focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowGroups(!showGroups)}
              className="h-14 px-6 rounded-2xl border-2 shadow-xl bg-card w-full sm:w-auto"
            >
              <span className="mr-2">{filterGroup ? `Group ${filterGroup}` : "All Groups"}</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showGroups && "rotate-180")} />
            </Button>

            {showGroups && (
              <div className="absolute top-full mt-2 right-0 w-full sm:w-64 bg-card border-2 border-border rounded-2xl shadow-2xl p-2 z-30">
                <button
                  onClick={() => {
                    setFilterGroup(null)
                    setShowGroups(false)
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 rounded-xl transition-colors",
                    !filterGroup ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  All Groups
                </button>
                <div className="grid grid-cols-4 gap-1 mt-2">
                  {groups.map((group) => (
                    <button
                      key={group}
                      onClick={() => {
                        setFilterGroup(group)
                        setShowGroups(false)
                      }}
                      className={cn(
                        "px-3 py-2 rounded-xl font-bold transition-colors text-sm",
                        filterGroup === group ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Grid - Card Style */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {filteredTeams.map((team) => (
            <button
              key={team.code}
              onClick={() => setSelectedTeam(selectedTeam === team.code ? null : team.code)}
              onMouseEnter={() => setHoveredTeam(team.code)}
              onMouseLeave={() => setHoveredTeam(null)}
              className={cn(
                "group relative aspect-square rounded-2xl transition-all duration-300",
                "bg-card border-2 border-border shadow-md",
                "hover:shadow-2xl hover:-translate-y-2 hover:border-primary",
                "flex flex-col items-center justify-center overflow-hidden",
                selectedTeam === team.code && "border-primary ring-4 ring-primary/30 shadow-2xl shadow-primary/20",
              )}
            >
              {/* Background Gradient on Hover */}
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300",
                  team.color,
                  (hoveredTeam === team.code || selectedTeam === team.code) && "opacity-20",
                )}
              />

              {/* Selected Check */}
              {selectedTeam === team.code && (
                <div className="absolute top-1 right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              {/* Flag */}
              <span
                className={cn(
                  "text-4xl md:text-5xl transition-transform duration-300",
                  (hoveredTeam === team.code || selectedTeam === team.code) && "scale-110",
                )}
              >
                {team.flag}
              </span>

              {/* Team Info */}
              <div className="mt-2 text-center relative z-10">
                <span className="block text-xs font-black text-foreground">{team.code}</span>
                <span className="block text-[10px] text-muted-foreground font-medium">Group {team.group}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Empty State */}
        {filteredTeams.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl mb-4 block">🔍</span>
            <h3 className="text-xl font-bold text-foreground mb-2">No teams found</h3>
            <p className="text-muted-foreground">Try a different search term or filter</p>
          </div>
        )}
      </main>

      {/* Selection Footer */}
      {selectedTeam && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-xl border-t-2 border-border shadow-2xl animate-in slide-in-from-bottom duration-300">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl",
                  teams.find((t) => t.code === selectedTeam)?.color,
                )}
              >
                {teams.find((t) => t.code === selectedTeam)?.flag}
              </div>
              <div>
                <p className="text-lg font-black text-foreground">{teams.find((t) => t.code === selectedTeam)?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Group {teams.find((t) => t.code === selectedTeam)?.group} • Your Pick
                </p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setSelectedTeam(null)}
                className="flex-1 sm:flex-none h-12 rounded-xl"
              >
                Change
              </Button>
              <Button className="flex-1 sm:flex-none h-12 rounded-xl px-8 bg-primary text-primary-foreground hover:bg-primary/90">
                <Sparkles className="w-4 h-4 mr-2" />
                Lock In Selection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
