export type WeekPlan = {
  week: number;
  title: string;
  target_seconds: number;
  sessions: number;
  checkpoint: string;
  /** A passage to read or a short task list, sized to roughly fit target_seconds. */
  content: string;
};

export type PlanResponse = {
  weeks: WeekPlan[];
};

export type WeekRecord = WeekPlan & {
  id: string;
  verifiedSeconds: number;
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
  verifiedSeconds: number;
};

export type SessionClip = {
  sessionId: string;
  startedAt: string;
  verifiedSeconds: number;
  clipUrl: string;
};

export type ContentSource = "skill" | "book";

export type GoalStatus = "active" | "completed";

export type Goal = {
  id: string;
  visitorId: string;
  title: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  secondsPerSession: number;
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
  isFamily: boolean;
  inviteCode: string | null;
  childNickname: string | null;
  childVisitorId: string | null;
  contentSource: ContentSource;
  createdAt: string;
  weeks: WeekRecord[];
};

export type GoalSetupInput = {
  title: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  secondsPerSession: number;
  depositAmount: number;
  carriedOverLocked?: number;
};

export type LeaderboardEntry = {
  roomCode: string;
  visitorId: string;
  nickname: string;
  verifiedSecondsWeek: number;
  updatedAt: string;
};
