import { NextResponse } from "next/server";
import { advanceWeek } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const goal = await advanceWeek(id);
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to advance week" },
      { status: 500 }
    );
  }
}
