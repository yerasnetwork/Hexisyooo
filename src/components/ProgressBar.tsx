export function ProgressBar({
  value,
  max,
  tone = "accent",
}: {
  value: number;
  max: number;
  tone?: "accent" | "neutral";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-locked-soft)]">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${
          tone === "accent" ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-faint)]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
