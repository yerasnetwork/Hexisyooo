"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRememberedGoalIds } from "@/lib/visitor";
import { ArrowRightIcon } from "./icons";

export function ResumeBanner() {
  const [goalId, setGoalId] = useState<string | null>(null);

  useEffect(() => {
    // localStorage isn't available during SSR, so this has to run post-mount.
    const ids = getRememberedGoalIds();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ids.length > 0) setGoalId(ids[0]);
  }, []);

  if (!goalId) return null;

  return (
    <Link
      href={`/goal/${goalId}`}
      className="flex items-center gap-2 self-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text)]"
    >
      Resume your goal
      <ArrowRightIcon width={14} height={14} />
    </Link>
  );
}
