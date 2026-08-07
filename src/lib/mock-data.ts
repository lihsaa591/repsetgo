export type SetEntry = {
  setNumber: number;
  reps: number;
  weight: number;
};

export type ExerciseLog = {
  id: string;
  exerciseName: string;
  sets: SetEntry[];
};

export type WorkoutLog = {
  id: string;
  date: string;
  label: string;
  exercises: ExerciseLog[];
  notes?: string;
};

export const exerciseCatalog = [
  "Bench Press",
  "Incline Dumbbell Press",
  "Barbell Squat",
  "Deadlift",
  "Overhead Press",
  "Barbell Row",
  "Pull Up",
  "Bicep Curl",
  "Tricep Pushdown",
  "Lat Pulldown",
];

export const workoutLogs: WorkoutLog[] = [
  {
    id: "wl-3",
    date: "2026-08-02",
    label: "Push Day",
    exercises: [
      {
        id: "e1",
        exerciseName: "Bench Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 60 },
          { setNumber: 2, reps: 8, weight: 65 },
          { setNumber: 3, reps: 6, weight: 70 },
        ],
      },
      {
        id: "e2",
        exerciseName: "Overhead Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 30 },
          { setNumber: 2, reps: 8, weight: 32.5 },
        ],
      },
    ],
    notes: "Felt strong today, bumped bench weight",
  },
  {
    id: "wl-2",
    date: "2026-07-30",
    label: "Pull Day",
    exercises: [
      {
        id: "e3",
        exerciseName: "Deadlift",
        sets: [
          { setNumber: 1, reps: 5, weight: 100 },
          { setNumber: 2, reps: 5, weight: 110 },
          { setNumber: 3, reps: 3, weight: 120 },
        ],
      },
      {
        id: "e4",
        exerciseName: "Barbell Row",
        sets: [
          { setNumber: 1, reps: 10, weight: 50 },
          { setNumber: 2, reps: 10, weight: 50 },
        ],
      },
    ],
  },
  {
    id: "wl-1",
    date: "2026-07-28",
    label: "Leg Day",
    exercises: [
      {
        id: "e5",
        exerciseName: "Barbell Squat",
        sets: [
          { setNumber: 1, reps: 8, weight: 80 },
          { setNumber: 2, reps: 8, weight: 85 },
          { setNumber: 3, reps: 6, weight: 90 },
        ],
      },
    ],
  },
  {
    id: "wl-0",
    date: "2026-07-25",
    label: "Push Day",
    exercises: [
      {
        id: "e6",
        exerciseName: "Bench Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 57.5 },
          { setNumber: 2, reps: 8, weight: 62.5 },
        ],
      },
    ],
  },
  {
    id: "wl-neg1",
    date: "2026-07-23",
    label: "Pull Day",
    exercises: [
      {
        id: "e7",
        exerciseName: "Lat Pulldown",
        sets: [
          { setNumber: 1, reps: 12, weight: 45 },
          { setNumber: 2, reps: 10, weight: 50 },
        ],
      },
    ],
  },
  {
    id: "wl-neg2",
    date: "2026-07-21",
    label: "Leg Day",
    exercises: [
      {
        id: "e8",
        exerciseName: "Barbell Squat",
        sets: [
          { setNumber: 1, reps: 8, weight: 77.5 },
          { setNumber: 2, reps: 8, weight: 82.5 },
        ],
      },
    ],
  },
  {
    id: "wl-neg3",
    date: "2026-07-18",
    label: "Push Day",
    exercises: [
      {
        id: "e9",
        exerciseName: "Incline Dumbbell Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 22.5 },
          { setNumber: 2, reps: 8, weight: 25 },
        ],
      },
    ],
  },
  {
    id: "wl-neg4",
    date: "2026-07-16",
    label: "Pull Day",
    exercises: [
      {
        id: "e10",
        exerciseName: "Deadlift",
        sets: [
          { setNumber: 1, reps: 5, weight: 95 },
          { setNumber: 2, reps: 5, weight: 105 },
        ],
      },
    ],
  },
  {
    id: "wl-neg5",
    date: "2026-07-14",
    label: "Leg Day",
    exercises: [
      {
        id: "e11",
        exerciseName: "Barbell Squat",
        sets: [
          { setNumber: 1, reps: 8, weight: 75 },
          { setNumber: 2, reps: 8, weight: 80 },
        ],
      },
    ],
  },
  {
    id: "wl-neg6",
    date: "2026-07-11",
    label: "Push Day",
    exercises: [
      {
        id: "e12",
        exerciseName: "Overhead Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 27.5 },
          { setNumber: 2, reps: 8, weight: 30 },
        ],
      },
    ],
  },
  {
    id: "wl-neg7",
    date: "2026-07-09",
    label: "Pull Day",
    exercises: [
      {
        id: "e13",
        exerciseName: "Barbell Row",
        sets: [
          { setNumber: 1, reps: 10, weight: 47.5 },
          { setNumber: 2, reps: 10, weight: 47.5 },
        ],
      },
    ],
  },
  {
    id: "wl-neg8",
    date: "2026-07-07",
    label: "Leg Day",
    exercises: [
      {
        id: "e14",
        exerciseName: "Barbell Squat",
        sets: [
          { setNumber: 1, reps: 8, weight: 72.5 },
          { setNumber: 2, reps: 8, weight: 77.5 },
        ],
      },
    ],
  },
  {
    id: "wl-neg9",
    date: "2026-07-04",
    label: "Push Day",
    exercises: [
      {
        id: "e15",
        exerciseName: "Bench Press",
        sets: [
          { setNumber: 1, reps: 10, weight: 55 },
          { setNumber: 2, reps: 8, weight: 60 },
        ],
      },
    ],
  },
  {
    id: "wl-neg10",
    date: "2026-07-02",
    label: "Pull Day",
    exercises: [
      {
        id: "e16",
        exerciseName: "Pull Up",
        sets: [
          { setNumber: 1, reps: 8, weight: 0 },
          { setNumber: 2, reps: 6, weight: 0 },
        ],
      },
    ],
  },
];

export const suggestedToday = {
  label: "Leg Day",
  reason: "Based on your rotation, it's been 5 days since your last leg session",
  exercises: ["Barbell Squat", "Deadlift", "Lunges"],
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  joinedAt: string;
  totalLogs: number;
  lastActive: string;
};

export const adminUsers: AdminUser[] = [
  {
    id: "u1",
    name: "Aashil Bijukshe",
    email: "aashil.bijukshe@themegrill.com",
    role: "admin",
    joinedAt: "2026-06-01",
    totalLogs: 24,
    lastActive: "2026-08-02",
  },
  {
    id: "u2",
    name: "Sara Thapa",
    email: "sara.t@example.com",
    role: "user",
    joinedAt: "2026-06-15",
    totalLogs: 14,
    lastActive: "2026-08-01",
  },
  {
    id: "u3",
    name: "Rohit KC",
    email: "rohit.kc@example.com",
    role: "user",
    joinedAt: "2026-07-10",
    totalLogs: 3,
    lastActive: "2026-07-29",
  },
];
