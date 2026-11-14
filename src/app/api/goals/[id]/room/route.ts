import { NextRequest, NextResponse } from "next/server";
import { joinRoom } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { nickname?: string; roomCode?: string };

  if (!body.nickname || body.nickname.trim().length === 0) {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
  }

  try {
    const goal = await joinRoom(id, body.nickname.trim().slice(0, 40), body.roomCode);
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to join room" },
      { status: 500 }
    );
  }
}
