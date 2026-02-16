"use client"

import { useState } from "react"
import { MyPortfolioPage } from "@/components/my-portfolio-page"
import { TeamRevealPage } from "@/components/team-reveal-page"
import { TransferMarketPage } from "@/components/transfer-market-page"
import { EnhancedLeaderboardPage } from "@/components/enhanced-leaderboard-page"
import { LiveMatchCenterPage } from "@/components/live-match-center-page"
import { AchievementsPage } from "@/components/achievements-page"
import { PredictionsPage } from "@/components/predictions-page"
import { LoginPage } from "@/components/login-page"
import { Button } from "@/components/ui/button"
import { LogIn, Briefcase, Sparkles, ArrowLeftRight, Users, Tv, Award, Target, Menu, X } from "lucide-react"

type Page = "login" | "reveal" | "portfolio" | "transfer" | "leaderboard" | "live" | "achievements" | "predictions"

export default function Home() {
  const [activePage, setActivePage] = useState<Page>("portfolio")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { id: "login" as Page, label: "Login", icon: LogIn },
    { id: "reveal" as Page, label: "Reveal", icon: Sparkles },
    { id: "portfolio" as Page, label: "My Teams", icon: Briefcase },
    { id: "transfer" as Page, label: "Transfer", icon: ArrowLeftRight },
    { id: "leaderboard" as Page, label: "Board", icon: Users },
    { id: "live" as Page, label: "Live", icon: Tv },
    { id: "achievements" as Page, label: "Badges", icon: Award },
    { id: "predictions" as Page, label: "Predict", icon: Target },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navigation */}
      <div className="fixed top-4 right-4 z-50 hidden lg:flex gap-1 p-1 bg-card/90 backdrop-blur-md rounded-xl border border-border shadow-lg">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant={activePage === item.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActivePage(item.id)}
            className="text-xs gap-1.5"
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </Button>
        ))}
      </div>

      {/* Mobile Navigation Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed top-4 right-4 z-50 lg:hidden bg-card/90 backdrop-blur-md"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute top-16 right-4 bg-card border border-border rounded-xl p-2 shadow-xl">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activePage === item.id ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setActivePage(item.id)
                  setMobileMenuOpen(false)
                }}
                className="w-full justify-start gap-2 mb-1"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {activePage === "login" && <LoginPage />}
      {activePage === "reveal" && <TeamRevealPage />}
      {activePage === "portfolio" && <MyPortfolioPage />}
      {activePage === "transfer" && <TransferMarketPage />}
      {activePage === "leaderboard" && <EnhancedLeaderboardPage />}
      {activePage === "live" && <LiveMatchCenterPage />}
      {activePage === "achievements" && <AchievementsPage />}
      {activePage === "predictions" && <PredictionsPage />}
    </div>
  )
}
