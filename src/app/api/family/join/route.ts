import { NextRequest, NextResponse } from "next/server";
import { joinFamilyGoal } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    code?: string;
    nickname?: string;
    visitorId?: string;
  };

  if (!body.code || !body.nickname?.trim() || !body.visitorId) {
    return NextResponse.json({ error: "Missing code, nickname, or visitorId" }, { status: 400 });
  }

  try {
    const goal = await joinFamilyGoal(body.code, body.nickname.trim().slice(0, 40), body.visitorId);
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join" },
      { status: 400 }
    );
  }
}
