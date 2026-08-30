"use client";

import { useActionState, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ExercisePicker } from "@/components/exercise-picker";
import { Trash2, Plus, NotebookPen, ChevronDown, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkoutLogWithDetails } from "@/lib/server/workouts/queries";
import type { WorkoutFormState } from "@/lib/server/workouts/validation";

/** Today in the *viewer's* timezone — `toISOString()` would give the UTC day. */
function todayLocalIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type DraftSet = {
  id: string;
  reps: string;
  weight: string;
  isDropset: boolean;
  note: string;
};
type DraftExercise = { id: string; exerciseName: string; sets: DraftSet[] };

let idCounter = 0;
const nextId = () => `d${idCounter++}`;

function toDraftExercises(log?: WorkoutLogWithDetails): DraftExercise[] {
  if (!log) {
    return [
      {
        id: nextId(),
        exerciseName: "",
        sets: [
          { id: nextId(), reps: "", weight: "", isDropset: false, note: "" },
        ],
      },
    ];
  }
  return log.exercises.map((ex) => ({
    id: nextId(),
    exerciseName: ex.exerciseName,
    sets: ex.sets.map((s) => ({
      id: nextId(),
      reps: String(s.reps),
      weight: String(s.weight),
      isDropset: s.isDropset,
      note: s.note ?? "",
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
  action: (
    prevState: WorkoutFormState,
    formData: FormData
  ) => Promise<WorkoutFormState>;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [workoutLabel, setWorkoutLabel] = useState(initialLog?.label ?? "Push Day");
  const [workoutDate, setWorkoutDate] = useState(
    initialLog?.date ?? todayLocalIso()
  );
  const [notes, setNotes] = useState(initialLog?.notes ?? "");
  const [exercises, setExercises] = useState<DraftExercise[]>(() =>
    toDraftExercises(initialLog)
  );
  // Which sets have their note field expanded. Sets that already carry a
  // note from an existing log start expanded so it's visible on open.
  const [openNoteIds, setOpenNoteIds] = useState<ReadonlySet<string>>(() => {
    const withNotes = exercises.flatMap((e) => e.sets).filter((s) => s.note);
    return new Set(withNotes.map((s) => s.id));
  });

  function toggleNoteOpen(setId: string) {
    setOpenNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }

  // Exercises start expanded; collapsing is purely a display convenience —
  // collapsed exercises still submit normally via their hidden inputs.
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<
    ReadonlySet<string>
  >(new Set());

  function toggleExerciseCollapsed(exerciseId: string) {
    setCollapsedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  function addExercise() {
    // Collapse everything already on the page so the new (empty, most
    // relevant) exercise is the one visible without scrolling past
    // already-filled-in cards.
    setCollapsedExerciseIds(new Set(exercises.map((e) => e.id)));
    setExercises((prev) => [
      ...prev,
      {
        id: nextId(),
        exerciseName: "",
        sets: [
          { id: nextId(), reps: "", weight: "", isDropset: false, note: "" },
        ],
      },
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
      prev.map((e) => {
        if (e.id !== exerciseId) return e;
        // Pre-fill from the previous set — most sets repeat the same
        // reps/weight, so this saves retyping in the common case. Still
        // just a default; the new row is fully editable.
        const lastSet = e.sets[e.sets.length - 1];
        const newSet = {
          id: nextId(),
          reps: lastSet?.reps ?? "",
          weight: lastSet?.weight ?? "",
          // Dropsets and notes are one-off tags on a specific set, not
          // something to repeat automatically onto the next set.
          isDropset: false,
          note: "",
        };
        return { ...e, sets: [...e.sets, newSet] };
      })
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
    field: "reps" | "weight" | "note",
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

  function toggleDropset(exerciseId: string, setId: string) {
    setExercises((prev) =>
      prev.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s) =>
                s.id === setId ? { ...s, isDropset: !s.isDropset } : s
              ),
            }
          : e
      )
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="exerciseCount" value={exercises.length} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              {collapsedExerciseIds.has(exercise.id) && (
                <span className="flex h-8 items-center text-xs text-muted-foreground">
                  {exercise.sets.length} set{exercise.sets.length === 1 ? "" : "s"}
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={
                  collapsedExerciseIds.has(exercise.id)
                    ? "Expand exercise"
                    : "Collapse exercise"
                }
                aria-expanded={!collapsedExerciseIds.has(exercise.id)}
                onClick={() => toggleExerciseCollapsed(exercise.id)}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    collapsedExerciseIds.has(exercise.id) && "-rotate-90"
                  )}
                />
              </Button>
              {exercises.length > 1 && (
                <Button variant="ghost" size="icon" type="button" onClick={() => removeExercise(exercise.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent
              className={cn(
                "flex flex-col gap-2",
                collapsedExerciseIds.has(exercise.id) && "hidden"
              )}
            >
              <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem_2rem] items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span className="text-center">Dropset?</span>
                <span />
                <span />
              </div>
              {exercise.sets.map((set, setIdx) => {
                const noteOpen = openNoteIds.has(set.id);
                return (
                  <div
                    key={set.id}
                    className={cn(
                      "flex flex-col gap-1.5",
                      set.isDropset && "ml-4 border-l-2 border-primary/40 pl-2"
                    )}
                  >
                    <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem_2rem_2rem] items-center gap-2">
                      {set.isDropset ? (
                        <ArrowDownRight
                          className="h-4 w-4 text-muted-foreground"
                          aria-label={`Drop from set ${setIdx}`}
                        />
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">{setIdx + 1}</span>
                      )}
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
                      <div className="flex justify-center">
                        <Checkbox
                          name={`exercise-${exIdx}-set-${setIdx}-isDropset`}
                          value="on"
                          checked={set.isDropset}
                          onCheckedChange={() => toggleDropset(exercise.id, set.id)}
                          aria-label="Dropset: a set taken to near-failure, then continued at a lower weight without rest"
                          title="Dropset: a set taken to near-failure, then continued at a lower weight without rest"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        aria-label={noteOpen ? "Hide note" : "Add note"}
                        aria-pressed={noteOpen}
                        title="Add a note to this set"
                        onClick={() => toggleNoteOpen(set.id)}
                      >
                        <NotebookPen
                          className={cn(
                            "h-3.5 w-3.5",
                            set.note ? "text-primary" : "text-muted-foreground/60"
                          )}
                        />
                      </Button>
                      {exercise.sets.length > 1 ? (
                        <Button variant="ghost" size="icon" type="button" onClick={() => removeSet(exercise.id, set.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                    {noteOpen && (
                      <Textarea
                        name={`exercise-${exIdx}-set-${setIdx}-note`}
                        value={set.note}
                        onChange={(e) => updateSet(exercise.id, set.id, "note", e.target.value)}
                        placeholder="e.g. felt easy, could go heavier next time"
                        rows={1}
                        className="text-xs"
                      />
                    )}
                  </div>
                );
              })}
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

      <div className="sticky bottom-16 flex flex-col gap-2 md:bottom-4">
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" type="button" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" className="flex-1" size="lg" disabled={pending}>
            {pending
              ? "Saving..."
              : initialLog
                ? "Save Changes"
                : "Save Workout"}
          </Button>
        </div>
      </div>
    </form>
  );
}
