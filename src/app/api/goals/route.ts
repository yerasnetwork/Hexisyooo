import { NextRequest, NextResponse } from "next/server";
import { createGoal } from "@/lib/db";
import type { GoalSetupInput, PlanResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    visitorId?: string;
    input?: GoalSetupInput;
    plan?: PlanResponse;
  };

  if (!body.visitorId || !body.input || !body.plan) {
    return NextResponse.json({ error: "Missing visitorId, input, or plan" }, { status: 400 });
  }

  try {
    const goal = await createGoal(body.visitorId, body.input, body.plan);
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create goal" },
      { status: 500 }
    );
  }
}
