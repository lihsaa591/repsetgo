import { describe, expect, it } from "vitest";
import { suggestNextWorkout } from "./suggest";

describe("suggestNextWorkout", () => {
  it("suggests the label that has gone longest without being logged", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-05", exerciseNames: ["Bench Press"] },
      { label: "Pull Day", date: "2026-08-01", exerciseNames: ["Deadlift"] },
      { label: "Leg Day", date: "2026-07-20", exerciseNames: ["Squat"] },
    ];
    const result = suggestNextWorkout(logs);
    expect(result.label).toBe("Leg Day");
    expect(result.exercises).toEqual(["Squat"]);
  });

  it("includes the day count since the last session of that label in the reason", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-05", exerciseNames: ["Bench Press"] },
      { label: "Leg Day", date: "2026-07-20", exerciseNames: ["Squat"] },
    ];
    // relative to a fixed "today" passed explicitly, to keep the test deterministic
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.reason).toContain("18 days");
    expect(result.reason).toContain("Leg Day");
  });

  it("falls back to a generic message when there are no logs yet", () => {
    const result = suggestNextWorkout([]);
    expect(result.label).toBe("Full Body");
    expect(result.reason).toContain("Log your first workout");
    expect(result.exercises).toEqual([]);
  });

  it("handles a single distinct label by re-suggesting it", () => {
    const logs = [
      { label: "Push Day", date: "2026-08-01", exerciseNames: ["Bench Press"] },
    ];
    const result = suggestNextWorkout(logs, new Date("2026-08-07"));
    expect(result.label).toBe("Push Day");
    expect(result.exercises).toEqual(["Bench Press"]);
  });
});
