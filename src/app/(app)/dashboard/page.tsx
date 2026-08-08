import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogsForUser, getSuggestionFromLogs } from "@/lib/server/workouts/queries";
import { Flame, TrendingUp, CalendarDays } from "lucide-react";

export default async function DashboardPage() {
  const session = await verifySession();
  const workoutLogs = await getWorkoutLogsForUser(session.userId);
  const suggestion = getSuggestionFromLogs(workoutLogs);

  const totalSetsThisWeek = workoutLogs
    .flatMap((w) => w.exercises)
    .flatMap((e) => e.sets).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Good to see you 👋</h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s up for today, {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-primary" />
              Today&apos;s Suggested Workout
            </CardTitle>
          </div>
          <Badge variant="secondary">{suggestion.label}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
          <div className="flex flex-wrap gap-2">
            {suggestion.exercises.map((ex) => (
              <Badge key={ex} variant="outline">
                {ex}
              </Badge>
            ))}
          </div>
          <Button render={<Link href="/log" />} nativeButton={false} className="mt-2 w-full sm:w-fit">
            Start Logging
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Workouts
            </span>
            <span className="text-2xl font-semibold">{workoutLogs.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Sets logged
            </span>
            <span className="text-2xl font-semibold">{totalSetsThisWeek}</span>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Last workout</span>
            <span className="text-2xl font-semibold">{workoutLogs[0]?.label ?? "—"}</span>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">Recent Logs</h2>
          <Link href="/history" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {workoutLogs.slice(0, 2).map((log) => (
            <Card key={log.id}>
              <CardContent className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{log.label}</p>
                  <p className="text-xs text-muted-foreground">{log.date}</p>
                </div>
                <Badge variant="outline">{log.exercises.length} exercises</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
