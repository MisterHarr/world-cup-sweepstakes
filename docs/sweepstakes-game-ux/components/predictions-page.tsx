"use client"

import { useState } from "react"
import { Target, Clock, CheckCircle2, X, Flame, TrendingUp, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const predictions = [
  {
    id: 1,
    home: { code: "ARG", flag: "🇦🇷", name: "Argentina" },
    away: { code: "MEX", flag: "🇲🇽", name: "Mexico" },
    kickoff: "Today 18:00",
    status: "open",
    yourPrediction: null,
    bonusPoints: 5,
  },
  {
    id: 2,
    home: { code: "GER", flag: "🇩🇪", name: "Germany" },
    away: { code: "FRA", flag: "🇫🇷", name: "France" },
    kickoff: "Today 21:00",
    status: "open",
    yourPrediction: null,
    bonusPoints: 5,
  },
  {
    id: 3,
    home: { code: "BRA", flag: "🇧🇷", name: "Brazil" },
    away: { code: "COL", flag: "🇨🇴", name: "Colombia" },
    kickoff: "Tomorrow 15:00",
    status: "open",
    yourPrediction: "home",
    bonusPoints: 5,
  },
  {
    id: 4,
    home: { code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "England" },
    away: { code: "NED", flag: "🇳🇱", name: "Netherlands" },
    kickoff: "Yesterday",
    status: "correct",
    yourPrediction: "home",
    actualResult: "home",
    score: "2-1",
    bonusPoints: 5,
  },
  {
    id: 5,
    home: { code: "ESP", flag: "🇪🇸", name: "Spain" },
    away: { code: "ITA", flag: "🇮🇹", name: "Italy" },
    kickoff: "2 days ago",
    status: "incorrect",
    yourPrediction: "home",
    actualResult: "draw",
    score: "1-1",
    bonusPoints: 0,
  },
]

type PredictionChoice = "home" | "draw" | "away"

export function PredictionsPage() {
  const [selectedPredictions, setSelectedPredictions] = useState<Record<number, PredictionChoice>>({
    3: "home",
  })

  const streak = 3
  const totalCorrect = predictions.filter((p) => p.status === "correct").length
  const totalPredictions = predictions.filter((p) => p.status !== "open" || p.yourPrediction).length

  const handlePrediction = (matchId: number, choice: PredictionChoice) => {
    setSelectedPredictions((prev) => ({ ...prev, [matchId]: choice }))
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Predictions</h1>
                <p className="text-xs text-muted-foreground">Earn bonus points</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-2xl font-bold text-foreground">{streak}</span>
            </div>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-2xl font-bold text-foreground">{totalCorrect}</span>
            </div>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span className="text-2xl font-bold text-foreground">+15</span>
            </div>
            <p className="text-xs text-muted-foreground">Bonus pts</p>
          </div>
        </div>

        {/* Streak Bonus */}
        {streak >= 3 && (
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <Flame className="w-6 h-6 text-orange-500" />
              <div>
                <p className="font-bold text-foreground">Hot Streak Bonus Active!</p>
                <p className="text-sm text-muted-foreground">
                  {streak} correct in a row - next correct prediction worth 2x points
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Predictions List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today's Matches</h2>

          {predictions.map((match) => {
            const isOpen = match.status === "open"
            const isCorrect = match.status === "correct"
            const isIncorrect = match.status === "incorrect"
            const currentPrediction = selectedPredictions[match.id] || match.yourPrediction

            return (
              <div
                key={match.id}
                className={cn(
                  "bg-card border rounded-xl overflow-hidden",
                  isCorrect && "border-primary/50",
                  isIncorrect && "border-destructive/50",
                  isOpen && "border-border",
                )}
              >
                {/* Match Header */}
                <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {match.kickoff}
                  </div>
                  {isOpen && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{match.bonusPoints} pts
                    </Badge>
                  )}
                  {isCorrect && (
                    <Badge className="text-[10px] bg-primary">
                      <CheckCircle2 className="w-3 h-3 mr-1" />+{match.bonusPoints} pts
                    </Badge>
                  )}
                  {isIncorrect && (
                    <Badge variant="destructive" className="text-[10px]">
                      <X className="w-3 h-3 mr-1" />
                      Incorrect
                    </Badge>
                  )}
                </div>

                {/* Teams & Prediction */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{match.home.flag}</span>
                      <span className="font-medium text-foreground">{match.home.code}</span>
                    </div>

                    {!isOpen && match.score && <span className="text-lg font-bold text-foreground">{match.score}</span>}
                    {isOpen && <span className="text-muted-foreground">vs</span>}

                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{match.away.code}</span>
                      <span className="text-2xl">{match.away.flag}</span>
                    </div>
                  </div>

                  {/* Prediction Buttons */}
                  {isOpen ? (
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant={currentPrediction === "home" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePrediction(match.id, "home")}
                        className="w-full"
                      >
                        {match.home.code} Win
                      </Button>
                      <Button
                        variant={currentPrediction === "draw" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePrediction(match.id, "draw")}
                        className="w-full"
                      >
                        Draw
                      </Button>
                      <Button
                        variant={currentPrediction === "away" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePrediction(match.id, "away")}
                        className="w-full"
                      >
                        {match.away.code} Win
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Your prediction:</span>
                        <Badge variant="secondary">
                          {match.yourPrediction === "home" && `${match.home.code} Win`}
                          {match.yourPrediction === "draw" && "Draw"}
                          {match.yourPrediction === "away" && `${match.away.code} Win`}
                        </Badge>
                      </div>
                      {!isOpen && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Result:</span>
                          <Badge variant={isCorrect ? "default" : "destructive"}>
                            {match.actualResult === "home" && `${match.home.code} Win`}
                            {match.actualResult === "draw" && "Draw"}
                            {match.actualResult === "away" && `${match.away.code} Win`}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Locked Future Matches */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Coming Soon</h2>
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">More predictions unlock 24 hours before kickoff</p>
          </div>
        </div>
      </main>
    </div>
  )
}
