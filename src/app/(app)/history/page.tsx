import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogsForUser } from "@/lib/server/workouts/queries";
import { HistoryList } from "./history-list";

export default async function HistoryPage() {
  const session = await verifySession();
  const logs = await getWorkoutLogsForUser(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">All your logged workouts</p>
      </div>
      <HistoryList logs={logs} />
    </div>
  );
}
