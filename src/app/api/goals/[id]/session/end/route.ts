import { NextRequest, NextResponse } from "next/server";
import { evaluateCheckpointAnswer } from "@/lib/ai/evaluateCheckpoint";
import { endSession, getBookChunk, getGoal } from "@/lib/db";
import { totalCompletedSessions } from "@/lib/pool";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as {
    sessionId?: string;
    verifiedSeconds?: number;
    checkpointAnswer?: string;
  };

  if (!body.sessionId || body.verifiedSeconds === undefined) {
    return NextResponse.json({ error: "Missing sessionId or verifiedSeconds" }, { status: 400 });
  }

  try {
    const answer = (body.checkpointAnswer ?? "").trim();
    if (answer) {
      const goal = await getGoal(id);
      if (goal) {
        const week = goal.weeks.find((w) => w.week === goal.currentWeek);
        if (week) {
          let sectionContent = week.content || "";
          if (goal.contentSource === "book") {
            const chunk = await getBookChunk(goal.id, totalCompletedSessions(goal.weeks));
            sectionContent = chunk?.content ?? sectionContent;
          }
          const result = await evaluateCheckpointAnswer(week.checkpoint, sectionContent, answer);
          if (!result.passed) {
            return NextResponse.json({
              passed: false,
              feedback: result.feedback || "That doesn't look related to what you read — try again.",
            });
          }
        }
      }
    }

    const { goal, unlockedAmount } = await endSession(
      id,
      body.sessionId,
      Math.max(0, Number(body.verifiedSeconds))
    );
    return NextResponse.json({ goal, passed: true, unlockedAmount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to end session" },
      { status: 500 }
    );
  }
}
