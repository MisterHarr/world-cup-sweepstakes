"use client"

import { useState } from "react"
import { ArrowLeftRight, Clock, AlertTriangle, Check, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const eliminatedTeams = [
  { code: "CRO", name: "Croatia", flag: "🇭🇷", tier: 2, points: 28 },
  { code: "TUN", name: "Tunisia", flag: "🇹🇳", tier: 4, points: 8 },
]

const availableTeams = [
  { code: "URU", name: "Uruguay", flag: "🇺🇾", tier: 2, potential: 45, cost: 15, form: ["W", "W", "D"] },
  { code: "SEN", name: "Senegal", flag: "🇸🇳", tier: 2, potential: 38, cost: 12, form: ["W", "D", "W"] },
  { code: "AUS", name: "Australia", flag: "🇦🇺", tier: 3, potential: 32, cost: 8, form: ["D", "W", "L"] },
  { code: "KOR", name: "South Korea", flag: "🇰🇷", tier: 3, potential: 35, cost: 10, form: ["W", "W", "W"] },
  { code: "ECU", name: "Ecuador", flag: "🇪🇨", tier: 3, potential: 28, cost: 7, form: ["L", "W", "D"] },
  { code: "IRN", name: "Iran", flag: "🇮🇷", tier: 4, potential: 22, cost: 5, form: ["D", "D", "W"] },
]

const tierColors: Record<number, string> = {
  1: "from-amber-500 to-yellow-300",
  2: "from-slate-400 to-slate-200",
  3: "from-amber-700 to-amber-500",
  4: "from-zinc-600 to-zinc-400",
}

export function TransferMarketPage() {
  const [selectedOut, setSelectedOut] = useState<string | null>(null)
  const [selectedIn, setSelectedIn] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  const currentPoints = 172
  const transfersRemaining = 1

  const selectedOutTeam = eliminatedTeams.find((t) => t.code === selectedOut)
  const selectedInTeam = availableTeams.find((t) => t.code === selectedIn)
  const transferCost = selectedInTeam?.cost || 0

  const filteredTeams = availableTeams.filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Transfer Market</h1>
                <p className="text-xs text-muted-foreground">Swap eliminated teams</p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <Clock className="w-3 h-3" />
              Closes in 2d 14h
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Status Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-medium text-foreground">Transfer Window Active</p>
                <p className="text-sm text-muted-foreground">
                  {transfersRemaining} transfer remaining - costs points from your total
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{currentPoints}</p>
              <p className="text-xs text-muted-foreground">Current Points</p>
            </div>
          </div>
        </div>

        {/* Transfer Interface */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Teams Out */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Select Team to Release
            </h2>
            <div className="space-y-2">
              {eliminatedTeams.map((team) => (
                <button
                  key={team.code}
                  onClick={() => setSelectedOut(team.code)}
                  className={cn(
                    "w-full p-4 bg-card border rounded-xl flex items-center gap-4 transition-all",
                    selectedOut === team.code
                      ? "border-destructive ring-2 ring-destructive/30"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                >
                  <div className="relative">
                    <span className="text-3xl">{team.flag}</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 border-2 border-destructive rounded-full flex items-center justify-center bg-background/80">
                        <span className="text-destructive text-[10px] font-bold">OUT</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-foreground">{team.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] border-0 bg-gradient-to-r text-white", tierColors[team.tier])}
                      >
                        Tier {team.tier}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{team.points} pts earned</span>
                    </div>
                  </div>
                  {selectedOut === team.code && (
                    <div className="w-6 h-6 bg-destructive rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-destructive-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Teams In */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Select Replacement Team
            </h2>

            {/* Search */}
            <div className="relative mb-3">
              <Input
                placeholder="Search teams..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {filteredTeams.map((team) => (
                <button
                  key={team.code}
                  onClick={() => setSelectedIn(team.code)}
                  disabled={!selectedOut}
                  className={cn(
                    "w-full p-4 bg-card border rounded-xl flex items-center gap-4 transition-all",
                    selectedIn === team.code
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-muted-foreground/50",
                    !selectedOut && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="text-3xl">{team.flag}</span>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-foreground">{team.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] border-0 bg-gradient-to-r text-white", tierColors[team.tier])}
                      >
                        Tier {team.tier}
                      </Badge>
                      <div className="flex gap-0.5">
                        {team.form.map((f, i) => (
                          <span
                            key={i}
                            className={cn(
                              "w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold",
                              f === "W" && "bg-primary/20 text-primary",
                              f === "D" && "bg-muted text-muted-foreground",
                              f === "L" && "bg-destructive/20 text-destructive",
                            )}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{team.potential}</p>
                    <p className="text-[10px] text-muted-foreground">max pts</p>
                    <Badge variant="destructive" className="text-[10px] mt-1">
                      -{team.cost} pts
                    </Badge>
                  </div>
                  {selectedIn === team.code && (
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transfer Summary */}
        {selectedOut && selectedIn && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-bold text-foreground mb-4">Transfer Summary</h3>

            <div className="flex items-center justify-center gap-4 mb-6">
              {/* Out */}
              <div className="text-center">
                <span className="text-4xl">{selectedOutTeam?.flag}</span>
                <p className="text-sm font-medium text-foreground mt-1">{selectedOutTeam?.name}</p>
                <Badge variant="destructive" className="mt-1">
                  OUT
                </Badge>
              </div>

              <ArrowLeftRight className="w-8 h-8 text-muted-foreground" />

              {/* In */}
              <div className="text-center">
                <span className="text-4xl">{selectedInTeam?.flag}</span>
                <p className="text-sm font-medium text-foreground mt-1">{selectedInTeam?.name}</p>
                <Badge className="mt-1">IN</Badge>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-muted/30 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Current Points</span>
                <span className="font-bold text-foreground">{currentPoints}</span>
              </div>
              <div className="flex justify-between items-center mb-2 text-destructive">
                <span>Transfer Cost</span>
                <span className="font-bold">-{transferCost}</span>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">Points After Transfer</span>
                  <span className="text-xl font-bold text-foreground">{currentPoints - transferCost}</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                This action cannot be undone. You will lose {transferCost} points and this will be your final transfer
                for this window.
              </p>
            </div>

            <Button className="w-full" size="lg" onClick={() => setShowConfirm(true)}>
              Confirm Transfer
            </Button>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-foreground mb-2">Confirm Transfer?</h3>
            <p className="text-muted-foreground mb-6">
              Swapping {selectedOutTeam?.name} for {selectedInTeam?.name} will cost you {transferCost} points.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button className="flex-1">Confirm</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
