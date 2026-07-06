export type Intensity = "soft" | "medium" | "hard";
export type ListMode = "blocklist" | "allowlist";
export interface SiteList { id: string; name: string; mode: ListMode; domains: string[] }
export interface Schedule { id: string; enabled: boolean; days: number[]; /* 0=일…6=토 */
  startHHMM: string; endHHMM: string; listId: string; intensity: Intensity }
export interface Session { id: string; source: "manual" | "schedule"; listId: string;
  intensity: Intensity; startedAt: number; endsAt: number;
  status: "active" | "completed" | "aborted" | "interrupted";
  snoozeCount: number; nextSnoozeDelayMin: number }
export interface PetState { stage: 0|1|2|3|4; xp: number; streakDays: number;
  streakFreezes: number; lastActiveDate: string; badges: string[] }
export interface DailyStats { date: string; focusMinutes: number; blockedAttempts: number;
  overrides: number; domainVisits: Record<string, number> }
export interface TempAllow { domain: string; until: number }
