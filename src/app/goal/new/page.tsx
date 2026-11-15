"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ArrowRightIcon, BookIcon, ShieldIcon } from "@/components/icons";
import { getVisitorId, rememberGoalId } from "@/lib/visitor";
import type { GoalSetupInput, PlanResponse, WeekPlan } from "@/lib/types";

type Step = "form" | "review" | "submitting";
type ContentMode = "skill" | "book";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

const defaultInput: GoalSetupInput = {
  title: "",
  durationWeeks: 4,
  sessionsPerWeek: 3,
  minutesPerSession: 25,
  depositAmount: 20,
};

export default function NewGoalPage() {
  return (
    <Suspense fallback={null}>
      <NewGoalForm />
    </Suspense>
  );
}

function NewGoalForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<ContentMode>("skill");
  const [step, setStep] = useState<Step>("form");
  const [input, setInput] = useState<GoalSetupInput>(defaultInput);
  const [isFamily, setIsFamily] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<WeekPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function goToDashboard(goalId: string) {
    rememberGoalId(goalId);
    router.push(roomParam ? `/goal/${goalId}?room=${roomParam}` : `/goal/${goalId}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!input.title.trim()) {
      setError(mode === "book" ? "Give your book a title." : "Tell us what you're learning.");
      return;
    }

    if (mode === "book") {
      if (!pdfFile) {
        setError("Choose a PDF to upload.");
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        form.append("visitorId", getVisitorId());
        form.append("title", input.title);
        form.append("durationWeeks", String(input.durationWeeks));
        form.append("sessionsPerWeek", String(input.sessionsPerWeek));
        form.append("minutesPerSession", String(input.minutesPerSession));
        form.append("depositAmount", String(input.depositAmount));
        form.append("isFamily", String(isFamily));
        form.append("file", pdfFile);
        const res = await fetch("/api/goals/book", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create goal");
        goToDashboard(data.goal.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate plan");
      const generated: PlanResponse = data.plan;
      setPlan(generated.weeks);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function updateWeek(index: number, patch: Partial<WeekPlan>) {
    setPlan((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  }

  async function handleConfirm() {
    setStep("submitting");
    setError(null);
    try {
      const visitorId = getVisitorId();
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, input, plan: { weeks: plan }, isFamily }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create goal");
      goToDashboard(data.goal.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("review");
    }
  }

  function handleFileChange(file: File | null) {
    setError(null);
    if (file && file.size > MAX_PDF_BYTES) {
      setError("That PDF is too large — please choose one under 4 MB.");
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPdfFile(file);
    if (file && !input.title.trim()) {
      setInput((v) => ({ ...v, title: file.name.replace(/\.pdf$/i, "") }));
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--color-bg)] px-6 py-10 sm:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
        >
          <ShieldIcon width={16} height={16} className="text-[var(--color-accent)]" />
          Hexis
        </Link>

        {step === "form" && (
          <Card>
            <h1 className="mb-1 text-xl font-semibold">Set your goal</h1>
            <p className="mb-5 text-sm text-[var(--color-text-muted)]">
              We&rsquo;ll turn this into a week-by-week plan you can tweak before it&rsquo;s locked
              in.
            </p>

            <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-1">
              <ModeTab active={mode === "skill"} onClick={() => setMode("skill")}>
                Learn a skill
              </ModeTab>
              <ModeTab active={mode === "book"} onClick={() => setMode("book")}>
                Upload a book (PDF)
              </ModeTab>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {mode === "skill" ? (
                <Field
                  label="What do you want to learn?"
                  hint="A book title, or a topic you want to study."
                >
                  <input
                    autoFocus
                    value={input.title}
                    onChange={(e) => setInput((v) => ({ ...v, title: e.target.value }))}
                    placeholder="e.g. Atomic Habits"
                    className={inputClass}
                    maxLength={200}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Book title">
                    <input
                      value={input.title}
                      onChange={(e) => setInput((v) => ({ ...v, title: e.target.value }))}
                      placeholder="e.g. Dune"
                      className={inputClass}
                      maxLength={200}
                    />
                  </Field>
                  <Field label="PDF file" hint="under 4 MB — text is extracted, nothing uploaded elsewhere">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-[var(--color-text-muted)] file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-[var(--color-border-strong)] file:bg-[var(--color-surface-raised)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--color-text)]"
                    />
                  </Field>
                  {pdfFile && (
                    <p className="text-xs text-[var(--color-text-faint)]">
                      We&rsquo;ll split &ldquo;{pdfFile.name}&rdquo; into natural,
                      sentence-complete sections sized for a comfortable read — the number of
                      sections depends on the book&rsquo;s length, not your session settings.
                    </p>
                  )}
                </>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Duration" hint="weeks">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={input.durationWeeks}
                    onChange={(e) =>
                      setInput((v) => ({ ...v, durationWeeks: Number(e.target.value) }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Sessions" hint="per week">
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={input.sessionsPerWeek}
                    onChange={(e) =>
                      setInput((v) => ({ ...v, sessionsPerWeek: Number(e.target.value) }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Minutes" hint="per session">
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={input.minutesPerSession}
                    onChange={(e) =>
                      setInput((v) => ({ ...v, minutesPerSession: Number(e.target.value) }))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Your stake" hint="simulated dollars — no real payment, ever">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={input.depositAmount}
                    onChange={(e) =>
                      setInput((v) => ({ ...v, depositAmount: Number(e.target.value) }))
                    }
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </Field>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3.5">
                <input
                  type="checkbox"
                  checked={isFamily}
                  onChange={(e) => setIsFamily(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Set this goal for someone else (e.g. your child)
                  </span>
                  <span className="block text-xs text-[var(--color-text-faint)]">
                    You fund it and watch their progress — they join with a code and do the
                    reading. No account needed for either of you.
                  </span>
                </span>
              </label>

              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

              <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full">
                {busy && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#06240f]/30 border-t-[#06240f]" />
                )}
                {busy
                  ? mode === "book"
                    ? "Processing your PDF…"
                    : "Generating your plan…"
                  : mode === "book"
                    ? "Create my goal"
                    : "Generate my plan"}
                {!busy && <ArrowRightIcon width={18} height={18} />}
              </Button>
              {busy && mode === "skill" && (
                <p className="-mt-2 text-center text-xs text-[var(--color-text-faint)]">
                  Writing real material for each week can take up to 30 seconds.
                </p>
              )}
            </form>
          </Card>
        )}

        {(step === "review" || step === "submitting") && (
          <Card>
            <div className="mb-1 flex items-center gap-2">
              <BookIcon width={18} height={18} className="text-[var(--color-accent)]" />
              <h1 className="text-xl font-semibold">Your plan</h1>
            </div>
            <p className="mb-6 text-sm text-[var(--color-text-muted)]">
              Review and edit anything before you lock it in. Your ${input.depositAmount} stake
              unlocks in {plan.length} equal slices — one per week you hit target.
            </p>

            <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pr-1">
              {plan.map((week, i) => (
                <div
                  key={week.week}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--color-text-faint)]">
                      Week {week.week}
                    </span>
                    <span className="text-xs text-[var(--color-text-faint)]">
                      {week.target_minutes} min target
                    </span>
                  </div>
                  <input
                    value={week.title}
                    onChange={(e) => updateWeek(i, { title: e.target.value })}
                    className={`${inputClass} mb-2 font-medium`}
                  />
                  <input
                    value={week.checkpoint}
                    onChange={(e) => updateWeek(i, { checkpoint: e.target.value })}
                    className={`${inputClass} mb-2 text-sm text-[var(--color-text-muted)]`}
                  />
                  <textarea
                    value={week.content}
                    onChange={(e) => updateWeek(i, { content: e.target.value })}
                    rows={3}
                    className={`${inputClass} resize-y text-sm text-[var(--color-text-muted)]`}
                  />
                </div>
              ))}
            </div>

            {error && <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p>}

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep("form")}
                disabled={step === "submitting"}
              >
                Back
              </Button>
              <Button
                size="lg"
                onClick={handleConfirm}
                disabled={step === "submitting"}
                className="flex-1"
              >
                {step === "submitting"
                  ? "Locking it in…"
                  : isFamily
                    ? "Lock in & get invite code"
                    : "Lock in my goal"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        {hint && <span className="text-xs text-[var(--color-text-faint)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
        active
          ? "bg-[var(--color-accent)] text-[#06240f]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}
