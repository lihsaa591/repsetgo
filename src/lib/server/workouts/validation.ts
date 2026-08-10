/**
 * Pure parsing/validation for the workout form, kept out of the "use server"
 * module so it can be unit-tested (server files may only export async fns).
 */

export type ParsedExercise = {
  exerciseName: string;
  order: number;
  setsList: {
    setNumber: number;
    reps: number;
    weight: number;
    isDropset: boolean;
  }[];
};

export type ParsedWorkout = {
  label: string;
  date: string;
  notes: string | null;
  exercises: ParsedExercise[];
};

export type WorkoutFormState = { error: string } | undefined;

// Bounds exist so a hand-crafted POST can't drive an unbounded server-side
// loop or push nonsense into the database. They are far above any real usage.
const MAX_EXERCISES = 50;
const MAX_SETS_PER_EXERCISE = 50;
const MAX_LABEL_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_REPS = 1000;
const MAX_WEIGHT = 2000;
const MIN_DATE = "1900-01-01";
const MAX_DATE = "2200-01-01";

export type ParseResult =
  | { ok: true; data: ParsedWorkout }
  | { ok: false; error: string };

function parseCount(raw: FormDataEntryValue | null, max: number): number | null {
  const n = Number(raw ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > max) return null;
  return n;
}

function isPlausibleIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  // Reject e.g. 2025-02-31, which Date would roll over to March.
  if (parsed.toISOString().slice(0, 10) !== value) return false;
  return value >= MIN_DATE && value <= MAX_DATE;
}

export function parseWorkoutForm(formData: FormData): ParseResult {
  const label = String(formData.get("label") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!label) {
    return { ok: false, error: "Add a workout name." };
  }
  if (label.length > MAX_LABEL_LENGTH) {
    return {
      ok: false,
      error: `Workout name must be ${MAX_LABEL_LENGTH} characters or fewer.`,
    };
  }
  if (!isPlausibleIsoDate(date)) {
    return { ok: false, error: "Enter a valid date." };
  }
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    return {
      ok: false,
      error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.`,
    };
  }

  const exerciseCount = parseCount(formData.get("exerciseCount"), MAX_EXERCISES);
  if (exerciseCount === null) {
    return { ok: false, error: `Add at most ${MAX_EXERCISES} exercises.` };
  }

  const exercises: ParsedExercise[] = [];

  for (let i = 0; i < exerciseCount; i++) {
    const exerciseName = String(formData.get(`exercise-${i}-name`) ?? "").trim();
    if (!exerciseName) continue;
    if (exerciseName.length > MAX_LABEL_LENGTH) {
      return {
        ok: false,
        error: `Exercise names must be ${MAX_LABEL_LENGTH} characters or fewer.`,
      };
    }

    const setCount = parseCount(
      formData.get(`exercise-${i}-setCount`),
      MAX_SETS_PER_EXERCISE
    );
    if (setCount === null) {
      return {
        ok: false,
        error: `Each exercise can have at most ${MAX_SETS_PER_EXERCISE} sets.`,
      };
    }

    const setsList: ParsedExercise["setsList"] = [];
    for (let s = 0; s < setCount; s++) {
      const reps = Number(formData.get(`exercise-${i}-set-${s}-reps`) ?? 0);
      const weight = Number(formData.get(`exercise-${i}-set-${s}-weight`) ?? 0);

      if (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS) {
        return { ok: false, error: `Reps must be a whole number from 0 to ${MAX_REPS}.` };
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT) {
        return { ok: false, error: `Weight must be a number from 0 to ${MAX_WEIGHT}.` };
      }
      const isDropset = formData.get(`exercise-${i}-set-${s}-isDropset`) === "on";

      setsList.push({ setNumber: s + 1, reps, weight, isDropset });
    }

    exercises.push({ exerciseName, order: i, setsList });
  }

  if (exercises.length === 0) {
    return { ok: false, error: "Add at least one exercise." };
  }

  return { ok: true, data: { label, date, notes, exercises } };
}

