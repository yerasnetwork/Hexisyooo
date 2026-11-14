import { LockIcon, UnlockIcon } from "./icons";

function formatUsd(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MoneyStat({
  kind,
  amount,
  label,
}: {
  kind: "claimable" | "locked";
  amount: number;
  label: string;
}) {
  const isClaimable = kind === "claimable";
  return (
    <div
      className={`flex-1 rounded-xl border p-5 ${
        isClaimable
          ? "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-locked-soft)]"
      }`}
    >
      <div
        className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isClaimable
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-white/5 text-[var(--color-text-muted)]"
        }`}
      >
        {isClaimable ? <UnlockIcon width={14} height={14} /> : <LockIcon width={14} height={14} />}
        {label}
      </div>
      <p
        className={`font-mono text-3xl font-semibold tabular-nums ${
          isClaimable ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
      >
        {formatUsd(amount)}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-faint)]">
        {isClaimable ? "Yours to withdraw now" : "Unlocks as you verify your reading"}
      </p>
    </div>
  );
}

export { formatUsd };
