"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/Button";
import { Card } from "@/components/Card";
import { ShieldIcon, UsersIcon } from "@/components/icons";
import { formatDuration } from "@/lib/text";
import { getRememberedGoalIds, getRoomNickname, setRoomNickname } from "@/lib/visitor";
import type { LeaderboardEntry } from "@/lib/types";

const POLL_MS = 8000;

export function RoomClient({ roomCode }: { roomCode: string }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [myGoalId, setMyGoalId] = useState<string | null>(null);
  const [joinedNickname, setJoinedNickname] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leaderboard/${roomCode}`);
      const data = await res.json();
      if (res.ok) setEntries(data.entries);
    } catch {
      // keep showing the last known state
    }
  }, [roomCode]);

  useEffect(() => {
    // Initial load has to happen post-mount; polling then keeps it live.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // localStorage isn't available during SSR, so this has to run post-mount.
    const ids = getRememberedGoalIds();
    const nickname = getRoomNickname(roomCode);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ids.length > 0) setMyGoalId(ids[0]);
    setJoinedNickname(nickname);
  }, [roomCode]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!myGoalId) return;
    if (!nickname.trim()) {
      setError("Pick a nickname first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${myGoalId}/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), roomCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRoomNickname(roomCode, nickname.trim());
      setJoinedNickname(nickname.trim());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)] px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        >
          <ShieldIcon width={16} height={16} className="text-[var(--color-accent)]" />
          Hexis
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="text-[var(--color-accent)]" />
            <h1 className="text-xl font-semibold">Room {roomCode}</h1>
          </div>
          <Button variant="secondary" onClick={copyLink}>
            Copy invite link
          </Button>
        </div>

        <Card>
          {entries === null ? (
            <p className="text-sm text-[var(--color-text-faint)]">Loading leaderboard…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-[var(--color-text-faint)]">
              No one has verified any minutes here yet. Be the first.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {entries.map((entry, i) => (
                <li
                  key={entry.visitorId}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                    i === 0
                      ? "border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]"
                      : "bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-5 text-center font-mono text-xs text-[var(--color-text-faint)]">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{entry.nickname}</span>
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[var(--color-text-muted)]">
                    {formatDuration(entry.verifiedSecondsWeek)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          {joinedNickname ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              You&rsquo;re in this room as <span className="font-medium text-[var(--color-text)]">{joinedNickname}</span>.
              Verified minutes from your reading sessions show up here automatically.
            </p>
          ) : myGoalId ? (
            <form onSubmit={join} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-[var(--color-text-faint)]">
                  Join as
                </span>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your nickname"
                  className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                />
              </label>
              <Button type="submit" disabled={busy}>
                {busy ? "Joining…" : "Join this room"}
              </Button>
              {error && <p className="w-full text-sm text-[var(--color-danger)]">{error}</p>}
            </form>
          ) : (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--color-text-muted)]">
                You need a goal before you can join this leaderboard.
              </p>
              <LinkButton href={`/goal/new?room=${roomCode}`} variant="secondary">
                Start a goal
              </LinkButton>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
