export type Intensity = "soft" | "medium" | "hard";
export type ListMode = "blocklist" | "allowlist";
export type PetStage = 0 | 1 | 2 | 3 | 4;
export type StreakState = "active" | "resting" | "fresh";
export interface SiteList { id: string; name: string; mode: ListMode; domains: string[] }
export interface Schedule { id: string; enabled: boolean; days: number[]; /* 0=일…6=토 */
  startHHMM: string; endHHMM: string; listId: string; intensity: Intensity }
export interface Session { id: string; source: "manual" | "schedule"; listId: string;
  scheduleId?: string;
  scheduleWindowEnd?: number;
  intensity: Intensity; startedAt: number; endsAt: number;
  status: "active" | "completed" | "aborted" | "interrupted";
  snoozeCount: number; nextSnoozeDelayMin: number }
export interface BadgeAward { earnedAt: number }
export interface PetState { version: 2; name?: string; stage: PetStage; xp: number;
  totalFocusMinutes: number; streak: { days: number; state: StreakState; restingSince?: string; freezes: number };
  streakDays: number; streakFreezes: number; lastActiveDate: string; badges: string[];
  badgeAwards: Record<string, BadgeAward> }
export interface DailyStats { date: string; focusMinutes: number; blockedAttempts: number;
  overrides: number; domainVisits: Record<string, number> }
export interface TempAllow { domain: string; until: number; sessionId: string }
