import type { AppShellNavItem } from "@/components/app-shell-v0";
import {
  ArrowLeftRight,
  Award,
  Briefcase,
  LogIn,
  LogOut,
  Tv,
  Users,
} from "lucide-react";

type BuildMainNavOptions = {
  signedIn: boolean;
  authBusy?: boolean;
  onSignIn: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onPortfolio?: () => void;
  onTransfer?: () => void;
  onLeaderboard?: () => void;
  onLive?: () => void;
};

export function buildMainNavItems(options: BuildMainNavOptions): AppShellNavItem[] {
  const {
    signedIn,
    authBusy = false,
    onSignIn,
    onSignOut,
    onPortfolio,
    onTransfer,
    onLeaderboard,
    onLive,
  } = options;

  return [
    {
      id: "auth",
      label: signedIn ? "Sign out" : "Sign in",
      icon: signedIn ? LogOut : LogIn,
      onClick: signedIn ? onSignOut : onSignIn,
      disabled: authBusy,
      title: authBusy ? "Please wait..." : undefined,
    },
    {
      id: "portfolio",
      label: "My Teams",
      icon: Briefcase,
      href: "/dashboard?tab=portfolio",
      onClick: onPortfolio,
    },
    {
      id: "transfer",
      label: "Transfer",
      icon: ArrowLeftRight,
      href: "/dashboard?tab=market",
      onClick: onTransfer,
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      icon: Users,
      href: "/dashboard?tab=leaderboard",
      onClick: onLeaderboard,
    },
    {
      id: "live",
      label: "Live",
      icon: Tv,
      href: "/dashboard?tab=bracket",
      onClick: onLive,
    },
    {
      id: "badges",
      label: "Badges",
      icon: Award,
      href: "/badges",
    },
  ];
}
