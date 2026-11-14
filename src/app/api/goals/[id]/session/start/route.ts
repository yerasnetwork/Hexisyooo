import { NextResponse } from "next/server";
import { startSession } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await startSession(id);
    return NextResponse.json(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start session" },
      { status: 500 }
    );
  }
}
