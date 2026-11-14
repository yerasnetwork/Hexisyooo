import { notFound } from "next/navigation";
import { getBookChunk, getGoal } from "@/lib/db";
import { totalCompletedSessions } from "@/lib/pool";
import { SessionClient } from "@/components/session/SessionClient";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) notFound();
  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!goal || goal.status !== "active" || !currentWeek) notFound();

  const content =
    goal.contentSource === "book"
      ? await getBookChunk(goal.id, totalCompletedSessions(goal.weeks))
      : currentWeek.content || null;

  return (
    <SessionClient
      goalId={goal.id}
      weekTitle={currentWeek.title}
      targetMinutes={currentWeek.target_minutes}
      verifiedMinutesSoFar={currentWeek.verifiedMinutes}
      isFamilyGoal={goal.isFamily}
      content={content}
      isBookFinished={goal.contentSource === "book" && content === null}
    />
  );
}
