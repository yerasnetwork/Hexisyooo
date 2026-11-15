import OpenAI from "openai";
import { deriveTitleFromText, ensureUniqueTitles, formatDuration } from "../text";
import type { GoalSetupInput, PlanResponse, WeekPlan } from "../types";

function extractJson(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model output");
  }
  return raw.slice(start, end + 1);
}

function isValidPlan(value: unknown): value is PlanResponse {
  if (!value || typeof value !== "object") return false;
  const weeks = (value as { weeks?: unknown }).weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return false;
  return weeks.every(
    (w) =>
      w &&
      typeof w === "object" &&
      typeof (w as WeekPlan).week === "number" &&
      typeof (w as WeekPlan).title === "string" &&
      typeof (w as WeekPlan).target_seconds === "number" &&
      typeof (w as WeekPlan).sessions === "number" &&
      typeof (w as WeekPlan).checkpoint === "string"
  );
}

/** Fills in a missing/malformed `content` field, and guarantees unique titles. */
function normalizePlan(plan: PlanResponse): PlanResponse {
  const titles = ensureUniqueTitles(plan.weeks.map((w) => w.title));
  return {
    weeks: plan.weeks.map((w, i) => ({
      ...w,
      title: titles[i],
      content: typeof w.content === "string" ? w.content : "",
    })),
  };
}

/**
 * Neutral week skeleton for the financial/pool structure only — used for
 * book-upload goals, whose real reading content and titles live in their own
 * sections (derived from the uploaded PDF), not here. Titles are
 * intentionally plain ("Week N") since this skeleton makes no claim about
 * content.
 */
export function buildFinancialWeekSkeleton(input: GoalSetupInput): PlanResponse {
  const weeks: WeekPlan[] = Array.from({ length: input.durationWeeks }, (_, i) => ({
    week: i + 1,
    title: `Week ${i + 1}`,
    target_seconds: input.sessionsPerWeek * input.secondsPerSession,
    sessions: input.sessionsPerWeek,
    checkpoint: "Summarize the main idea of what you read this week in 1-2 sentences.",
    content: "",
  }));
  return { weeks };
}

/**
 * Used only when the AI call itself fails or returns something unusable for
 * a skill goal (no uploaded material to fall back on). Each week still gets
 * genuinely distinct content, and its title is derived from that content
 * rather than a repeated template — so even this degraded path never shows
 * the same title twice.
 */
export function buildDeterministicPlan(input: GoalSetupInput): PlanResponse {
  const weeks: WeekPlan[] = Array.from({ length: input.durationWeeks }, (_, i) => {
    const weekNum = i + 1;
    const stage =
      weekNum <= Math.ceil(input.durationWeeks * 0.3)
        ? "the fundamentals"
        : weekNum <= Math.ceil(input.durationWeeks * 0.7)
          ? "applying what you've covered so far"
          : "pulling everything together";
    const content = `Session ${weekNum} of your "${input.title}" plan focuses on ${stage}.\n1. Review what you covered last time, if anything.\n2. Spend most of this session working directly on ${stage} for "${input.title}".\n3. Write down one thing you learned or want to revisit next time.`;
    return {
      week: weekNum,
      title: deriveTitleFromText(content),
      target_seconds: input.sessionsPerWeek * input.secondsPerSession,
      sessions: input.sessionsPerWeek,
      checkpoint: `Summarize what you focused on this session in 1-2 sentences.`,
      content,
    };
  });
  return normalizePlan({ weeks });
}

function getClient(): OpenAI | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_BASE_URL || "https://integrate.api.nvidia.com/v1";
  return new OpenAI({ apiKey, baseURL });
}

/**
 * Abstracted plan generator. Swapping providers only requires changing
 * AI_BASE_URL / AI_API_KEY / AI_MODEL env vars. Falls back to a deterministic
 * local plan (no network call) when no key is configured yet, so the rest of
 * the product stays demoable while the final provider key is pending.
 */
export async function generatePlan(input: GoalSetupInput): Promise<PlanResponse> {
  const client = getClient();
  if (!client) {
    return buildDeterministicPlan(input);
  }

  const model = process.env.AI_MODEL || "meta/llama-3.1-8b-instruct";
  const targetSeconds = input.sessionsPerWeek * input.secondsPerSession;
  const prompt = `You are a reading/learning coach. Create a week-by-week plan as STRICT JSON only (no prose, no markdown fences).

Goal: "${input.title}"
Duration: ${input.durationWeeks} weeks
Sessions per week: ${input.sessionsPerWeek}
Session length: ${formatDuration(input.secondsPerSession)} (minutes:seconds)

Each week needs real content to engage with during the session, not just a one-line checkpoint — either a short written passage to read, or a short numbered list of hands-on tasks. Keep it to roughly 150-250 words total (or 3-5 short tasks) — enough to fill part of a ${formatDuration(targetSeconds)} session, not an exhaustive lesson.

The "title" field is critical: it must be a short, specific phrase drawn directly from that week's own content — e.g. naming the actual concept, chapter, or task covered that week. Never use a generic template like "Week 1: Getting started", "Building momentum", or "Finishing strong" — those say nothing about the content and are not acceptable. No two weeks may share the same title; each must be unique and clearly describe what makes that week different from the others.

Output exactly this JSON shape:
{"weeks": [{"week": 1, "title": "...", "target_seconds": ${targetSeconds}, "sessions": ${input.sessionsPerWeek}, "checkpoint": "one short comprehension question or micro-task", "content": "the actual passage to read or numbered task list for this week"}]}

Produce one entry per week (${input.durationWeeks} total), progressing sensibly through the goal. All text in English.`;

  try {
    // No `temperature` override: some models behind OpenAI-compatible
    // endpoints (e.g. Claude via Anthropic's compat layer) reject it.
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: Math.min(8000, 700 + input.durationWeeks * 900),
    });
    const raw = completion.choices[0]?.message?.content || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(extractJson(raw));
    }
    if (isValidPlan(parsed)) {
      return normalizePlan(parsed);
    }
    console.error("AI plan generation returned an invalid shape, using fallback planner");
    return buildDeterministicPlan(input);
  } catch (err) {
    console.error("AI plan generation failed, using fallback planner:", err);
    return buildDeterministicPlan(input);
  }
}
