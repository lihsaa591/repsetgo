"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExercisePicker } from "@/components/exercise-picker";
import { Trash2, Plus } from "lucide-react";
import type { WorkoutLogWithDetails } from "@/lib/server/workouts/queries";

type DraftSet = { id: string; reps: string; weight: string };
type DraftExercise = { id: string; exerciseName: string; sets: DraftSet[] };

let idCounter = 0;
const nextId = () => `d${idCounter++}`;

function toDraftExercises(log?: WorkoutLogWithDetails): DraftExercise[] {
  if (!log) {
    return [
      { id: nextId(), exerciseName: "", sets: [{ id: nextId(), reps: "", weight: "" }] },
    ];
  }
  return log.exercises.map((ex) => ({
    id: nextId(),
    exerciseName: ex.exerciseName,
    sets: ex.sets.map((s) => ({
      id: nextId(),
      reps: String(s.reps),
      weight: String(s.weight),
    })),
  }));
}

export function WorkoutForm({
  initialLog,
  exerciseOptions,
  onAddCustomExercise,
  action,
  onCancel,
}: {
  initialLog?: WorkoutLogWithDetails;
  exerciseOptions: string[];
  onAddCustomExercise: (name: string) => void;
  action: (formData: FormData) => void;
  onCancel?: () => void;
}) {
  const [workoutLabel, setWorkoutLabel] = useState(initialLog?.label ?? "Push Day");
  const [workoutDate, setWorkoutDate] = useState(
    initialLog?.date ?? new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    toDraftExercises(initialLog)
  );

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { id: nextId(), exerciseName: "", sets: [{ id: nextId(), reps: "", weight: "" }] },
    ]);
  }

  function removeExercise(id: string) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }

  function updateExerciseName(id: string, name: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, exerciseName: name } : e))
    );
  }

  function addSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: [...e.sets, { id: nextId(), reps: "", weight: "" }] }
          : e
      )
    );
  }

  function removeSet(exerciseId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
          : e
      )
    );
  }

  function updateSet(
    exerciseId: string,
    setId: string,
    field: "reps" | "weight",
    value: string
  ) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
            }
          : e
      )
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="exerciseCount" value={exercises.length} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workout-label">Workout name</Label>
              <Input
                id="workout-label"
                name="label"
                value={workoutLabel}
                onChange={(e) => setWorkoutLabel(e.target.value)}
                placeholder="e.g. Push Day"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                name="date"
                type="date"
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workout-notes">Notes (optional)</Label>
            <Textarea
              id="workout-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {exercises.map((exercise, exIdx) => (
          <Card key={exercise.id}>
            <input type="hidden" name={`exercise-${exIdx}-name`} value={exercise.exerciseName} />
            <input type="hidden" name={`exercise-${exIdx}-setCount`} value={exercise.sets.length} />
            <CardHeader className="flex flex-row items-end justify-between gap-2">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor={`exercise-${exercise.id}`}>Exercise</Label>
                <ExercisePicker
                  id={`exercise-${exercise.id}`}
                  value={exercise.exerciseName}
                  options={exerciseOptions}
                  onChange={(name) => updateExerciseName(exercise.id, name)}
                  onAddCustom={onAddCustomExercise}
                />
              </div>
              {exercises.length > 1 && (
                <Button variant="ghost" size="icon" type="button" onClick={() => removeExercise(exercise.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span />
              </div>
              {exercise.sets.map((set, setIdx) => (
                <div key={set.id} className="grid grid-cols-[2rem_1fr_1fr_2rem] items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{setIdx + 1}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    name={`exercise-${exIdx}-set-${setIdx}-reps`}
                    value={set.reps}
                    onChange={(e) => updateSet(exercise.id, set.id, "reps", e.target.value)}
                    placeholder="10"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    name={`exercise-${exIdx}-set-${setIdx}-weight`}
                    value={set.weight}
                    onChange={(e) => updateSet(exercise.id, set.id, "weight", e.target.value)}
                    placeholder="60"
                  />
                  {exercise.sets.length > 1 ? (
                    <Button variant="ghost" size="icon" type="button" onClick={() => removeSet(exercise.id, set.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" type="button" className="mt-1 w-fit" onClick={() => addSet(exercise.id)}>
                <Plus className="h-3.5 w-3.5" /> Add set
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button variant="secondary" type="button" onClick={addExercise}>
        <Plus className="h-4 w-4" /> Add exercise
      </Button>

      <div className="sticky bottom-16 flex gap-2 md:bottom-4">
        {onCancel && (
          <Button variant="outline" type="button" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" size="lg">
          {initialLog ? "Save Changes" : "Save Workout"}
        </Button>
      </div>
    </form>
  );
}
