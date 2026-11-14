import { NextRequest, NextResponse } from "next/server";
import { saveSessionClip } from "@/lib/db";

const MAX_CLIP_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const file = form.get("file");

  if (typeof sessionId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing sessionId or file" }, { status: 400 });
  }
  if (file.size > MAX_CLIP_BYTES) {
    return NextResponse.json({ error: "Clip too large" }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const clipUrl = await saveSessionClip(id, sessionId, buffer, file.type || "video/webm");
    return NextResponse.json({ clipUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save clip" },
      { status: 500 }
    );
  }
}
