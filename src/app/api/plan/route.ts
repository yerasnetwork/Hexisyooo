import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/ai/generatePlan";
import type { GoalSetupInput } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<GoalSetupInput>;

  if (
    !body.title ||
    !body.durationWeeks ||
    !body.sessionsPerWeek ||
    !body.minutesPerSession ||
    body.depositAmount === undefined
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const input: GoalSetupInput = {
    title: String(body.title).slice(0, 200),
    durationWeeks: Math.max(1, Math.min(52, Number(body.durationWeeks))),
    sessionsPerWeek: Math.max(1, Math.min(14, Number(body.sessionsPerWeek))),
    minutesPerSession: Math.max(5, Math.min(240, Number(body.minutesPerSession))),
    depositAmount: Math.max(0, Number(body.depositAmount)),
    carriedOverLocked: body.carriedOverLocked ? Math.max(0, Number(body.carriedOverLocked)) : 0,
  };

  try {
    const plan = await generatePlan(input);
    return NextResponse.json({ plan, input });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate plan" },
      { status: 500 }
    );
  }
}
