import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const entries = await getLeaderboard(code.toUpperCase());
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
