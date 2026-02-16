"use client"
import { Award, Lock, CheckCircle2, Star, Zap, Shield, Target, Flame, Trophy, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const achievements = [
  {
    id: 1,
    title: "First Blood",
    desc: "Your team scores the first goal of the tournament",
    icon: Zap,
    unlocked: true,
    unlockedAt: "Jun 12, 2026",
    rarity: "common",
  },
  {
    id: 2,
    title: "Clean Sheet King",
    desc: "Your team keeps 3 clean sheets",
    icon: Shield,
    unlocked: true,
    unlockedAt: "Jun 15, 2026",
    progress: 3,
    total: 3,
    rarity: "uncommon",
  },
  {
    id: 3,
    title: "Giant Slayer",
    desc: "Your lower-tier team beats a Tier 1 team",
    icon: Target,
    unlocked: false,
    progress: 0,
    total: 1,
    rarity: "rare",
  },
  {
    id: 4,
    title: "Hat Trick Hero",
    desc: "A player from your team scores 3 goals in one match",
    icon: Flame,
    unlocked: false,
    progress: 0,
    total: 1,
    rarity: "epic",
  },
  {
    id: 5,
    title: "Underdog Champion",
    desc: "Score 50+ points from Tier 4 teams alone",
    icon: Star,
    unlocked: false,
    progress: 28,
    total: 50,
    rarity: "rare",
  },
  {
    id: 6,
    title: "World Champion",
    desc: "Your team wins the World Cup",
    icon: Trophy,
    unlocked: false,
    progress: 0,
    total: 1,
    rarity: "legendary",
  },
  {
    id: 7,
    title: "Prediction Master",
    desc: "Correctly predict 10 match outcomes",
    icon: Target,
    unlocked: false,
    progress: 4,
    total: 10,
    rarity: "uncommon",
  },
  {
    id: 8,
    title: "Early Bird",
    desc: "Make your team selection in the first 24 hours",
    icon: Clock,
    unlocked: true,
    unlockedAt: "Jun 1, 2026",
    rarity: "common",
  },
]

const rarityColors: Record<string, string> = {
  common: "from-zinc-500 to-zinc-400",
  uncommon: "from-green-500 to-emerald-400",
  rare: "from-blue-500 to-cyan-400",
  epic: "from-purple-500 to-violet-400",
  legendary: "from-amber-500 to-yellow-400",
}

const rarityBorders: Record<string, string> = {
  common: "border-zinc-500/30",
  uncommon: "border-green-500/30",
  rare: "border-blue-500/30",
  epic: "border-purple-500/30",
  legendary: "border-amber-500/30 shadow-lg shadow-amber-500/20",
}

export function AchievementsPage() {
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Achievements</h1>
                <p className="text-xs text-muted-foreground">
                  {unlockedCount}/{achievements.length} Unlocked
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Progress Overview */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Achievement Progress</span>
            <span className="text-sm font-bold text-foreground">
              {Math.round((unlockedCount / achievements.length) * 100)}%
            </span>
          </div>
          <Progress value={(unlockedCount / achievements.length) * 100} className="h-2" />
        </div>

        {/* Rarity Legend */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Object.entries(rarityColors).map(([rarity, colors]) => (
            <div key={rarity} className="flex items-center gap-1.5 shrink-0">
              <div className={cn("w-3 h-3 rounded-full bg-gradient-to-r", colors)} />
              <span className="text-xs text-muted-foreground capitalize">{rarity}</span>
            </div>
          ))}
        </div>

        {/* Achievements Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {achievements.map((achievement) => {
            const Icon = achievement.icon
            return (
              <div
                key={achievement.id}
                className={cn(
                  "relative bg-card border rounded-xl p-4 transition-all",
                  achievement.unlocked ? rarityBorders[achievement.rarity] : "border-border opacity-70",
                )}
              >
                {/* Unlocked Badge */}
                {achievement.unlocked && (
                  <div className="absolute -top-2 -right-2">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-r",
                        rarityColors[achievement.rarity],
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                      achievement.unlocked ? `bg-gradient-to-br ${rarityColors[achievement.rarity]}` : "bg-muted",
                    )}
                  >
                    {achievement.unlocked ? (
                      <Icon className="w-7 h-7 text-white" />
                    ) : (
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className={cn(
                          "font-bold truncate",
                          achievement.unlocked ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {achievement.title}
                      </h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] shrink-0 border-0 text-white bg-gradient-to-r",
                          rarityColors[achievement.rarity],
                        )}
                      >
                        {achievement.rarity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{achievement.desc}</p>

                    {/* Progress or Unlock Date */}
                    {achievement.unlocked ? (
                      <p className="text-xs text-primary mt-2">Unlocked {achievement.unlockedAt}</p>
                    ) : (
                      achievement.progress !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="text-foreground">
                              {achievement.progress}/{achievement.total}
                            </span>
                          </div>
                          <Progress value={(achievement.progress / achievement.total) * 100} className="h-1.5" />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
