import { NextRequest, NextResponse } from "next/server";
import { buildDeterministicPlan } from "@/lib/ai/generatePlan";
import { createGoal, saveBookChunks } from "@/lib/db";
import { extractPdfText, splitIntoChunks } from "@/lib/pdf";
import type { GoalSetupInput } from "@/lib/types";

// Vercel Functions cap request bodies at 4.5 MB; leave headroom for the rest
// of the multipart payload.
const MAX_PDF_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const visitorId = form.get("visitorId");
  const title = form.get("title");
  const durationWeeks = Number(form.get("durationWeeks"));
  const sessionsPerWeek = Number(form.get("sessionsPerWeek"));
  const minutesPerSession = Number(form.get("minutesPerSession"));
  const depositAmount = Number(form.get("depositAmount"));
  const isFamily = form.get("isFamily") === "true";
  const file = form.get("file");

  if (
    typeof visitorId !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: "Missing visitorId, title, or file" }, { status: 400 });
  }
  if (
    !Number.isFinite(durationWeeks) ||
    !Number.isFinite(sessionsPerWeek) ||
    !Number.isFinite(minutesPerSession) ||
    !Number.isFinite(depositAmount)
  ) {
    return NextResponse.json({ error: "Invalid plan settings" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "PDF is too large — please upload a file under 4 MB." },
      { status: 413 }
    );
  }

  const input: GoalSetupInput = {
    title: title.slice(0, 200),
    durationWeeks: Math.max(1, Math.min(52, durationWeeks)),
    sessionsPerWeek: Math.max(1, Math.min(14, sessionsPerWeek)),
    minutesPerSession: Math.max(5, Math.min(240, minutesPerSession)),
    depositAmount: Math.max(0, depositAmount),
  };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);
    if (!text.trim()) {
      return NextResponse.json(
        { error: "Couldn't find any text in that PDF — is it a scanned/image-only file?" },
        { status: 422 }
      );
    }

    const totalSessions = input.durationWeeks * input.sessionsPerWeek;
    const chunks = splitIntoChunks(text, totalSessions);

    const plan = buildDeterministicPlan(input);
    const goal = await createGoal(visitorId, input, plan, { isFamily, contentSource: "book" });
    await saveBookChunks(goal.id, chunks);

    return NextResponse.json({ goal });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process PDF" },
      { status: 500 }
    );
  }
}
