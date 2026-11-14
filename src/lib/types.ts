export type WeekPlan = {
  week: number;
  title: string;
  target_minutes: number;
  sessions: number;
  checkpoint: string;
};

export type PlanResponse = {
  weeks: WeekPlan[];
};

export type WeekRecord = WeekPlan & {
  id: string;
  verifiedMinutes: number;
  verifiedSessions: number;
  settled: boolean;
  unlockedAmount: number;
};

export type SessionRecord = {
  id: string;
  goalId: string;
  weekId: string;
  startedAt: string;
  endedAt: string | null;
  verifiedMinutes: number;
};

export type GoalStatus = "active" | "completed";

export type Goal = {
  id: string;
  visitorId: string;
  title: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  depositAmount: number;
  carriedOverLocked: number;
  cyclePool: number;
  weeklyUnlockAmount: number;
  claimableBalance: number;
  lockedBalance: number;
  currentWeek: number;
  status: GoalStatus;
  roomCode: string | null;
  nickname: string | null;
  createdAt: string;
  weeks: WeekRecord[];
};

export type GoalSetupInput = {
  title: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  minutesPerSession: number;
  depositAmount: number;
  carriedOverLocked?: number;
};

export type LeaderboardEntry = {
  roomCode: string;
  visitorId: string;
  nickname: string;
  verifiedMinutesWeek: number;
  updatedAt: string;
};
