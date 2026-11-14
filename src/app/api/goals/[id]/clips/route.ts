import { NextResponse } from "next/server";
import { getSessionClips } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const clips = await getSessionClips(id);
    return NextResponse.json({ clips });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load clips" },
      { status: 500 }
    );
  }
}
