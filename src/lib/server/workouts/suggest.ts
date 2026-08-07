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

  return {
    label: chosen.label,
    reason: `It's been ${daysSince} days since your last ${chosen.label} session.`,
    exercises: chosen.exerciseNames,
  };
}
