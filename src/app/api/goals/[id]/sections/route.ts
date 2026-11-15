import { NextResponse } from "next/server";
import { getBookSectionTitles } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const titles = await getBookSectionTitles(id);
    return NextResponse.json({ titles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load sections" },
      { status: 500 }
    );
  }
}
