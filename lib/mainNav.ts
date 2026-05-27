import type { AppShellNavItem } from "@/components/app-shell-v0";
import {
  ArrowLeftRight,
  BookOpen,
  Briefcase,
  Coins,
  HandHeart,
  LogIn,
  LogOut,
  Tv,
  Users,
} from "lucide-react";
import { FEATURES } from "@/lib/features";

type BuildMainNavOptions = {
  signedIn: boolean;
  authBusy?: boolean;
  onSignIn: () => void | Promise<void>;
  onSignOut: () => void | Promise<void>;
  onPortfolio?: () => void;
  onTransfer?: () => void;
  onLeaderboard?: () => void;
  onLive?: () => void;
  /**
   * When true, the Live and Transfer nav items are returned without
   * badgeVariant / badge — so no coloured pip appears on secondary pages
   * that don't have live-count or transfer-count data.
   * Default: false (pips shown, caller is responsible for setting badge text).
   */
  suppressBadges?: boolean;
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
    suppressBadges = false,
  } = options;

  const navItems: AppShellNavItem[] = [
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
      id: "leaderboard",
      label: "Leaderboard",
      icon: Users,
      href: "/leaderboard",
      onClick: onLeaderboard,
    },
    {
      id: "live",
      label: "Live",
      icon: Tv,
      href: "/dashboard?tab=bracket",
      onClick: onLive,
      ...(suppressBadges ? {} : { badgeVariant: "live" as const }),
    },
  ];

  if (!signedIn) {
    return navItems;
  }

  if (FEATURES.userGuide) {
    navItems.push({
      id: "guide",
      label: "Guide",
      icon: BookOpen,
      href: "/guide",
    });
  }

  if (FEATURES.charityPot) {
    navItems.push({
      id: "charity",
      label: "Charity",
      icon: HandHeart,
      href: "/charity",
    });
  }

  if (FEATURES.prizePot) {
    navItems.push({
      id: "pot",
      label: "Pot",
      icon: Coins,
      href: "/pot",
    });
  }

  navItems.push({
    id: "transfer",
    label: "Transfer",
    icon: ArrowLeftRight,
    href: "/dashboard?tab=market",
    onClick: onTransfer,
    ...(suppressBadges ? {} : { badgeVariant: "amber" as const }),
  });

  return navItems;
}
