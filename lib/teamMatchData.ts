/**
 * Team Match Data Utilities
 *
 * Provides functions to fetch recent form and next match data for teams.
 * Replaces hardcoded match data with real Firestore queries.
 */

import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export type MatchResult = "W" | "D" | "L";

export interface Match {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  scheduledAt: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  stage: "group" | "round_16" | "quarter" | "semi" | "final" | "third_place";
  group?: string; // e.g., "A", "B", etc.
}

export interface NextMatch {
  opponent: string;
  opponentId: string;
  scheduledAt: Date;
  isHome: boolean;
  stage: string;
}

/**
 * Get a team's recent form (last 5 completed matches)
 *
 * @param teamId - Team document ID
 * @returns Array of W/D/L results, most recent first
 */
export async function getTeamRecentForm(teamId: string): Promise<MatchResult[]> {
  try {
    // Query completed matches where team was involved
    const matchesRef = collection(db, "matches");

    // Get matches where team was home team
    const homeQuery = query(
      matchesRef,
      where("homeTeamId", "==", teamId),
      where("status", "==", "FINISHED"),
      orderBy("kickoffTime", "desc"),
      limit(10) // Get extra in case some are mixed with away games
    );

    // Get matches where team was away team
    const awayQuery = query(
      matchesRef,
      where("awayTeamId", "==", teamId),
      where("status", "==", "FINISHED"),
      orderBy("kickoffTime", "desc"),
      limit(10)
    );

    const [homeSnap, awaySnap] = await Promise.all([
      getDocs(homeQuery),
      getDocs(awayQuery),
    ]);

    // Combine and sort all matches by date
    const allMatches: Array<Match & { result: MatchResult }> = [];

    homeSnap.forEach((doc) => {
      const data = doc.data();
      const homeScore = data.homeScore ?? 0;
      const awayScore = data.awayScore ?? 0;

      let result: MatchResult;
      if (homeScore > awayScore) result = "W";
      else if (homeScore < awayScore) result = "L";
      else result = "D";

      allMatches.push({
        matchId: doc.id,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        homeScore,
        awayScore,
        scheduledAt: data.kickoffTime ? new Date(data.kickoffTime as string) : new Date(),
        status: data.status,
        stage: data.stage,
        result,
      });
    });

    awaySnap.forEach((doc) => {
      const data = doc.data();
      const homeScore = data.homeScore ?? 0;
      const awayScore = data.awayScore ?? 0;

      let result: MatchResult;
      if (awayScore > homeScore) result = "W";
      else if (awayScore < homeScore) result = "L";
      else result = "D";

      allMatches.push({
        matchId: doc.id,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        homeScore,
        awayScore,
        scheduledAt: data.kickoffTime ? new Date(data.kickoffTime as string) : new Date(),
        status: data.status,
        stage: data.stage,
        result,
      });
    });

    // Sort by date descending (most recent first)
    allMatches.sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

    // Return last 5 results
    return allMatches.slice(0, 5).map((m) => m.result);
  } catch (error) {
    console.error("[teamMatchData] Error fetching recent form:", error);
    return []; // Return empty array on error
  }
}

/**
 * Get a team's next scheduled match
 *
 * @param teamId - Team document ID
 * @returns Next match details or null if no upcoming matches
 */
export async function getTeamNextMatch(teamId: string): Promise<NextMatch | null> {
  try {
    const now = new Date();
    const nowISO = now.toISOString();
    const matchesRef = collection(db, "matches");

    // Query upcoming matches where team is home
    const homeQuery = query(
      matchesRef,
      where("homeTeamId", "==", teamId),
      where("status", "==", "SCHEDULED"),
      where("kickoffTime", ">", nowISO),
      orderBy("kickoffTime", "asc"),
      limit(1)
    );

    // Query upcoming matches where team is away
    const awayQuery = query(
      matchesRef,
      where("awayTeamId", "==", teamId),
      where("status", "==", "SCHEDULED"),
      where("kickoffTime", ">", nowISO),
      orderBy("kickoffTime", "asc"),
      limit(1)
    );

    const [homeSnap, awaySnap] = await Promise.all([
      getDocs(homeQuery),
      getDocs(awayQuery),
    ]);

    // Find the earliest upcoming match
    let nextMatch: (Match & { isHome: boolean; opponentId: string }) | null = null;

    if (!homeSnap.empty) {
      const doc = homeSnap.docs[0];
      const data = doc.data();
      nextMatch = {
        matchId: doc.id,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        homeScore: null,
        awayScore: null,
        scheduledAt: new Date(data.kickoffTime as string),
        status: data.status,
        stage: data.stage,
        isHome: true,
        opponentId: data.awayTeamId,
      };
    }

    if (!awaySnap.empty) {
      const doc = awaySnap.docs[0];
      const data = doc.data();
      const awayMatchDate = new Date(data.kickoffTime as string);

      // If no home match or away match is earlier
      if (!nextMatch || awayMatchDate < nextMatch.scheduledAt) {
        nextMatch = {
          matchId: doc.id,
          homeTeamId: data.homeTeamId,
          awayTeamId: data.awayTeamId,
          homeScore: null,
          awayScore: null,
          scheduledAt: awayMatchDate,
          status: data.status,
          stage: data.stage,
          isHome: false,
          opponentId: data.homeTeamId,
        };
      }
    }

    if (!nextMatch) return null;

    // Fetch opponent team name
    // Note: In production, you'd query the teams collection
    // For now, return opponent ID (dashboard will resolve name from teamsById)
    return {
      opponent: nextMatch.opponentId, // Will be resolved to name in UI
      opponentId: nextMatch.opponentId,
      scheduledAt: nextMatch.scheduledAt,
      isHome: nextMatch.isHome,
      stage: formatStage(nextMatch.stage),
    };
  } catch (error) {
    console.error("[teamMatchData] Error fetching next match:", error);
    return null;
  }
}

/**
 * Format match stage for display
 */
function formatStage(stage: string): string {
  const stageMap: Record<string, string> = {
    group: "Group Stage",
    round_16: "Round of 16",
    quarter: "Quarter Final",
    semi: "Semi Final",
    final: "Final",
    third_place: "3rd Place",
  };
  return stageMap[stage] || stage;
}

/**
 * Format date for "Next Match" display
 * e.g., "Tomorrow 18:00" or "Jun 15, 14:00"
 */
export function formatMatchDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${dateStr}, ${timeStr}`;
}

/**
 * Check if team has any match data
 * Used to show "No matches yet" message pre-tournament
 */
export async function hasMatchData(teamId: string): Promise<boolean> {
  try {
    const matchesRef = collection(db, "matches");

    const homeQuery = query(
      matchesRef,
      where("homeTeamId", "==", teamId),
      limit(1)
    );

    const awayQuery = query(
      matchesRef,
      where("awayTeamId", "==", teamId),
      limit(1)
    );

    const [homeSnap, awaySnap] = await Promise.all([
      getDocs(homeQuery),
      getDocs(awayQuery),
    ]);

    return !homeSnap.empty || !awaySnap.empty;
  } catch (error) {
    console.error("[teamMatchData] Error checking match data:", error);
    return false;
  }
}
