import { describe, expect, it } from "vitest";
import { parseWorkoutForm } from "./validation";

type SetInput = { reps?: string; weight?: string };
type ExerciseInput = { name?: string; sets?: SetInput[] };

function buildForm({
  label = "Push Day",
  date = "2026-03-04",
  notes = "",
  exercises = [{ name: "Bench Press", sets: [{ reps: "8", weight: "60" }] }],
  exerciseCountOverride,
  setCountOverrides = {},
}: {
  label?: string;
  date?: string;
  notes?: string;
  exercises?: ExerciseInput[];
  exerciseCountOverride?: string;
  setCountOverrides?: Record<number, string>;
} = {}) {
  const fd = new FormData();
  fd.set("label", label);
  fd.set("date", date);
  fd.set("notes", notes);
  fd.set("exerciseCount", exerciseCountOverride ?? String(exercises.length));

  exercises.forEach((ex, i) => {
    fd.set(`exercise-${i}-name`, ex.name ?? "");
    const sets = ex.sets ?? [];
    fd.set(`exercise-${i}-setCount`, setCountOverrides[i] ?? String(sets.length));
    sets.forEach((s, si) => {
      fd.set(`exercise-${i}-set-${si}-reps`, s.reps ?? "");
      fd.set(`exercise-${i}-set-${si}-weight`, s.weight ?? "");
    });
  });

  return fd;
}

describe("parseWorkoutForm", () => {
  it("accepts a well-formed workout", () => {
    const result = parseWorkoutForm(buildForm());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.label).toBe("Push Day");
    expect(result.data.date).toBe("2026-03-04");
    expect(result.data.notes).toBeNull();
    expect(result.data.exercises).toEqual([
      {
        exerciseName: "Bench Press",
        order: 0,
        setsList: [{ setNumber: 1, reps: 8, weight: 60 }],
      },
    ]);
  });

  it("treats blank reps/weight as zero rather than rejecting", () => {
    const result = parseWorkoutForm(
      buildForm({ exercises: [{ name: "Squat", sets: [{}] }] })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exercises[0].setsList[0]).toEqual({
      setNumber: 1,
      reps: 0,
      weight: 0,
    });
  });

  it("keeps notes when provided", () => {
    const result = parseWorkoutForm(buildForm({ notes: "felt strong" }));
    expect(result.ok && result.data.notes).toBe("felt strong");
  });

  it.each([
    ["a missing label", { label: "" }],
    ["an over-long label", { label: "x".repeat(201) }],
    ["an over-long note", { notes: "x".repeat(2001) }],
    ["a missing date", { date: "" }],
    ["a non-ISO date", { date: "04/03/2026" }],
    ["a calendar-invalid date", { date: "2026-02-31" }],
    ["an implausible year", { date: "1799-01-01" }],
    ["no exercises at all", { exercises: [] }],
    ["only blank exercise names", { exercises: [{ name: "" }] }],
  ])("rejects %s", (_label, overrides) => {
    expect(parseWorkoutForm(buildForm(overrides)).ok).toBe(false);
  });

  it("rejects an exerciseCount above the cap", () => {
    const result = parseWorkoutForm(
      buildForm({ exerciseCountOverride: "100000" })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at most 50 exercises/);
  });

  it("rejects a non-numeric exerciseCount", () => {
    expect(
      parseWorkoutForm(buildForm({ exerciseCountOverride: "abc" })).ok
    ).toBe(false);
  });

  it("rejects a setCount above the cap", () => {
    const result = parseWorkoutForm(
      buildForm({ setCountOverrides: { 0: "500" } })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at most 50 sets/);
  });

  it("rejects out-of-range reps and weights", () => {
    expect(
      parseWorkoutForm(
        buildForm({ exercises: [{ name: "Row", sets: [{ reps: "5000" }] }] })
      ).ok
    ).toBe(false);
    expect(
      parseWorkoutForm(
        buildForm({ exercises: [{ name: "Row", sets: [{ reps: "-1" }] }] })
      ).ok
    ).toBe(false);
    expect(
      parseWorkoutForm(
        buildForm({ exercises: [{ name: "Row", sets: [{ weight: "9999" }] }] })
      ).ok
    ).toBe(false);
    expect(
      parseWorkoutForm(
        buildForm({ exercises: [{ name: "Row", sets: [{ weight: "abc" }] }] })
      ).ok
    ).toBe(false);
  });

  it("skips blank exercise slots but keeps the rest", () => {
    const result = parseWorkoutForm(
      buildForm({
        exercises: [
          { name: "", sets: [] },
          { name: "Deadlift", sets: [{ reps: "5", weight: "100" }] },
        ],
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exercises).toHaveLength(1);
    expect(result.data.exercises[0].exerciseName).toBe("Deadlift");
  });
});
