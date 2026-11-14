import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { sessionId?: string; verifiedMinutes?: number };

  if (!body.sessionId || body.verifiedMinutes === undefined) {
    return NextResponse.json({ error: "Missing sessionId or verifiedMinutes" }, { status: 400 });
  }

  try {
    const goal = await endSession(id, body.sessionId, Math.max(0, Number(body.verifiedMinutes)));
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to end session" },
      { status: 500 }
    );
  }
}
