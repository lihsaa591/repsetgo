"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { WorkoutForm } from "@/components/workout-form";
import { useWorkoutLogs } from "@/hooks/use-workout-logs";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getLog, updateLog } = useWorkoutLogs();
  const log = getLog(id);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Workout</h1>
        <p className="text-sm text-muted-foreground">{log.label}</p>
      </div>

      <WorkoutForm
        initialLog={log}
        onCancel={() => router.push("/history")}
        onSave={(updated) => {
          updateLog(id, updated);
          router.push("/history");
        }}
      />
    </div>
  );
}
