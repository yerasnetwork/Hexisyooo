"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { MoneyStat, formatUsd } from "@/components/MoneyStat";
import { ProgressBar } from "@/components/ProgressBar";
import {
  ArrowRightIcon,
  CheckIcon,
  FlameIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { computeCurrentStreak } from "@/lib/pool";
import { rememberGoalId, setRoomNickname } from "@/lib/visitor";
import type { Goal } from "@/lib/types";

export function DashboardClient({
  goal: initialGoal,
  prefillRoomCode,
}: {
  goal: Goal;
  prefillRoomCode?: string;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rememberGoalId(goal.id);
  }, [goal.id]);

  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek) ?? goal.weeks[goal.weeks.length - 1];
  const streak = computeCurrentStreak(goal.weeks);

  async function withdraw() {
    setBusy("withdraw");
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}/withdraw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGoal(data.goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw");
    } finally {
      setBusy(null);
    }
  }

  async function advanceWeek() {
    setBusy("advance");
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}/advance-week`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGoal(data.goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance week");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)] px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
          >
            <ShieldIcon width={16} height={16} className="text-[var(--color-accent)]" />
            Hexis
          </Link>
          {goal.status === "completed" && (
            <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              Goal complete
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {goal.durationWeeks}-week plan · {goal.sessionsPerWeek}x / week ·{" "}
            {goal.minutesPerSession} min / session
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <MoneyStat kind="claimable" amount={goal.claimableBalance} label="Claimable" />
          <MoneyStat kind="locked" amount={goal.lockedBalance} label="Locked" />
        </div>

        {goal.claimableBalance > 0 && (
          <Button variant="secondary" onClick={withdraw} disabled={busy === "withdraw"}>
            {busy === "withdraw" ? "Withdrawing…" : `Withdraw ${formatUsd(goal.claimableBalance)}`}
          </Button>
        )}

        {goal.status === "active" && currentWeek && (
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--color-text-faint)]">
                Week {currentWeek.week} of {goal.durationWeeks}
              </span>
              {streak > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warn)]">
                  <FlameIcon width={14} height={14} />
                  {streak} week streak
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold">{currentWeek.title}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">{currentWeek.checkpoint}</p>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">Verified this week</span>
                <span className="font-mono tabular-nums">
                  {currentWeek.verifiedMinutes} / {currentWeek.target_minutes} min
                </span>
              </div>
              <ProgressBar value={currentWeek.verifiedMinutes} max={currentWeek.target_minutes} />
            </div>

            <LinkButton href={`/goal/${goal.id}/session`} size="lg">
              Start reading session
              <ArrowRightIcon width={18} height={18} />
            </LinkButton>
          </Card>
        )}

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UsersIcon width={18} height={18} className="text-[var(--color-accent)]" />
            <h2 className="text-base font-semibold">Leaderboard</h2>
          </div>
          {goal.roomCode ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                You&rsquo;re in room{" "}
                <span className="font-mono font-semibold text-[var(--color-text)]">
                  {goal.roomCode}
                </span>{" "}
                as {goal.nickname}
              </p>
              <LinkButton href={`/room/${goal.roomCode}`} variant="secondary">
                View
              </LinkButton>
            </div>
          ) : (
            <RoomJoinForm
              goalId={goal.id}
              onJoined={setGoal}
              initialRoomCode={prefillRoomCode}
            />
          )}
        </Card>

        <WeekTimeline goal={goal} />

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4">
          <summary className="cursor-pointer text-xs font-medium text-[var(--color-text-faint)]">
            Demo controls
          </summary>
          <p className="mt-2 mb-3 text-xs text-[var(--color-text-faint)]">
            For judging only — in production, weeks settle automatically on a schedule.
          </p>
          {goal.status === "active" && (
            <Button
              variant="secondary"
              size="md"
              onClick={advanceWeek}
              disabled={busy === "advance"}
            >
              {busy === "advance" ? "Settling…" : "Settle current week & advance (demo)"}
            </Button>
          )}
        </details>
      </div>
    </div>
  );
}

function WeekTimeline({ goal }: { goal: Goal }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-semibold">Plan</h2>
      <div className="flex flex-col gap-2">
        {goal.weeks.map((w) => (
          <div
            key={w.week}
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
              w.week === goal.currentWeek && goal.status === "active"
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)] bg-transparent"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-text-faint)]">W{w.week}</span>
              <span className="truncate">{w.title}</span>
            </div>
            {w.settled ? (
              w.unlockedAmount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)]">
                  <CheckIcon width={13} height={13} />
                  {formatUsd(w.unlockedAmount)}
                </span>
              ) : (
                <span className="text-xs text-[var(--color-text-faint)]">Missed · stayed locked</span>
              )
            ) : (
              <span className="text-xs text-[var(--color-text-faint)]">
                {w.verifiedMinutes}/{w.target_minutes} min
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoomJoinForm({
  goalId,
  onJoined,
  initialRoomCode,
}: {
  goalId: string;
  onJoined: (goal: Goal) => void;
  initialRoomCode?: string;
}) {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState(initialRoomCode?.toUpperCase() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("Pick a nickname first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goalId}/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, roomCode: roomCode || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.goal.roomCode) setRoomNickname(data.goal.roomCode, nickname.trim());
      onJoined(data.goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="mb-1 block text-xs text-[var(--color-text-faint)]">Nickname</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Jamie"
          className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      <label className="flex-1">
        <span className="mb-1 block text-xs text-[var(--color-text-faint)]">
          Room code (leave blank to create one)
        </span>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="e.g. H3XK2P"
          className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm uppercase outline-none focus:border-[var(--color-accent)]"
        />
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? "Joining…" : roomCode ? "Join" : "Create room"}
      </Button>
      {error && <p className="w-full text-sm text-[var(--color-danger)]">{error}</p>}
    </form>
  );
}
