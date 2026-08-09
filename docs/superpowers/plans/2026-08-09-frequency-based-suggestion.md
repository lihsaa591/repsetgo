# Frequency-Based Exercise Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank a suggested workout's exercises by how often they appear across the user's whole history for that label (top 6, ties broken by recency), instead of using only the single most recent log's exercise list.

**Architecture:** A single change inside the existing pure function `suggestNextWorkout` — no new files, no schema/query changes, no new inputs/outputs.

**Tech Stack:** TypeScript, Vitest — no new dependencies.

## Global Constraints

- Label selection logic (which workout is most overdue) is unchanged.
- `SuggestInput`/`Suggestion` types are unchanged — this is purely a different derivation of `exercises` from the same input.
- Exercise list capped at 6, sorted by frequency descending, ties broken by latest-appearance date descending.
- All 4 existing tests in `suggest.test.ts` must continue to pass unchanged.

---

### Task 1: Frequency-based exercise ranking (TDD)

**Files:**
- Modify: `src/lib/server/workouts/suggest.ts`
- Modify: `src/lib/server/workouts/suggest.test.ts`

**Interfaces:**
- Consumes: nothing new — same `SuggestInput`/`Suggestion` types already defined in this file.
- Produces: no new exports — `suggestNextWorkout`'s existing signature and behavior for label selection are unchanged; only its `exercises` output changes.

- [ ] **Step 1: Write the failing tests**

Add these to the end of the existing `describe("suggestNextWorkout", ...)` block in `suggest.test.ts`, alongside (not replacing) the 4 existing tests:

```ts
  it("ranks exercises by frequency across all logs for that label, not just the most recent one", () => {
    const logs = [
      { label: "Push Day", date: "2026-07-01", exerciseNames: ["Bench Press", "Overhead Press"] },
      { label: "Push Day", date: "2026-07-08", exerciseNames: ["Bench Press", "Overhead Press"] },
      { label: "Push Day", date: "2026-07-15", exerciseNames: ["Bench Press"] },
      // Most recent Push Day session only logged one exercise — the old
      // logic would have suggested just ["Dips"]. Overhead Press and Bench
      // Press appeared more often across history and should rank higher.
      { label: "Push Day", date: "2026-08-01", exerciseNames: ["Dips"] },
    ];
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.label).toBe("Push Day");
    expect(result.exercises).toEqual(["Bench Press", "Overhead Press", "Dips"]);
  });

  it("caps the exercise list at 6, keeping the most frequent", () => {
    const logs = [
      { label: "Push Day", date: "2026-07-01", exerciseNames: ["A", "B", "C", "D", "E", "F", "G"] },
      { label: "Push Day", date: "2026-07-08", exerciseNames: ["A", "B", "C", "D", "E", "F"] },
      { label: "Push Day", date: "2026-07-15", exerciseNames: ["A", "B", "C", "D", "E"] },
    ];
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.exercises).toHaveLength(6);
    expect(result.exercises).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("breaks a frequency tie by which exercise was done more recently", () => {
    const logs = [
      { label: "Push Day", date: "2026-06-01", exerciseNames: ["Old Favorite"] },
      { label: "Push Day", date: "2026-08-01", exerciseNames: ["Recent Pick"] },
    ];
    // Both exercises appear exactly once (tied frequency) — "Recent Pick"
    // was logged more recently and should be ordered first.
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.exercises).toEqual(["Recent Pick", "Old Favorite"]);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/server/workouts/suggest.test.ts`
Expected: the 3 new tests FAIL (exercises still derived from `chosen.exerciseNames` only); the 4 pre-existing tests still PASS.

- [ ] **Step 3: Implement frequency-based ranking**

Replace the `exercises: chosen.exerciseNames` line and the code above the `return` statement in `suggestNextWorkout` with:

```ts
// src/lib/server/workouts/suggest.ts — replace the final section of the
// function (from where `chosen`/`daysSince` are already computed) with:

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
```

Keep everything above this (the `logs.length === 0` early return, `mostRecentByLabel`/`oldest`/`chosen`/`daysSince` computation) exactly as it already is — only the final `exercises` derivation and the `return` statement change.

- [ ] **Step 4: Run tests to verify they all pass**

Run: `npx vitest run src/lib/server/workouts/suggest.test.ts`
Expected: PASS, all 7 tests (4 existing + 3 new).

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: both clean — this function has no other callers whose behavior would need updating (`getSuggestionFromLogs` just passes its output through unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/workouts/suggest.ts src/lib/server/workouts/suggest.test.ts
git commit -m "feat: rank suggested exercises by frequency across history, not just the last log"
```

---

## Self-Review Notes

- **Spec coverage:** frequency-across-history ranking → Step 3; top-6 cap → Step 3 (`MAX_SUGGESTED_EXERCISES`) + tested in Step 1's cap test; recency tie-break → Step 3 (`lastDate.localeCompare`) + tested in Step 1's tie-break test; label-selection logic unchanged → Step 3 explicitly preserves the code above the changed section; all 4 pre-existing tests still pass → Step 4/5.
- **Placeholder scan:** none found.
- **Type consistency check:** no type changes — `SuggestInput`/`Suggestion` are untouched, and the new internal `frequency` Map is local to the function, not part of any public interface.
