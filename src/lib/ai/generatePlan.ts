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

function fallbackPlan(input: GoalSetupInput): PlanResponse {
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
    return fallbackPlan(input);
  }

  const model = process.env.AI_MODEL || "meta/llama-3.1-8b-instruct";
  const prompt = `You are a reading coach. Create a week-by-week reading plan as STRICT JSON only (no prose, no markdown fences).

Goal: "${input.title}"
Duration: ${input.durationWeeks} weeks
Sessions per week: ${input.sessionsPerWeek}
Minutes per session: ${input.minutesPerSession}

Output exactly this JSON shape:
{"weeks": [{"week": 1, "title": "...", "target_minutes": ${input.sessionsPerWeek * input.minutesPerSession}, "sessions": ${input.sessionsPerWeek}, "checkpoint": "one short comprehension question or micro-task"}]}

Produce one entry per week (${input.durationWeeks} total), progressing sensibly through the goal. All text in English.`;

  try {
    // No `temperature` override: some models behind OpenAI-compatible
    // endpoints (e.g. Claude via Anthropic's compat layer) reject it.
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = completion.choices[0]?.message?.content || "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = JSON.parse(extractJson(raw));
    }
    if (isValidPlan(parsed)) {
      return parsed;
    }
    return fallbackPlan(input);
  } catch (err) {
    console.error("AI plan generation failed, using fallback planner:", err);
    return fallbackPlan(input);
  }
}
