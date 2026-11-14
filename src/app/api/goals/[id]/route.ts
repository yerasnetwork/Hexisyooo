import { NextResponse } from "next/server";
import { getGoal } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }
  return NextResponse.json({ goal });
}
