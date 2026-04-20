import type { Timestamp } from "firebase/firestore";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Exercise = {
  id: string;
  name: string;
  bodyPart?: string;
  category?: string;
  duration?: string;
  trackingType?: "time" | "reps" | "weight_reps";
  muscleGroup?: string;
  equipment?: string;
  createdBy?: string;
  createdAt?: Timestamp | number;
};

export type RoutineExerciseRef = {
  id: string;
  name: string;
};

export type Routine = {
  id: string;
  name: string;
  description?: string;
  exercises?: RoutineExerciseRef[];
  createdAt?: string;
  createdBy?: string;
};

export type WorkoutExerciseRef = {
  id: string;
  name: string;
};

export type WorkoutSet = {
  weight?: number;
  reps?: number;
  seconds?: number;
  unit?: "lb" | "kg";
  completedAt?: number;
  restSeconds?: number;
};

export type WorkoutExerciseLog = {
  id: string;
  name: string;
  trackingType?: "time" | "reps" | "weight_reps";
  sets?: WorkoutSet[];
};

export type WorkoutEntry = {
  id: string;
  title: string;
  routineId?: string;
  exercises?: WorkoutExerciseLog[] | WorkoutExerciseRef[];
  durationMinutes?: number;
  volume?: number;
  date?: unknown;
  createdAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  createdBy?: string;
};

export type BodyWeightEntry = {
  weight: number;
  unit: "lb" | "kg";
  date: string; // ISO date string
  createdAt?: unknown;
};

export type HomeSection = {
  id: string;
  type:
    | "quickStats"
    | "startWorkout"
    | "recentWorkouts"
    | "heatmap"
    | "todaySnapshot"
    | "weeklyPlan"
    | "activeRoutinePicker"
    | "bodyWeight"
    | "progressTiles"
    | "goals"
    | "notifications"
    | "recentNotes"
    | "topLifts"
    | "prs";
  createdAt?: string;
};

export type ProgressSection = {
  id: string;
  type:
    | "consistency"
    | "volumeTrend"
    | "bodyWeight"
    | "topLifts"
    | "exerciseProgress"
    | "sessionDuration"
    | "goalsSnapshot";
  createdAt?: string;
};

export type PRRecord = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  value: number;
  unit: "lb" | "kg";
  date: string; // ISO date string
  createdAt?: string;
};
