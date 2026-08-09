export type SuggestInput = {
  label: string;
  date: string; // ISO date, e.g. "2026-08-05"
  exerciseNames: string[];
};

export type Suggestion = {
  label: string;
  reason: string;
  exercises: string[];
};

export function suggestNextWorkout(
  logs: SuggestInput[],
  today: Date = new Date()
): Suggestion {
  if (logs.length === 0) {
    return {
      label: "Full Body",
      reason: "Log your first workout to get personalized suggestions.",
      exercises: [],
    };
  }

  const mostRecentByLabel = new Map<string, SuggestInput>();
  for (const log of logs) {
    const existing = mostRecentByLabel.get(log.label);
    if (!existing || log.date > existing.date) {
      mostRecentByLabel.set(log.label, log);
    }
  }

  let oldest: SuggestInput | null = null;
  for (const log of mostRecentByLabel.values()) {
    if (!oldest || log.date < oldest.date) {
      oldest = log;
    }
  }

  // Non-null: mostRecentByLabel has at least one entry since logs.length > 0.
  const chosen = oldest!;
  const daysSince = Math.round(
    (today.getTime() - new Date(chosen.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const MAX_SUGGESTED_EXERCISES = 6;

  const frequency = new Map<string, { count: number; lastDate: string }>();
  for (const log of logs) {
    if (log.label !== chosen.label) continue;
    for (const exerciseName of log.exerciseNames) {
      const existing = frequency.get(exerciseName);
      if (existing) {
        existing.count += 1;
        if (log.date > existing.lastDate) existing.lastDate = log.date;
      } else {
        frequency.set(exerciseName, { count: 1, lastDate: log.date });
      }
    }
  }

  const exercises = Array.from(frequency.entries())
    .sort(([, a], [, b]) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastDate.localeCompare(a.lastDate);
    })
    .slice(0, MAX_SUGGESTED_EXERCISES)
    .map(([exerciseName]) => exerciseName);

  return {
    label: chosen.label,
    reason: `It's been ${daysSince} days since your last ${chosen.label} session.`,
    exercises,
  };
}
