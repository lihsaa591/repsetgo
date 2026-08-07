"use client";

import { useRouter } from "next/navigation";
import { WorkoutForm } from "@/components/workout-form";
import { useWorkoutLogs } from "@/hooks/use-workout-logs";

export default function LogWorkoutPage() {
  const router = useRouter();
  const { addLog } = useWorkoutLogs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Log Workout</h1>
        <p className="text-sm text-muted-foreground">
          Add exercises and sets as you go
        </p>
      </div>

      <WorkoutForm
        onSave={(log) => {
          addLog(log);
          router.push("/history");
        }}
      />
    </div>
  );
}
