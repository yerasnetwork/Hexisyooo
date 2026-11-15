import { notFound } from "next/navigation";
import { getBookChunk, getBookSectionTitles, getGoal } from "@/lib/db";
import { totalCompletedSessions } from "@/lib/pool";
import { paragraphize } from "@/lib/text";
import { SessionClient } from "@/components/session/SessionClient";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) notFound();
  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!goal || goal.status !== "active" || !currentWeek) notFound();

  let sectionTitle = currentWeek.title;
  let sectionIndex = currentWeek.week;
  let totalSections = goal.durationWeeks;
  let content: string | null = currentWeek.content || null;
  let isBookFinished = false;

  if (goal.contentSource === "book") {
    const completed = totalCompletedSessions(goal.weeks);
    const [chunk, titles] = await Promise.all([
      getBookChunk(goal.id, completed),
      getBookSectionTitles(goal.id),
    ]);
    totalSections = titles.length;
    sectionIndex = completed + 1;
    isBookFinished = chunk === null;
    sectionTitle = chunk?.title ?? "You've finished this book!";
    content = chunk?.content ?? null;
  }

  const paragraphs = content ? paragraphize(content) : [];

  return (
    <SessionClient
      goalId={goal.id}
      sectionTitle={sectionTitle}
      sectionIndex={sectionIndex}
      totalSections={totalSections}
      targetSeconds={currentWeek.target_seconds}
      verifiedSecondsSoFar={currentWeek.verifiedSeconds}
      isFamilyGoal={goal.isFamily}
      paragraphs={paragraphs}
      isBookFinished={isBookFinished}
      checkpoint={currentWeek.checkpoint}
    />
  );
}
