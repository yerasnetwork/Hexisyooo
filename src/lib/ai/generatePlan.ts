import OpenAI from "openai";
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
      typeof (w as WeekPlan).target_minutes === "number" &&
      typeof (w as WeekPlan).sessions === "number" &&
      typeof (w as WeekPlan).checkpoint === "string"
  );
}

/** Fills in a missing/malformed `content` field rather than rejecting an otherwise-valid plan. */
function normalizeContent(plan: PlanResponse): PlanResponse {
  return {
    weeks: plan.weeks.map((w) => ({
      ...w,
      content: typeof w.content === "string" ? w.content : "",
    })),
  };
}

/**
 * Deterministic plan skeleton — no network call. Used as the AI fallback,
 * and directly for book-upload goals (which get their real content from the
 * uploaded PDF's chunks instead of AI-generated weekly content).
 */
export function buildDeterministicPlan(input: GoalSetupInput): PlanResponse {
  const weeks: WeekPlan[] = Array.from({ length: input.durationWeeks }, (_, i) => {
    const weekNum = i + 1;
    const phase =
      weekNum <= Math.ceil(input.durationWeeks * 0.3)
        ? "Getting started"
        : weekNum <= Math.ceil(input.durationWeeks * 0.7)
          ? "Building momentum"
          : "Finishing strong";
    return {
      week: weekNum,
      title: `Week ${weekNum}: ${phase} with "${input.title}"`,
      target_minutes: input.sessionsPerWeek * input.minutesPerSession,
      sessions: input.sessionsPerWeek,
      checkpoint: `Summarize the main idea of what you read this week in 1-2 sentences.`,
      content: `Spend this session making progress on "${input.title}":\n1. Review what you covered last time.\n2. Work on today's focus: ${phase.toLowerCase()}.\n3. Jot down one thing you learned or want to remember.`,
    };
  });
  return { weeks };
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
  const targetMinutes = input.sessionsPerWeek * input.minutesPerSession;
  const prompt = `You are a reading/learning coach. Create a week-by-week plan as STRICT JSON only (no prose, no markdown fences).

Goal: "${input.title}"
Duration: ${input.durationWeeks} weeks
Sessions per week: ${input.sessionsPerWeek}
Minutes per session: ${input.minutesPerSession}

Each week needs real content to engage with during the session, not just a one-line checkpoint — either a short written passage to read, or a short numbered list of hands-on tasks. Keep it to roughly 150-250 words total (or 3-5 short tasks) — enough to fill part of a ${targetMinutes}-minute session, not an exhaustive lesson.

Output exactly this JSON shape:
{"weeks": [{"week": 1, "title": "...", "target_minutes": ${targetMinutes}, "sessions": ${input.sessionsPerWeek}, "checkpoint": "one short comprehension question or micro-task", "content": "the actual passage to read or numbered task list for this week"}]}

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
      return normalizeContent(parsed);
    }
    return buildDeterministicPlan(input);
  } catch (err) {
    console.error("AI plan generation failed, using fallback planner:", err);
    return buildDeterministicPlan(input);
  }
}
