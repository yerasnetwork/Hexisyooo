import { getSupabaseAdmin, isSupabaseConfigured } from "./supabaseAdmin";
import { computeCyclePool, computeWeeklyUnlockAmount, settleWeek } from "./pool";
import type { Goal, GoalSetupInput, LeaderboardEntry, PlanResponse, WeekRecord } from "./types";

// ---------------------------------------------------------------------------
// In-memory fallback store. Used whenever Supabase env vars aren't set yet,
// so the whole product stays demoable before the DB is provisioned. Lives
// for the lifetime of the server process only.
// ---------------------------------------------------------------------------
const memoryGoals = new Map<string, Goal>();
const memoryLeaderboard = new Map<string, LeaderboardEntry[]>();

function randomId(): string {
  return crypto.randomUUID();
}

function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function weeksFromPlan(plan: PlanResponse): WeekRecord[] {
  return plan.weeks.map((w) => ({
    ...w,
    id: randomId(),
    verifiedMinutes: 0,
    verifiedSessions: 0,
    settled: false,
    unlockedAmount: 0,
  }));
}

export async function createGoal(
  visitorId: string,
  input: GoalSetupInput,
  plan: PlanResponse
): Promise<Goal> {
  const carriedOverLocked = input.carriedOverLocked ?? 0;
  const cyclePool = computeCyclePool(carriedOverLocked, input.depositAmount);
  const weeklyUnlockAmount = computeWeeklyUnlockAmount(cyclePool, input.durationWeeks);
  const weeks = weeksFromPlan(plan);

  const goal: Goal = {
    id: randomId(),
    visitorId,
    title: input.title,
    durationWeeks: input.durationWeeks,
    sessionsPerWeek: input.sessionsPerWeek,
    minutesPerSession: input.minutesPerSession,
    depositAmount: input.depositAmount,
    carriedOverLocked,
    cyclePool,
    weeklyUnlockAmount,
    claimableBalance: 0,
    lockedBalance: cyclePool,
    currentWeek: 1,
    status: "active",
    roomCode: null,
    nickname: null,
    createdAt: new Date().toISOString(),
    weeks,
  };

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error: goalError } = await admin.from("goals").insert({
      id: goal.id,
      visitor_id: goal.visitorId,
      title: goal.title,
      duration_weeks: goal.durationWeeks,
      sessions_per_week: goal.sessionsPerWeek,
      minutes_per_session: goal.minutesPerSession,
      deposit_amount: goal.depositAmount,
      carried_over_locked: goal.carriedOverLocked,
      cycle_pool: goal.cyclePool,
      weekly_unlock_amount: goal.weeklyUnlockAmount,
      claimable_balance: goal.claimableBalance,
      locked_balance: goal.lockedBalance,
      current_week: goal.currentWeek,
      status: goal.status,
      created_at: goal.createdAt,
    });
    if (goalError) throw new Error(goalError.message);

    const { error: weeksError } = await admin.from("weeks").insert(
      weeks.map((w) => ({
        id: w.id,
        goal_id: goal.id,
        week_number: w.week,
        title: w.title,
        target_minutes: w.target_minutes,
        target_sessions: w.sessions,
        checkpoint: w.checkpoint,
        verified_minutes: w.verifiedMinutes,
        verified_sessions: w.verifiedSessions,
        settled: w.settled,
        unlocked_amount: w.unlockedAmount,
      }))
    );
    if (weeksError) throw new Error(weeksError.message);
    return goal;
  }

  memoryGoals.set(goal.id, goal);
  return goal;
}

function rowsToGoal(goalRow: SupabaseGoalRow, weekRows: SupabaseWeekRow[]): Goal {
  return {
    id: goalRow.id,
    visitorId: goalRow.visitor_id,
    title: goalRow.title,
    durationWeeks: goalRow.duration_weeks,
    sessionsPerWeek: goalRow.sessions_per_week,
    minutesPerSession: goalRow.minutes_per_session,
    depositAmount: Number(goalRow.deposit_amount),
    carriedOverLocked: Number(goalRow.carried_over_locked),
    cyclePool: Number(goalRow.cycle_pool),
    weeklyUnlockAmount: Number(goalRow.weekly_unlock_amount),
    claimableBalance: Number(goalRow.claimable_balance),
    lockedBalance: Number(goalRow.locked_balance),
    currentWeek: goalRow.current_week,
    status: goalRow.status,
    roomCode: goalRow.room_code,
    nickname: goalRow.nickname,
    createdAt: goalRow.created_at,
    weeks: weekRows
      .sort((a, b) => a.week_number - b.week_number)
      .map((w) => ({
        week: w.week_number,
        title: w.title,
        target_minutes: w.target_minutes,
        sessions: w.target_sessions,
        checkpoint: w.checkpoint ?? "",
        id: w.id,
        verifiedMinutes: Number(w.verified_minutes),
        verifiedSessions: w.verified_sessions,
        settled: w.settled,
        unlockedAmount: Number(w.unlocked_amount),
      })),
  };
}

type SupabaseGoalRow = {
  id: string;
  visitor_id: string;
  title: string;
  duration_weeks: number;
  sessions_per_week: number;
  minutes_per_session: number;
  deposit_amount: number;
  carried_over_locked: number;
  cycle_pool: number;
  weekly_unlock_amount: number;
  claimable_balance: number;
  locked_balance: number;
  current_week: number;
  status: "active" | "completed";
  room_code: string | null;
  nickname: string | null;
  created_at: string;
};

type SupabaseWeekRow = {
  id: string;
  week_number: number;
  title: string;
  target_minutes: number;
  target_sessions: number;
  checkpoint: string | null;
  verified_minutes: number;
  verified_sessions: number;
  settled: boolean;
  unlocked_amount: number;
};

export async function getGoal(id: string): Promise<Goal | null> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data: goalRow, error } = await admin.from("goals").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!goalRow) return null;
    const { data: weekRows, error: weeksError } = await admin
      .from("weeks")
      .select("*")
      .eq("goal_id", id);
    if (weeksError) throw new Error(weeksError.message);
    return rowsToGoal(goalRow as SupabaseGoalRow, (weekRows ?? []) as SupabaseWeekRow[]);
  }
  return memoryGoals.get(id) ?? null;
}

async function saveGoal(goal: Goal): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error: goalError } = await admin
      .from("goals")
      .update({
        claimable_balance: goal.claimableBalance,
        locked_balance: goal.lockedBalance,
        current_week: goal.currentWeek,
        status: goal.status,
        room_code: goal.roomCode,
        nickname: goal.nickname,
      })
      .eq("id", goal.id);
    if (goalError) throw new Error(goalError.message);

    for (const w of goal.weeks) {
      const { error: weekError } = await admin
        .from("weeks")
        .update({
          verified_minutes: w.verifiedMinutes,
          verified_sessions: w.verifiedSessions,
          settled: w.settled,
          unlocked_amount: w.unlockedAmount,
        })
        .eq("id", w.id);
      if (weekError) throw new Error(weekError.message);
    }
    return;
  }
  memoryGoals.set(goal.id, goal);
}

export async function startSession(goalId: string): Promise<{ sessionId: string; weekId: string }> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error("Goal not found");
  const week = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!week) throw new Error("Current week not found");

  const sessionId = randomId();
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from("sessions").insert({
      id: sessionId,
      goal_id: goalId,
      week_id: week.id,
      started_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  return { sessionId, weekId: week.id };
}

export async function endSession(
  goalId: string,
  sessionId: string,
  verifiedMinutes: number
): Promise<Goal> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error("Goal not found");
  const week = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!week) throw new Error("Current week not found");

  week.verifiedMinutes += verifiedMinutes;
  week.verifiedSessions += 1;

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("sessions")
      .update({ ended_at: new Date().toISOString(), verified_minutes: verifiedMinutes })
      .eq("id", sessionId);
    if (error) throw new Error(error.message);
  }

  await saveGoal(goal);

  if (goal.roomCode) {
    await bumpLeaderboardMinutes(goal.roomCode, goal.visitorId, verifiedMinutes);
  }

  return goal;
}

export async function advanceWeek(goalId: string): Promise<Goal> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error("Goal not found");
  const week = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!week || week.settled) return goal;

  const { met, unlockedAmount } = settleWeek(week, goal.weeklyUnlockAmount);
  week.settled = true;
  week.unlockedAmount = unlockedAmount;
  if (met) {
    goal.claimableBalance += unlockedAmount;
    goal.lockedBalance -= unlockedAmount;
  }

  if (goal.currentWeek >= goal.durationWeeks) {
    goal.status = "completed";
  } else {
    goal.currentWeek += 1;
  }

  await saveGoal(goal);
  return goal;
}

export async function withdrawClaimable(goalId: string): Promise<Goal> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error("Goal not found");
  goal.claimableBalance = 0;
  await saveGoal(goal);
  return goal;
}

export async function joinRoom(
  goalId: string,
  nickname: string,
  roomCode?: string
): Promise<Goal> {
  const goal = await getGoal(goalId);
  if (!goal) throw new Error("Goal not found");
  const code = roomCode?.toUpperCase() || makeRoomCode();
  goal.roomCode = code;
  goal.nickname = nickname;
  await saveGoal(goal);

  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek);
  await upsertLeaderboardEntry(code, goal.visitorId, nickname, currentWeek?.verifiedMinutes ?? 0);
  return goal;
}

async function upsertLeaderboardEntry(
  roomCode: string,
  visitorId: string,
  nickname: string,
  verifiedMinutesWeek: number
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from("leaderboard_entries").upsert(
      {
        room_code: roomCode,
        visitor_id: visitorId,
        nickname,
        verified_minutes_week: verifiedMinutesWeek,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code,visitor_id" }
    );
    if (error) throw new Error(error.message);
    return;
  }
  const entries = memoryLeaderboard.get(roomCode) ?? [];
  const existing = entries.find((e) => e.visitorId === visitorId);
  if (existing) {
    existing.nickname = nickname;
    existing.verifiedMinutesWeek = verifiedMinutesWeek;
    existing.updatedAt = new Date().toISOString();
  } else {
    entries.push({
      roomCode,
      visitorId,
      nickname,
      verifiedMinutesWeek,
      updatedAt: new Date().toISOString(),
    });
  }
  memoryLeaderboard.set(roomCode, entries);
}

async function bumpLeaderboardMinutes(
  roomCode: string,
  visitorId: string,
  additionalMinutes: number
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("leaderboard_entries")
      .select("verified_minutes_week")
      .eq("room_code", roomCode)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const newTotal = Number(data?.verified_minutes_week ?? 0) + additionalMinutes;
    const { error: upsertError } = await admin.from("leaderboard_entries").upsert(
      {
        room_code: roomCode,
        visitor_id: visitorId,
        verified_minutes_week: newTotal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_code,visitor_id" }
    );
    if (upsertError) throw new Error(upsertError.message);
    return;
  }
  const entries = memoryLeaderboard.get(roomCode) ?? [];
  const existing = entries.find((e) => e.visitorId === visitorId);
  if (existing) {
    existing.verifiedMinutesWeek += additionalMinutes;
    existing.updatedAt = new Date().toISOString();
  }
  memoryLeaderboard.set(roomCode, entries);
}

export async function getLeaderboard(roomCode: string): Promise<LeaderboardEntry[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from("leaderboard_entries")
      .select("*")
      .eq("room_code", roomCode)
      .order("verified_minutes_week", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      roomCode: r.room_code,
      visitorId: r.visitor_id,
      nickname: r.nickname,
      verifiedMinutesWeek: Number(r.verified_minutes_week),
      updatedAt: r.updated_at,
    }));
  }
  const entries = memoryLeaderboard.get(roomCode) ?? [];
  return [...entries].sort((a, b) => b.verifiedMinutesWeek - a.verifiedMinutesWeek);
}

export function usingSupabase(): boolean {
  return isSupabaseConfigured();
}
