import Link from "next/link";
import { verifySession } from "@/lib/server/auth/dal";
import { getWorkoutLogById } from "@/lib/server/workouts/queries";
import { updateWorkoutLog } from "@/lib/server/workouts/actions";
import { getExerciseOptionsForUser } from "@/lib/server/exercises/queries";
import { addCustomExercise } from "@/lib/server/exercises/actions";
import { WorkoutForm } from "@/components/workout-form";
import { Button } from "@/components/ui/button";

export default async function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();

  // Number("abc") is NaN, which Postgres rejects with an error rather than
  // returning zero rows — guard before it ever reaches the query.
  const numericId = Number(id);
  const log = Number.isInteger(numericId)
    ? await getWorkoutLogById(numericId, session.userId)
    : null;

  if (!log) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Workout not found</h1>
        <Button render={<Link href="/history" />} nativeButton={false} className="w-fit">
          Back to history
        </Button>
      </div>
    );
  }

  const exerciseOptions = await getExerciseOptionsForUser(session.userId);
  const updateAction = updateWorkoutLog.bind(null, log.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Workout</h1>
        <p className="text-sm text-muted-foreground">{log.label}</p>
      </div>

      <WorkoutForm
        initialLog={log}
        exerciseOptions={exerciseOptions}
        onAddCustomExercise={addCustomExercise}
        action={updateAction}
      />
    </div>
  );
}
