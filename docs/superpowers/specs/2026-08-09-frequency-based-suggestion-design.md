# Frequency-Based Exercise Suggestions

**Status:** Approved for planning
**Date:** 2026-08-09

## Context

`suggestNextWorkout` (`src/lib/server/workouts/suggest.ts`) picks which workout label is most overdue (the label whose most recent occurrence is oldest), then returns that label's exercises from `chosen.exerciseNames` — the exercise list of the single most recent log with that label. If a user only logged one exercise in that particular session, the suggestion shows just one exercise, even if they've logged a fuller version of that workout on other occasions.

## Goals

- The suggested exercise list reflects the user's actual pattern for that label across their whole history, not just whatever happened to be in the most recent single log.
- Exercises are ranked by how often they appear under that label; the most frequent ones are suggested first.
- Capped at 6 exercises so the dashboard card stays a fixed, predictable size regardless of how varied someone's history is for a label.
- Ties in frequency are broken by recency (an exercise last done more recently wins a tie over one done longer ago).

## Non-goals

- No change to label selection (which workout is "most overdue") — that logic is unchanged.
- No set/rep count suggestions, no recency-weighted scoring beyond the tie-break, no per-exercise history shown on the dashboard.
- No changes to `getSuggestionFromLogs` or any caller — the function's inputs/outputs stay the same shape.

## Design

Inside `suggestNextWorkout`, after `chosen` (the most-overdue label's most recent log) is determined exactly as today, replace `exercises: chosen.exerciseNames` with a new computation:

1. Filter `logs` to those matching `chosen.label`.
2. Count occurrences of each exercise name across those logs, and track the latest `date` each exercise name appears in (for the tie-break).
3. Sort by count descending; ties broken by latest-appearance date descending.
4. Take the top 6 exercise names.

This requires no new fields on `SuggestInput`/`Suggestion` — it's purely a different way of deriving `exercises` from the same input shape.

## Testing

Extend `suggest.test.ts`:
- An exercise appearing in 3 older logs under a label beats an exercise that only appears in the single most recent log under that same label (proves frequency-across-history, not last-log-only).
- More than 6 distinct exercises under one label results in exactly 6 returned, the top 6 by frequency.
- Two exercises tied on frequency: the one with the more recent last-appearance date is ordered first.
- Existing single-label, single-exercise, and empty-logs cases continue to pass unchanged (no regression on the label-selection logic).
