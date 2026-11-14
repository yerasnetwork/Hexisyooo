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
import { getVisitorId, rememberGoalId, setRoomNickname } from "@/lib/visitor";
import type { Goal, SessionClip } from "@/lib/types";

type FamilyRole = "owner" | "child";

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
  // Resolved post-mount from localStorage — defaults to the child-safe view
  // (no money actions) until we know this browser created the goal.
  const [familyRole, setFamilyRole] = useState<FamilyRole>("child");

  useEffect(() => {
    rememberGoalId(goal.id);
  }, [goal.id]);

  useEffect(() => {
    if (!goal.isFamily) return;
    const visitorId = getVisitorId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFamilyRole(visitorId === goal.visitorId ? "owner" : "child");
  }, [goal.isFamily, goal.visitorId]);

  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek) ?? goal.weeks[goal.weeks.length - 1];
  const streak = computeCurrentStreak(goal.weeks);
  const isFamilyOwner = goal.isFamily && familyRole === "owner";
  const isFamilyChild = goal.isFamily && familyRole === "child";

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
          <div className="flex items-center gap-2">
            {goal.contentSource === "book" && (
              <span className="rounded-full bg-[var(--color-surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                From your PDF
              </span>
            )}
            {goal.isFamily && (
              <span className="rounded-full bg-[var(--color-surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
                {isFamilyOwner ? "Family goal · parent view" : "Family goal"}
              </span>
            )}
            {goal.status === "completed" && (
              <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
                Goal complete
              </span>
            )}
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{goal.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {goal.durationWeeks}-week plan · {goal.sessionsPerWeek}x / week ·{" "}
            {goal.minutesPerSession} min / session
            {isFamilyOwner && goal.childNickname && <> · read by {goal.childNickname}</>}
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <MoneyStat kind="claimable" amount={goal.claimableBalance} label="Claimable" />
          <MoneyStat kind="locked" amount={goal.lockedBalance} label="Locked" />
        </div>

        {!isFamilyChild && goal.claimableBalance > 0 && (
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

            {!isFamilyOwner && (
              <LinkButton href={`/goal/${goal.id}/session`} size="lg">
                Start reading session
                <ArrowRightIcon width={18} height={18} />
              </LinkButton>
            )}
          </Card>
        )}

        {goal.isFamily ? (
          isFamilyOwner && <FamilyOwnerPanel goal={goal} />
        ) : (
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
        )}

        <WeekTimeline goal={goal} />

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        {!isFamilyChild && (
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
        )}
      </div>
    </div>
  );
}

function FamilyOwnerPanel({ goal }: { goal: Goal }) {
  const [copied, setCopied] = useState(false);
  const [clips, setClips] = useState<SessionClip[] | null>(null);

  useEffect(() => {
    fetch(`/api/goals/${goal.id}/clips`)
      .then((res) => res.json())
      .then((data) => {
        setClips(data.clips ?? []);
      })
      .catch(() => {
        setClips([]);
      });
  }, [goal.id]);

  function copyInviteLink() {
    const url = `${window.location.origin}/family/join?code=${goal.inviteCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <UsersIcon width={18} height={18} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-semibold">
            {goal.childNickname ? `${goal.childNickname}'s invite` : "Invite your reader"}
          </h2>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-widest">{goal.inviteCode}</p>
            <p className="mt-1 text-xs text-[var(--color-text-faint)]">
              {goal.childNickname
                ? `${goal.childNickname} has joined — this code still works if they need to rejoin on another device.`
                : "Share this code (or the link) — no account needed to join."}
            </p>
          </div>
          <Button variant="secondary" onClick={copyInviteLink}>
            {copied ? "Copied!" : "Copy invite link"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-semibold">Reading sessions</h2>
        {clips === null ? (
          <p className="text-sm text-[var(--color-text-faint)]">Loading…</p>
        ) : clips.length === 0 ? (
          <p className="text-sm text-[var(--color-text-faint)]">
            No recorded sessions yet. A short clip appears here after each reading session.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {clips.map((clip) => (
              <div key={clip.sessionId} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <video
                  src={clip.clipUrl}
                  controls
                  className="h-32 w-48 rounded-lg border border-[var(--color-border)] bg-black object-cover"
                />
                <div className="text-sm">
                  <p className="font-medium">
                    {new Date(clip.startedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[var(--color-text-muted)]">
                    {clip.verifiedMinutes} min verified
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
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
