"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ArrowRightIcon, ShieldIcon, UsersIcon } from "@/components/icons";
import { getVisitorId, rememberGoalId } from "@/lib/visitor";

export default function FamilyJoinPage() {
  return (
    <Suspense fallback={null}>
      <FamilyJoinForm />
    </Suspense>
  );
}

function FamilyJoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Enter the code your parent gave you.");
      return;
    }
    if (!nickname.trim()) {
      setError("Pick a nickname first.");
      return;
    }
    setBusy(true);
    try {
      const visitorId = getVisitorId();
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), nickname: nickname.trim(), visitorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      rememberGoalId(data.goal.id);
      router.push(`/goal/${data.goal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        >
          <ShieldIcon width={16} height={16} className="text-[var(--color-accent)]" />
          Hexis
        </Link>

        <Card>
          <div className="mb-1 flex items-center gap-2">
            <UsersIcon width={18} height={18} className="text-[var(--color-accent)]" />
            <h1 className="text-xl font-semibold">Join a reading goal</h1>
          </div>
          <p className="mb-6 text-sm text-[var(--color-text-muted)]">
            Enter the code you got and pick a nickname. No account needed.
          </p>
          <form onSubmit={join} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. H3XK2P"
                className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Your nickname</span>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Jamie"
                className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

            <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
              {busy ? "Joining…" : "Join"}
              {!busy && <ArrowRightIcon width={18} height={18} />}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
