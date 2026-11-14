import { NextResponse } from "next/server";
import { withdrawClaimable } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const goal = await withdrawClaimable(id);
    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to withdraw" },
      { status: 500 }
    );
  }
}
