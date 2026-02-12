// src/types/index.ts

export interface Team {
    id: string; // e.g., "BRA"
    name: string; // e.g., "Brazil"
    flagUrl: string;
    group: string; // e.g., "G"
    tier: number; // 1, 2, 3, or 4 (for underdog logic)
    isEliminated: boolean;
    
    // Stats for the tournament
    wins: number;
    draws: number;
    goalsScored: number;
    goalsConceded: number;
    cleanSheets: number;
    redCards: number;
    yellowCards: number;
  }
  
  export interface PortfolioItem {
    teamId: string;
    role: 'featured' | 'drawn';
  }
  
  export interface User {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    
    // The Game Data
    portfolio: PortfolioItem[];
    totalScore: number;
    remainingTransfers: number;
    isAdmin: boolean;
  }
  
  export interface Match {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null; // null means match hasn't started
    awayScore: number | null;
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED';
    stage: 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL';
    date: string; // ISO string
  }