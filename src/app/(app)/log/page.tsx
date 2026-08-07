import { WorkoutForm } from "@/components/workout-form";
import { createWorkoutLog } from "@/lib/server/workouts/actions";
import { getExerciseOptionsForUser } from "@/lib/server/exercises/queries";
import { addCustomExercise } from "@/lib/server/exercises/actions";
import { verifySession } from "@/lib/server/auth/dal";

export default async function LogWorkoutPage() {
  const session = await verifySession();
  const exerciseOptions = await getExerciseOptionsForUser(session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Workout</h1>
        <p className="text-sm text-muted-foreground">
          Add exercises and sets as you go
        </p>
      </div>

      <WorkoutForm
        exerciseOptions={exerciseOptions}
        onAddCustomExercise={addCustomExercise}
        action={createWorkoutLog}
      />
    </div>
  );
}
