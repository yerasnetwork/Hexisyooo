import { notFound } from "next/navigation";
import { getGoal } from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export default async function GoalDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ room?: string }>;
}) {
  const { id } = await params;
  const { room } = await searchParams;
  const goal = await getGoal(id);
  if (!goal) notFound();

  return <DashboardClient goal={goal} prefillRoomCode={room} />;
}
