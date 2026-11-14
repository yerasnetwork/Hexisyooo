import { notFound } from "next/navigation";
import { getGoal } from "@/lib/db";
import { SessionClient } from "@/components/session/SessionClient";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = await getGoal(id);
  if (!goal) notFound();
  const currentWeek = goal.weeks.find((w) => w.week === goal.currentWeek);
  if (!goal || goal.status !== "active" || !currentWeek) notFound();

  return (
    <SessionClient
      goalId={goal.id}
      weekTitle={currentWeek.title}
      targetMinutes={currentWeek.target_minutes}
      verifiedMinutesSoFar={currentWeek.verifiedMinutes}
    />
  );
}
