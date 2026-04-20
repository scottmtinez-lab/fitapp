"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Flame,
  LayoutDashboard,
  NotebookPen,
  Plus,
  Target,
  Trophy,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "./_components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth/AuthProvider";
import { getClientDb } from "../lib/firebase/firestore";
import {
  subscribeUserBodyWeights,
  subscribeUserGoals,
  subscribeUserHomeSections,
  subscribeUserNotes,
  subscribeUserMacros,
  subscribeUserPRs,
  subscribeUserRoutines,
  subscribeUserWorkouts,
} from "../lib/db/users";
import { addBodyWeightEntry } from "../lib/db/bodyWeight";
import { subscribeExercises } from "../lib/db/exercises";
import { addHomeSection, setHomeSections } from "../lib/db/homeSections";
import { addPR } from "../lib/db/prs";
import { setUserGoals, type UserGoals } from "../lib/db/goals";
import { addUserNote } from "../lib/db/notes";
import type { Exercise, HomeSection } from "../lib/db/types";

// --- Types ---
interface Workout {
  id: string;
  title: string;
  date: string;
  duration: string;
  volume: number;
}

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseWorkoutDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object") {
    const maybeTimestamp = raw as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      const d = maybeTimestamp.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function parseBodyWeightDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object") {
    const maybeTimestamp = raw as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === "function") {
      const d = maybeTimestamp.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function getWorkoutDateFromAny(workout: Record<string, unknown>): Date | null {
  const candidates = [
    workout.date,
    workout.performedAt,
    workout.completedAt,
    workout.startedAt,
    workout.createdAt,
    workout.updatedAt,
  ];
  for (const c of candidates) {
    const d = parseWorkoutDate(c);
    if (d) return d;
  }
  return null;
}

function formatRelativeDayLabel(d: Date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`;
  return that.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function startOfWeek(d: Date) {
  // Monday start
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

function computeStreak(workoutDays: Set<string>) {
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (workoutDays.has(isoDate(d))) streak += 1;
    else break;
  }
  return streak;
}

function computeThisWeekCount(workoutDates: Date[]) {
  const now = new Date();
  const start = startOfWeek(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return workoutDates.filter((d) => d >= start && d < end).length;
}

function MonthHeatmap({ workedOut }: { workedOut: Set<string> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0 Sun -> 6 Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = firstDay.toLocaleString(undefined, { month: "long", year: "numeric" });

  const cells: Array<{ key: string; date: string | null; day: number | null; active: boolean }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ key: `pad-${i}`, date: null, day: null, active: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year, month, day);
    const id = isoDate(d);
    cells.push({ key: id, date: id, day, active: workedOut.has(id) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, date: null, day: null, active: false });
  }

  return (
    <div className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-white font-bold">{monthLabel}</p>
          <p className="text-xs text-neutral-500">Workout heatmap</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span>Less</span>
          <span className="w-3 h-3 rounded bg-neutral-800 border border-neutral-700" />
          <span className="w-3 h-3 rounded bg-indigo-500/30 border border-indigo-500/20" />
          <span className="w-3 h-3 rounded bg-indigo-500 border border-indigo-400/30" />
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) =>
          c.date ? (
            <div
              key={c.key}
              title={new Date(year, month, c.day ?? 1).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              aria-label={new Date(year, month, c.day ?? 1).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              className={`h-6 rounded-md border flex items-center justify-center text-[10px] font-medium ${
                c.active
                  ? "bg-indigo-500/90 border-indigo-400/30 text-white shadow-sm shadow-indigo-900/30"
                  : "bg-neutral-800 border-neutral-700 text-neutral-400"
              }`}
            >
              {c.day}
            </div>
          ) : (
            <div key={c.key} className="h-6" />
          ),
        )}
      </div>
    </div>
  );
}

function computeTodayNutrition(entries: unknown[]) {
  const todayId = isoDate(new Date());
  let calories = 0;
  let carbs = 0;
  let protein = 0;
  let fat = 0;
  let caloriesGoal: number | undefined;
  let carbsGoal: number | undefined;
  let proteinGoal: number | undefined;
  let fatGoal: number | undefined;

  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const obj = e as Record<string, unknown>;

    const d =
      parseWorkoutDate(obj.date) ||
      parseWorkoutDate(obj.loggedAt) ||
      parseWorkoutDate(obj.createdAt) ||
      parseWorkoutDate(obj.day);
    if (!d) continue;
    if (isoDate(d) !== todayId) continue;

    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    calories += n(obj.calories) + n(obj.kcal);
    carbs += n(obj.carbs);
    protein += n(obj.protein);
    fat += n(obj.fat);

    const goals = obj.goals;
    if (goals && typeof goals === "object") {
      const g = goals as Record<string, unknown>;
      caloriesGoal = typeof g.calories === "number" ? g.calories : caloriesGoal;
      carbsGoal = typeof g.carbs === "number" ? g.carbs : carbsGoal;
      proteinGoal = typeof g.protein === "number" ? g.protein : proteinGoal;
      fatGoal = typeof g.fat === "number" ? g.fat : fatGoal;
    }
  }

  return { calories, carbs, protein, fat, caloriesGoal, carbsGoal, proteinGoal, fatGoal };
}

function weekDays() {
  const now = new Date();
  const start = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

type LiftSet = {
  exerciseName: string;
  weight: number;
  reps: number;
  unit: "lb" | "kg";
  t: number;
};

function extractLiftSets(rawWorkouts: unknown[]): LiftSet[] {
  const sets: LiftSet[] = [];

  for (const w of rawWorkouts) {
    if (!w || typeof w !== "object") continue;
    const workout = w as Record<string, unknown>;
    const d = getWorkoutDateFromAny(workout);
    const t = d ? d.getTime() : -1;

    const exercisesRaw =
      (Array.isArray(workout.exercises) && workout.exercises) ||
      (Array.isArray(workout.movements) && workout.movements) ||
      (Array.isArray(workout.items) && workout.items) ||
      [];

    if (!Array.isArray(exercisesRaw)) continue;

    for (const ex of exercisesRaw) {
      if (!ex || typeof ex !== "object") continue;
      const exercise = ex as Record<string, unknown>;
      const exerciseName =
        (typeof exercise.exerciseName === "string" && exercise.exerciseName) ||
        (typeof exercise.name === "string" && exercise.name) ||
        (typeof exercise.title === "string" && exercise.title) ||
        "Exercise";

      const setsRaw =
        (Array.isArray(exercise.sets) && exercise.sets) ||
        (Array.isArray(exercise.attempts) && exercise.attempts) ||
        (Array.isArray(exercise.entries) && exercise.entries) ||
        [];
      if (!Array.isArray(setsRaw)) continue;

      for (const s of setsRaw) {
        if (!s || typeof s !== "object") continue;
        const set = s as Record<string, unknown>;
        const weight =
          (typeof set.weight === "number" && set.weight) ||
          (typeof set.lb === "number" && set.lb) ||
          (typeof set.lbs === "number" && set.lbs) ||
          (typeof set.kg === "number" && set.kg) ||
          0;
        const reps =
          (typeof set.reps === "number" && set.reps) ||
          (typeof set.rep === "number" && set.rep) ||
          (typeof set.repetitions === "number" && set.repetitions) ||
          1;
        if (!weight || !reps) continue;
        const unit: "lb" | "kg" =
          set.unit === "kg" || (typeof set.kg === "number" && set.kg > 0) ? "kg" : "lb";
        sets.push({ exerciseName, weight, reps, unit, t });
      }
    }
  }

  return sets;
}

function epley1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

type TopLift = {
  exerciseName: string;
  est1RM: number;
  best: { weight: number; reps: number; unit: "lb" | "kg"; t: number };
};

function computeTopLifts(sets: LiftSet[]) {
  const byExercise = new Map<string, TopLift>();
  for (const s of sets) {
    const key = s.exerciseName.trim().toLowerCase();
    const est = epley1RM(s.weight, s.reps);
    const prev = byExercise.get(key);
    if (!prev || est > prev.est1RM) {
      byExercise.set(key, {
        exerciseName: s.exerciseName,
        est1RM: est,
        best: { weight: s.weight, reps: s.reps, unit: s.unit, t: s.t },
      });
    }
  }

  return Array.from(byExercise.values())
    .filter((x) => x.best.t > 0)
    .sort((a, b) => b.est1RM - a.est1RM)
    .slice(0, 6);
}

type NoteItem = { id: string; text: string; t: number };

function sectionTitle(type: HomeSection["type"]) {
  switch (type) {
    case "quickStats":
      return "Quick stats";
    case "todaySnapshot":
      return "Today snapshot";
    case "weeklyPlan":
      return "Weekly plan";
    case "activeRoutinePicker":
      return "Active routine picker";
    case "heatmap":
      return "Workout heatmap";
    case "bodyWeight":
      return "Body weight";
    case "progressTiles":
      return "Progress tiles";
    case "goals":
      return "Goals";
    case "notifications":
      return "Notifications";
    case "recentNotes":
      return "Recent notes";
    case "topLifts":
      return "Top lifts";
    case "prs":
      return "PRs";
    case "startWorkout":
      return "Start workout";
    case "recentWorkouts":
      return "Recent workouts";
    default:
      return "Section";
  }
}

export default function WorkoutDashboard() {
  const router = useRouter();
  const { user, loading, approved, checkingApproval } = useAuth();
  const [rawWorkouts, setRawWorkouts] = useState<unknown[] | null>(null);
  const [rawBodyWeights, setRawBodyWeights] = useState<unknown[] | null>(null);
  const [rawRoutines, setRawRoutines] = useState<unknown[] | null>(null);
  const [rawNutrition, setRawNutrition] = useState<unknown[] | null>(null);
  const [rawGoals, setRawGoals] = useState<unknown>(null);
  const [rawNotes, setRawNotes] = useState<unknown[] | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [rawHomeSections, setRawHomeSections] = useState<unknown[] | null>(null);
  const [rawPRs, setRawPRs] = useState<unknown[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isAddPROpen, setIsAddPROpen] = useState(false);
  const [prExerciseId, setPrExerciseId] = useState("");
  const [prValue, setPrValue] = useState("");
  const [prUnit, setPrUnit] = useState<"lb" | "kg">("lb");
  const [prSaving, setPrSaving] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [goalsForm, setGoalsForm] = useState<UserGoals>({ weightUnit: "lb" });
  const [savingGoals, setSavingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || checkingApproval) return;
    if (!user) router.replace("/login");
    else if (!approved) {
      router.replace(`/access-requested?email=${encodeURIComponent(user.email || "")}`);
    }
  }, [approved, checkingApproval, loading, router, user]);
  const [isCustomizingHome, setIsCustomizingHome] = useState(false);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserWorkouts(db, user.uid, (items) => setRawWorkouts(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserBodyWeights(db, user.uid, (items) => setRawBodyWeights(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserRoutines(db, user.uid, (items) => setRawRoutines(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserMacros(db, user.uid, (items) => setRawNutrition(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserGoals(db, user.uid, (goals) => setRawGoals(goals));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserNotes(db, user.uid, (items) => setRawNotes(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserHomeSections(db, user.uid, (items) => setRawHomeSections(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserPRs(db, user.uid, (items) => setRawPRs(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db) return;
    return subscribeExercises(db, (items) => setExercises(items));
  }, []);

  const dashboardWorkouts = useMemo<Workout[]>(() => {
    if (!rawWorkouts) return [];

    const items = rawWorkouts
      .map((w, i) => {
        if (!w || typeof w !== "object") return null;
        const obj = w as Record<string, unknown>;
        const dateObj = getWorkoutDateFromAny(obj);

        const title =
          (typeof obj.title === "string" && obj.title) ||
          (typeof obj.name === "string" && obj.name) ||
          "Workout";

        const volumeRaw = obj.volume ?? obj.totalVolume ?? obj.tonnage;
        const volume = typeof volumeRaw === "number" ? volumeRaw : 0;

        const durationRaw = obj.duration ?? obj.durationMinutes ?? obj.minutes;
        const duration =
          typeof durationRaw === "string"
            ? durationRaw
            : typeof durationRaw === "number"
              ? `${Math.round(durationRaw)}m`
              : "—";

        const dateLabel = dateObj ? formatRelativeDayLabel(dateObj) : "—";
        const id = (typeof obj.id === "string" && obj.id) || `${i}`;

        return {
          workout: { id, title, date: dateLabel, duration, volume },
          sort: dateObj?.getTime() ?? -1,
        };
      })
      .filter((x): x is { workout: Workout; sort: number } => Boolean(x))
      .sort((a, b) => b.sort - a.sort)
      .map((x) => x.workout);

    return items.slice(0, 8);
  }, [rawWorkouts]);

  const workoutDates = useMemo(() => {
    if (!rawWorkouts) return [];
    const dates: Date[] = [];
    for (const w of rawWorkouts) {
      if (!w || typeof w !== "object") continue;
      const d = getWorkoutDateFromAny(w as Record<string, unknown>);
      if (d) dates.push(d);
    }
    return dates;
  }, [rawWorkouts]);

  const workoutDays = useMemo(() => new Set(workoutDates.map((d) => isoDate(d))), [workoutDates]);
  const workedOutThisMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return new Set(
      workoutDates
        .filter((d) => d.getFullYear() === year && d.getMonth() === month)
        .map((d) => isoDate(d)),
    );
  }, [workoutDates]);

  const streakDays = useMemo(() => computeStreak(workoutDays), [workoutDays]);
  const thisWeekCount = useMemo(() => computeThisWeekCount(workoutDates), [workoutDates]);

  const latestBodyWeight = useMemo(() => {
    if (!rawBodyWeights) return null;
    const parsed = rawBodyWeights
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const obj = e as Record<string, unknown>;
        const weight = typeof obj.weight === "number" ? obj.weight : null;
        const unit = typeof obj.unit === "string" ? obj.unit : "lb";
        const d = parseBodyWeightDate(obj.date) || parseBodyWeightDate(obj.createdAt);
        if (!d || weight === null) return null;
        return { weight, unit, date: d.getTime() };
      })
      .filter((x): x is { weight: number; unit: string; date: number } => Boolean(x))
      .sort((a, b) => b.date - a.date);
    return parsed[0] ?? null;
  }, [rawBodyWeights]);

  const homeSections = useMemo(() => {
    if (!user?.uid || !rawHomeSections) return [];
    return rawHomeSections
      .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : null))
      .filter((s): s is Record<string, unknown> => Boolean(s))
      .map((s, i) => {
        const t = typeof s.type === "string" ? s.type : "";
        const allowed: HomeSection["type"][] = [
          "quickStats",
          "startWorkout",
          "recentWorkouts",
          "heatmap",
          "todaySnapshot",
          "weeklyPlan",
          "activeRoutinePicker",
          "bodyWeight",
          "progressTiles",
          "goals",
          "notifications",
          "recentNotes",
          "topLifts",
          "prs",
        ];
        const type = allowed.includes(t as HomeSection["type"]) ? (t as HomeSection["type"]) : null;
        if (!type) return null;
        const id = typeof s.id === "string" ? s.id : `${i}`;
        return { id, type };
      })
      .filter((x): x is { id: string; type: HomeSection["type"] } => Boolean(x));
  }, [rawHomeSections, user?.uid]);

  const prs = useMemo(() => {
    if (!user?.uid || !rawPRs) return [];
    return rawPRs
      .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : null))
      .filter((p): p is Record<string, unknown> => Boolean(p))
      .map((p, i) => {
        const id = typeof p.id === "string" ? p.id : `${i}`;
        const exerciseId = typeof p.exerciseId === "string" ? p.exerciseId : "";
        const exerciseName = typeof p.exerciseName === "string" ? p.exerciseName : "Exercise";
        const value = typeof p.value === "number" ? p.value : null;
        const unit = p.unit === "kg" ? "kg" : "lb";
        const date = typeof p.date === "string" ? p.date : "";
        const d = date ? new Date(date) : null;
        const t = d && !Number.isNaN(d.getTime()) ? d.getTime() : -1;
        if (!exerciseId || value === null) return null;
        return { id, exerciseId, exerciseName, value, unit, t };
      })
      .filter(
        (x): x is { id: string; exerciseId: string; exerciseName: string; value: number; unit: "lb" | "kg"; t: number } =>
          Boolean(x),
      )
      .sort((a, b) => b.t - a.t);
  }, [rawPRs, user?.uid]);

  const routines = useMemo(() => {
    if (!user?.uid || !rawRoutines) return [];
    return rawRoutines
      .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : null))
      .filter((r): r is Record<string, unknown> => Boolean(r))
      .map((r, i) => {
        const id = typeof r.id === "string" ? r.id : `${i}`;
        const name =
          (typeof r.name === "string" && r.name) ||
          (typeof r.title === "string" && r.title) ||
          "Routine";
        const exercisesCount = Array.isArray(r.exercises) ? r.exercises.length : undefined;
        return { id, name, exercisesCount };
      });
  }, [rawRoutines, user?.uid]);

  const todayNutrition = useMemo(() => (rawNutrition ? computeTodayNutrition(rawNutrition) : null), [rawNutrition]);

  const goals = useMemo<UserGoals | null>(() => {
    if (!rawGoals || typeof rawGoals !== "object") return null;
    const g = rawGoals as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    const weightUnit = g.weightUnit === "kg" ? "kg" : g.weightUnit === "lb" ? "lb" : undefined;
    return {
      weightGoal: num(g.weightGoal),
      weightUnit,
      caloriesGoal: num(g.caloriesGoal),
      proteinGoal: num(g.proteinGoal),
      carbsGoal: num(g.carbsGoal),
      fatGoal: num(g.fatGoal),
    };
  }, [rawGoals]);

  useEffect(() => {
    setGoalsForm({
      weightGoal: goals?.weightGoal,
      weightUnit: goals?.weightUnit ?? "lb",
      caloriesGoal: goals?.caloriesGoal,
      proteinGoal: goals?.proteinGoal,
      carbsGoal: goals?.carbsGoal,
      fatGoal: goals?.fatGoal,
    });
  }, [goals]);

  const notes = useMemo<NoteItem[]>(() => {
    if (!user?.uid || !rawNotes) return [];
    return rawNotes
      .map((n, i) => {
        if (!n || typeof n !== "object") return null;
        const obj = n as Record<string, unknown>;
        const id = typeof obj.id === "string" ? obj.id : `${i}`;
        const text = typeof obj.text === "string" ? obj.text : "";
        const d = parseWorkoutDate(obj.createdAt) || parseWorkoutDate(obj.date);
        const t = d ? d.getTime() : -1;
        if (!text) return null;
        return { id, text, t };
      })
      .filter((x): x is NoteItem => Boolean(x))
      .sort((a, b) => b.t - a.t);
  }, [rawNotes, user?.uid]);

  const liftSets = useMemo(() => (rawWorkouts ? extractLiftSets(rawWorkouts) : []), [rawWorkouts]);
  const topLifts = useMemo(() => computeTopLifts(liftSets), [liftSets]);

  const weekly = useMemo(() => {
    const days = weekDays();
    const daySet = new Set(workoutDates.map((d) => isoDate(d)));
    const todayId = isoDate(new Date());
    return days.map((d) => ({
      key: isoDate(d),
      label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
      day: d.getDate(),
      done: daySet.has(isoDate(d)),
      today: isoDate(d) === todayId,
    }));
  }, [workoutDates]);

  const workoutsTodayCount = useMemo(() => {
    const todayId = isoDate(new Date());
    return workoutDates.filter((d) => isoDate(d) === todayId).length;
  }, [workoutDates]);

  const weightChange7d = useMemo(() => {
    if (!rawBodyWeights) return null;
    const parsed = rawBodyWeights
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const obj = e as Record<string, unknown>;
        const w = typeof obj.weight === "number" ? obj.weight : null;
        const d = parseBodyWeightDate(obj.date) || parseBodyWeightDate(obj.createdAt);
        if (!d || w === null) return null;
        return { t: d.getTime(), w };
      })
      .filter((x): x is { t: number; w: number } => Boolean(x))
      .sort((a, b) => a.t - b.t);
    if (parsed.length < 2) return null;
    const latest = parsed[parsed.length - 1];
    const cutoff = latest.t - 7 * 24 * 60 * 60 * 1000;
    const start = parsed.find((p) => p.t >= cutoff) ?? parsed[0];
    return Math.round((latest.w - start.w) * 10) / 10;
  }, [rawBodyWeights]);

  const notifications = useMemo(() => {
    if (!user?.uid) return ["Sign in to see your dashboard notifications."];
    const items: string[] = [];

    const lastWorkout = workoutDates
      .slice()
      .sort((a, b) => b.getTime() - a.getTime())[0];
    if (!lastWorkout) items.push("No workouts logged yet. Start a session to begin your streak.");
    else {
      const daysAgo = Math.floor((Date.now() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 3) items.push(`It’s been ${daysAgo} days since your last workout.`);
    }

    const lastWeight = latestBodyWeight ? latestBodyWeight : null;
    if (!lastWeight) items.push("No body weight entries yet. Add one to start tracking trends.");

    const goalsCalories = goals?.caloriesGoal ?? todayNutrition?.caloriesGoal;
    if (goalsCalories && goalsCalories > 0 && todayNutrition) {
      const hour = new Date().getHours();
      const pct = todayNutrition.calories / goalsCalories;
      if (hour >= 18 && pct < 0.6) items.push("You’re under your calorie goal today.");
    }

    if (items.length === 0) items.push("All caught up. Keep it rolling.");
    return items.slice(0, 4);
  }, [goals?.caloriesGoal, latestBodyWeight, todayNutrition, user?.uid, workoutDates]);

  async function saveBodyWeight() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const v = Number(weightInput);
    if (!Number.isFinite(v) || v <= 0) {
      setWeightError("Enter a valid weight.");
      return;
    }

    setSavingWeight(true);
    setWeightError(null);
    try {
      await addBodyWeightEntry(db, user.uid, {
        weight: Math.round(v * 10) / 10,
        unit: "lb",
        date: new Date().toISOString(),
      });
      setWeightInput("");
    } catch (e) {
      setWeightError(e instanceof Error ? e.message : "Failed to save weight.");
    } finally {
      setSavingWeight(false);
    }
  }

  async function handleAddSection(type: HomeSection["type"]) {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    await addHomeSection(db, user.uid, type);
    setIsAddSectionOpen(false);
  }

  async function handleSetSections(next: Array<{ id: string; type: HomeSection["type"] }>) {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    await setHomeSections(
      db,
      user.uid,
      next.map((s) => ({ id: s.id, type: s.type })),
    );
  }

  function moveSection(id: string, direction: -1 | 1) {
    const idx = homeSections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= homeSections.length) return;
    const next = homeSections.slice();
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    void handleSetSections(next);
  }

  function removeSection(id: string) {
    const next = homeSections.filter((s) => s.id !== id);
    void handleSetSections(next);
  }

  async function addStarterLayout() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;

    const makeId = () => {
      if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
      return `hs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    };

    const types: HomeSection["type"][] = [
      "quickStats",
      "todaySnapshot",
      "weeklyPlan",
      "activeRoutinePicker",
      "heatmap",
      "bodyWeight",
      "progressTiles",
      "topLifts",
      "goals",
      "notifications",
      "recentNotes",
      "recentWorkouts",
    ];

    await setHomeSections(
      db,
      user.uid,
      types.map((type) => ({ id: makeId(), type, createdAt: new Date().toISOString() })),
    );
  }

  async function handleSavePR() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;

    const exercise = exercises.find((e) => e.id === prExerciseId);
    if (!exercise) {
      setPrError("Pick an exercise.");
      return;
    }

    const v = Number(prValue);
    if (!Number.isFinite(v) || v <= 0) {
      setPrError("Enter a valid PR value.");
      return;
    }

    setPrSaving(true);
    setPrError(null);
    try {
      await addPR(db, user.uid, {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        value: Math.round(v * 10) / 10,
        unit: prUnit,
        date: new Date().toISOString(),
      });
      setIsAddPROpen(false);
      setPrExerciseId("");
      setPrValue("");
    } catch (e) {
      setPrError(e instanceof Error ? e.message : "Failed to save PR.");
    } finally {
      setPrSaving(false);
    }
  }

  async function saveNote() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const text = noteText.trim();
    if (!text) return;

    setSavingNote(true);
    setNoteError(null);
    try {
      await addUserNote(db, user.uid, text);
      setNoteText("");
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function saveGoals() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;

    setSavingGoals(true);
    setGoalsError(null);
    try {
      const toNum = (v: unknown) => {
        if (v === "" || v === undefined || v === null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      };

      await setUserGoals(db, user.uid, {
        weightGoal: toNum(goalsForm.weightGoal),
        weightUnit: goalsForm.weightUnit ?? "lb",
        caloriesGoal: toNum(goalsForm.caloriesGoal),
        proteinGoal: toNum(goalsForm.proteinGoal),
        carbsGoal: toNum(goalsForm.carbsGoal),
        fatGoal: toNum(goalsForm.fatGoal),
      });
      setIsGoalsOpen(false);
    } catch (e) {
      setGoalsError(e instanceof Error ? e.message : "Failed to save goals.");
    } finally {
      setSavingGoals(false);
    }
  }

  function SectionFrame({
    section,
    index,
    title,
    icon,
    action,
    variant = "card",
    children,
  }: {
    section: { id: string; type: HomeSection["type"] };
    index: number;
    title: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    variant?: "card" | "plain";
    children: React.ReactNode;
  }) {
    const header = (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <p className="text-white font-bold">{title}</p>
        </div>
        {isCustomizingHome ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-2 rounded-xl bg-black/60 border border-neutral-800 hover:bg-black text-neutral-200 disabled:opacity-50"
              onClick={() => moveSection(section.id, -1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-2 rounded-xl bg-black/60 border border-neutral-800 hover:bg-black text-neutral-200 disabled:opacity-50"
              onClick={() => moveSection(section.id, 1)}
              disabled={index === homeSections.length - 1}
              aria-label="Move down"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-2 rounded-xl bg-rose-600/20 border border-rose-500/20 hover:bg-rose-600/30 text-rose-200"
              onClick={() => removeSection(section.id)}
              aria-label="Remove section"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          action ?? null
        )}
      </div>
    );

    if (variant === "plain") {
      return (
        <div className="bg-transparent">
          {header}
          {children}
        </div>
      );
    }

    return (
      <div className="bg-black rounded-2xl p-4 border border-neutral-800">
        {header}
        {children}
      </div>
    );
  }

  function renderHomeSection(section: { id: string; type: HomeSection["type"] }, index: number) {
    switch (section.type) {
      case "quickStats":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Quick stats"
            icon={<Flame className="w-4 h-4 text-orange-500" />}
            variant="plain"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                    Streak
                  </span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {streakDays} <span className="text-lg text-neutral-500 font-medium">days</span>
                </p>
              </div>
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <Dumbbell className="w-4 h-4 text-indigo-500" />
                  <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                    This Week
                  </span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {thisWeekCount} <span className="text-lg text-neutral-500 font-medium">w/o</span>
                </p>
              </div>
            </div>
          </SectionFrame>
        );

      case "todaySnapshot":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Today snapshot"
            icon={<CalendarDays className="w-4 h-4 text-indigo-400" />}
            action={
              <p className="text-xs text-neutral-500">
                {new Date().toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            }
          >
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to see your personalized snapshot and stats.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Workouts</p>
                  <p className="text-lg font-bold text-white">{workoutsTodayCount}</p>
                  <p className="text-[10px] text-neutral-500">Today</p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Calories</p>
                  <p className="text-lg font-bold text-white">
                    {todayNutrition ? Math.round(todayNutrition.calories) : "—"}
                  </p>
                  <p className="text-[10px] text-neutral-500">
                    {(() => {
                      const goal = goals?.caloriesGoal ?? todayNutrition?.caloriesGoal;
                      if (!goal) return "Goal —";
                      const pct = todayNutrition ? Math.round((todayNutrition.calories / goal) * 100) : 0;
                      return `${pct}% of goal`;
                    })()}
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Weight</p>
                  <p className="text-lg font-bold text-white">{latestBodyWeight ? latestBodyWeight.weight : "—"}</p>
                  <p className="text-[10px] text-neutral-500">{latestBodyWeight ? latestBodyWeight.unit : "lb"}</p>
                </div>
              </div>
            )}
          </SectionFrame>
        );

      case "weeklyPlan":
        return (
          <SectionFrame key={section.id} section={section} index={index} title="Weekly plan">
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to see your weekly overview.</p>
            ) : (
              <div className="flex gap-2">
                {weekly.map((d) => (
                  <div key={d.key} className="flex-1">
                    <div
                      className={`h-10 rounded-2xl border flex flex-col items-center justify-center ${
                        d.done
                          ? "bg-indigo-500/20 border-indigo-500/30 text-white"
                          : "bg-black/40 border-neutral-800 text-neutral-400"
                      } ${d.today ? "ring-1 ring-indigo-400/30" : ""}`}
                      title={d.key}
                    >
                      <p className="text-[10px] font-semibold">{d.label}</p>
                      <p className="text-xs font-bold">{d.day}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionFrame>
        );

      case "activeRoutinePicker":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Active routine picker"
            action={
              <Link href="/workout" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
                Browse
              </Link>
            }
          >
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to start from a saved routine.</p>
            ) : routines.length === 0 ? (
              <p className="text-xs text-neutral-500">No routines yet. Create one in the Workout tab.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {routines.slice(0, 12).map((r) => (
                  <Link
                    key={r.id}
                    href={`/workout/new?routineId=${encodeURIComponent(r.id)}`}
                    className="min-w-[220px] bg-black/60 border border-neutral-800 rounded-2xl p-4 hover:bg-black/80 transition-colors"
                  >
                    <p className="text-white font-semibold">{r.name}</p>
                    <p className="text-xs text-neutral-500">
                      {typeof r.exercisesCount === "number" ? `${r.exercisesCount} exercises` : "Routine"}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 text-indigo-300 text-sm font-semibold">
                      Start <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionFrame>
        );

      case "heatmap":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Workout heatmap"
            icon={<CalendarDays className="w-4 h-4 text-emerald-400" />}
            variant="plain"
          >
            <MonthHeatmap workedOut={workedOutThisMonth} />
          </SectionFrame>
        );

      case "bodyWeight":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Body weight"
            action={
              <Link href="/progress" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
                View
              </Link>
            }
          >
            <p className="text-xs text-neutral-500 mb-3">
              {latestBodyWeight
                ? `Current: ${latestBodyWeight.weight} ${latestBodyWeight.unit}`
                : user
                  ? "No entries yet"
                  : "Sign in to track"}
            </p>

            {!user ? (
              <p className="text-xs text-neutral-500">
                Go to{" "}
                <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
                  Profile
                </Link>{" "}
                to connect your account.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  inputMode="decimal"
                  placeholder="Enter weight (lb)"
                  className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
                <button
                  type="button"
                  onClick={() => void saveBodyWeight()}
                  disabled={savingWeight || !weightInput.trim()}
                  className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-white"
                >
                  {savingWeight ? "Saving..." : "Save"}
                </button>
              </div>
            )}
            {weightError ? <p className="text-xs text-rose-200 mt-2">{weightError}</p> : null}
          </SectionFrame>
        );

      case "progressTiles":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Progress tiles"
            icon={<LayoutDashboard className="w-4 h-4 text-neutral-300" />}
            variant="plain"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Weight (7d)
                </p>
                <p className="text-2xl font-bold text-white">
                  {weightChange7d === null ? "—" : `${weightChange7d > 0 ? "+" : ""}${weightChange7d}`}
                  <span className="text-sm font-semibold text-neutral-500"> lb</span>
                </p>
                <p className="text-xs text-neutral-500">Change</p>
              </div>
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Calories</p>
                <p className="text-2xl font-bold text-white">
                  {todayNutrition ? Math.round(todayNutrition.calories) : "—"}
                </p>
                <p className="text-xs text-neutral-500">
                  {(() => {
                    const goal = goals?.caloriesGoal ?? todayNutrition?.caloriesGoal;
                    if (!goal) return "Goal —";
                    const pct = todayNutrition ? Math.round((todayNutrition.calories / goal) * 100) : 0;
                    return `${pct}% of goal`;
                  })()}
                </p>
              </div>
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Workouts</p>
                <p className="text-2xl font-bold text-white">{thisWeekCount}</p>
                <p className="text-xs text-neutral-500">This week</p>
              </div>
              <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Streak</p>
                <p className="text-2xl font-bold text-white">{streakDays}</p>
                <p className="text-xs text-neutral-500">Days</p>
              </div>
            </div>
          </SectionFrame>
        );

      case "goals":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Goals"
            icon={<Target className="w-4 h-4 text-emerald-400" />}
            action={
              <button
                type="button"
                onClick={() => setIsGoalsOpen(true)}
                disabled={!user}
                className="text-indigo-400 text-sm font-medium hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </button>
            }
          >
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to save your goals.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Goal weight</p>
                  <p className="text-lg font-bold text-white">
                    {goals?.weightGoal ? Math.round(goals.weightGoal * 10) / 10 : "—"}{" "}
                    <span className="text-neutral-500 text-sm font-semibold">{goals?.weightUnit ?? "lb"}</span>
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Daily calories</p>
                  <p className="text-lg font-bold text-white">
                    {goals?.caloriesGoal ? Math.round(goals.caloriesGoal) : "—"}
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Protein</p>
                  <p className="text-lg font-bold text-white">
                    {goals?.proteinGoal ? Math.round(goals.proteinGoal) : "—"}{" "}
                    <span className="text-neutral-500 text-sm font-semibold">g</span>
                  </p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Carbs / Fat</p>
                  <p className="text-sm font-bold text-white">
                    {(goals?.carbsGoal ? Math.round(goals.carbsGoal) : "—") + "g"}{" "}
                    <span className="text-neutral-500 font-semibold">/</span>{" "}
                    {(goals?.fatGoal ? Math.round(goals.fatGoal) : "—") + "g"}
                  </p>
                </div>
              </div>
            )}
          </SectionFrame>
        );

      case "startWorkout":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Start workout"
            icon={<Plus className="w-4 h-4 text-indigo-400" />}
            variant="plain"
          >
            <Link
              href="/workout/new"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-between group shadow-lg shadow-indigo-900/20"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-bold text-white">Start Empty Workout</h2>
                  <p className="text-indigo-200 text-sm">Log as you go</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
            </Link>
          </SectionFrame>
        );

      case "recentWorkouts":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Recent workouts"
            icon={<Clock className="w-4 h-4 text-neutral-300" />}
            variant="plain"
            action={
              <Link href="/workout" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
                View All
              </Link>
            }
          >
            {!user ? (
              <div className="bg-black p-4 rounded-2xl border border-neutral-800">
                <p className="text-white font-semibold mb-1">Sign in to see your workouts</p>
                <p className="text-xs text-neutral-500">
                  Go to{" "}
                  <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
                    Profile
                  </Link>{" "}
                  to connect your account.
                </p>
              </div>
            ) : dashboardWorkouts.length === 0 ? (
              <div className="bg-black p-4 rounded-2xl border border-neutral-800">
                <p className="text-white font-semibold mb-1">No workouts yet</p>
                <p className="text-xs text-neutral-500">Start your first session to populate your heatmap.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardWorkouts.map((workout) => (
                  <div
                    key={workout.id}
                    className="bg-black p-4 rounded-2xl border border-neutral-800 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div>
                      <h4 className="text-white font-semibold mb-1">{workout.title}</h4>
                      <div className="flex items-center gap-3 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {workout.duration}
                        </span>
                        <span>•</span>
                        <span>{workout.date}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-white">{workout.volume.toLocaleString()} lb</p>
                      <p className="text-xs text-neutral-500">Volume</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionFrame>
        );

      case "topLifts":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Top lifts"
            icon={<Trophy className="w-4 h-4 text-amber-400" />}
            action={<p className="text-xs text-neutral-500">Auto from workouts</p>}
          >
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to see your top lifts.</p>
            ) : topLifts.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No lift data found in your workouts yet. Make sure your workouts include exercises + sets.
              </p>
            ) : (
              <div className="space-y-2">
                {topLifts.map((l) => (
                  <div
                    key={l.exerciseName}
                    className="bg-black/60 border border-neutral-800 rounded-2xl p-3 flex items-center justify-between"
                  >
                    <div className="pr-3">
                      <p className="text-white font-semibold text-sm">{l.exerciseName}</p>
                      <p className="text-xs text-neutral-500">
                        {l.best.weight} {l.best.unit} × {l.best.reps} • Est 1RM {Math.round(l.est1RM)}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500 whitespace-nowrap">
                      {new Date(l.best.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionFrame>
        );

      case "notifications":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Notifications"
            icon={<Bell className="w-4 h-4 text-indigo-400" />}
          >
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n} className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-sm text-neutral-200">{n}</p>
                </div>
              ))}
            </div>
          </SectionFrame>
        );

      case "recentNotes":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="Recent notes"
            icon={<NotebookPen className="w-4 h-4 text-emerald-400" />}
            action={<p className="text-xs text-neutral-500">{user ? `${notes.length} total` : ""}</p>}
          >
            {!user ? (
              <p className="text-xs text-neutral-500">Sign in to add notes.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Quick note (e.g., sleep was rough)"
                    className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => void saveNote()}
                    disabled={savingNote || !noteText.trim()}
                    className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-white"
                  >
                    {savingNote ? "Saving..." : "Add"}
                  </button>
                </div>
                {noteError ? <p className="text-xs text-rose-200 mb-2">{noteError}</p> : null}
                {notes.length === 0 ? (
                  <p className="text-xs text-neutral-500">No notes yet.</p>
                ) : (
                  <div className="space-y-2">
                    {notes.slice(0, 3).map((n) => (
                      <div key={n.id} className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                        <p className="text-sm text-neutral-200">{n.text}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {n.t > 0
                            ? new Date(n.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                            : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SectionFrame>
        );

      case "prs":
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title="PRs"
            icon={<Trophy className="w-4 h-4 text-amber-400" />}
            action={
              <button
                type="button"
                onClick={() => setIsAddPROpen(true)}
                className="text-indigo-400 text-sm font-medium hover:text-indigo-300"
              >
                Add PR
              </button>
            }
          >
            {prs.length === 0 ? (
              <p className="text-xs text-neutral-500">No PRs yet. Add one for an exercise.</p>
            ) : (
              <div className="space-y-2">
                {prs.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="bg-black/60 border border-neutral-800 rounded-2xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-semibold text-sm">{p.exerciseName}</p>
                      <p className="text-xs text-neutral-500">
                        {p.t > 0
                          ? new Date(p.t).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <p className="text-white font-bold">
                      {p.value} <span className="text-neutral-400 font-semibold">{p.unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionFrame>
        );

      default:
        return (
          <SectionFrame
            key={section.id}
            section={section}
            index={index}
            title={sectionTitle(section.type)}
            icon={<LayoutDashboard className="w-4 h-4 text-neutral-400" />}
          >
            <p className="text-xs text-neutral-500">Unsupported section.</p>
          </SectionFrame>
        );
    }
  }

  return (
    <AppShell>
      {user ? (
        <div className="pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-neutral-400" />
              <h2 className="text-white font-bold">Your Home</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomizingHome((v) => !v)}
                disabled={homeSections.length < 2}
                className="px-3 py-2 rounded-xl border border-neutral-800 bg-black hover:bg-white/5 text-white text-sm font-semibold"
              >
                {isCustomizingHome ? "Done" : "Reorder"}
              </button>
              <button
                type="button"
                onClick={() => setIsAddSectionOpen(true)}
                className="px-3 py-2 rounded-xl border border-neutral-800 bg-black hover:bg-white/5 text-white text-sm font-semibold"
              >
                Add widget
              </button>
            </div>
          </div>

          {homeSections.length === 0 ? (
            <div className="bg-black rounded-2xl p-4 border border-neutral-800">
              <p className="text-white font-semibold mb-1">No widgets yet</p>
              <p className="text-xs text-neutral-500 mb-4">
                Start with a full layout, or add widgets one by one.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void addStarterLayout()}
                  className="flex-1 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-bold text-white"
                >
                  Use starter layout
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddSectionOpen(true)}
                  className="flex-1 px-4 py-3 rounded-2xl border border-neutral-800 bg-black hover:bg-white/5 font-bold text-white"
                >
                  Add widgets
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">{homeSections.map((s, i) => renderHomeSection(s, i))}</div>
          )}
        </div>
      ) : (
        <>
      <section className="grid grid-cols-2 gap-4 mb-8 pt-2">
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
              Streak
            </span>
          </div>
          <p className="text-3xl font-bold text-white">
            {streakDays} <span className="text-lg text-neutral-500 font-medium">days</span>
          </p>
        </div>
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="w-4 h-4 text-indigo-500" />
            <span className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
              This Week
            </span>
          </div>
          <p className="text-3xl font-bold text-white">
            {thisWeekCount} <span className="text-lg text-neutral-500 font-medium">w/o</span>
          </p>
        </div>
      </section>

      <section className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <p className="text-white font-bold">Today snapshot</p>
          </div>
          <p className="text-xs text-neutral-500">
            {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </p>
        </div>

        {!user ? (
          <p className="text-xs text-neutral-500">
            Sign in to see your personalized snapshot and stats.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Workouts</p>
              <p className="text-lg font-bold text-white">{workoutsTodayCount}</p>
              <p className="text-[10px] text-neutral-500">Today</p>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Calories</p>
              <p className="text-lg font-bold text-white">
                {todayNutrition ? Math.round(todayNutrition.calories) : "—"}
              </p>
              <p className="text-[10px] text-neutral-500">
                {(() => {
                  const goal = goals?.caloriesGoal ?? todayNutrition?.caloriesGoal;
                  if (!goal) return "Goal —";
                  const pct = todayNutrition ? Math.round((todayNutrition.calories / goal) * 100) : 0;
                  return `${pct}% of goal`;
                })()}
              </p>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">Weight</p>
              <p className="text-lg font-bold text-white">{latestBodyWeight ? latestBodyWeight.weight : "—"}</p>
              <p className="text-[10px] text-neutral-500">{latestBodyWeight ? latestBodyWeight.unit : "lb"}</p>
            </div>
          </div>
        )}
      </section>

      <section className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-bold">Weekly plan</p>
          <p className="text-xs text-neutral-500">Completed</p>
        </div>

        {!user ? (
          <p className="text-xs text-neutral-500">Sign in to see your weekly overview.</p>
        ) : (
          <div className="flex gap-2">
            {weekly.map((d) => (
              <div key={d.key} className="flex-1">
                <div
                  className={`h-10 rounded-2xl border flex flex-col items-center justify-center ${
                    d.done
                      ? "bg-indigo-500/20 border-indigo-500/30 text-white"
                      : "bg-black/40 border-neutral-800 text-neutral-400"
                  } ${d.today ? "ring-1 ring-indigo-400/30" : ""}`}
                  title={d.key}
                >
                  <p className="text-[10px] font-semibold">{d.label}</p>
                  <p className="text-xs font-bold">{d.day}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-bold">Active routine picker</p>
          <Link href="/workout" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
            Browse
          </Link>
        </div>

        {!user ? (
          <p className="text-xs text-neutral-500">Sign in to start from a saved routine.</p>
        ) : routines.length === 0 ? (
          <p className="text-xs text-neutral-500">No routines yet. Create one in the Workout tab.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {routines.slice(0, 12).map((r) => (
              <Link
                key={r.id}
                href={`/workout/new?routineId=${encodeURIComponent(r.id)}`}
                className="min-w-[220px] bg-black/60 border border-neutral-800 rounded-2xl p-4 hover:bg-black/80 transition-colors"
              >
                <p className="text-white font-semibold">{r.name}</p>
                <p className="text-xs text-neutral-500">
                  {typeof r.exercisesCount === "number" ? `${r.exercisesCount} exercises` : "Routine"}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 text-indigo-300 text-sm font-semibold">
                  Start <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MonthHeatmap workedOut={workedOutThisMonth} />

      <section className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-white font-bold">Body weight</p>
            <p className="text-xs text-neutral-500">
              {latestBodyWeight
                ? `Current: ${latestBodyWeight.weight} ${latestBodyWeight.unit}`
                : user
                  ? "No entries yet"
                  : "Sign in to track"}
            </p>
          </div>
          <Link href="/progress" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
            View
          </Link>
        </div>

        {!user ? (
          <p className="text-xs text-neutral-500">
            Go to{" "}
            <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
              Profile
            </Link>{" "}
            to connect your account.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              inputMode="decimal"
              placeholder="Enter weight (lb)"
              className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
            />
            <button
              type="button"
              onClick={() => void saveBodyWeight()}
              disabled={savingWeight || !weightInput.trim()}
              className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-white"
            >
              {savingWeight ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {weightError ? <p className="text-xs text-rose-200 mt-2">{weightError}</p> : null}
      </section>

      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Weight (7d)</p>
          <p className="text-2xl font-bold text-white">
            {weightChange7d === null ? "—" : `${weightChange7d > 0 ? "+" : ""}${weightChange7d}`}
            <span className="text-sm font-semibold text-neutral-500"> lb</span>
          </p>
          <p className="text-xs text-neutral-500">Change</p>
        </div>
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Calories</p>
          <p className="text-2xl font-bold text-white">
            {todayNutrition ? Math.round(todayNutrition.calories) : "—"}
          </p>
          <p className="text-xs text-neutral-500">
            {(() => {
              const goal = goals?.caloriesGoal ?? todayNutrition?.caloriesGoal;
              if (!goal) return "Goal —";
              const pct = todayNutrition ? Math.round((todayNutrition.calories / goal) * 100) : 0;
              return `${pct}% of goal`;
            })()}
          </p>
        </div>
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Workouts</p>
          <p className="text-2xl font-bold text-white">{thisWeekCount}</p>
          <p className="text-xs text-neutral-500">This week</p>
        </div>
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">Streak</p>
          <p className="text-2xl font-bold text-white">{streakDays}</p>
          <p className="text-xs text-neutral-500">Days</p>
        </div>
      </section>

      <section className="bg-black rounded-2xl p-4 border border-neutral-800 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <p className="text-white font-bold">Goals</p>
          </div>
          <button
            type="button"
            onClick={() => setIsGoalsOpen(true)}
            disabled={!user}
            className="text-indigo-400 text-sm font-medium hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit
          </button>
        </div>

        {!user ? (
          <p className="text-xs text-neutral-500">Sign in to save your goals.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-xs text-neutral-500">Goal weight</p>
              <p className="text-lg font-bold text-white">
                {goals?.weightGoal ? Math.round(goals.weightGoal * 10) / 10 : "—"}{" "}
                <span className="text-neutral-500 text-sm font-semibold">{goals?.weightUnit ?? "lb"}</span>
              </p>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-xs text-neutral-500">Daily calories</p>
              <p className="text-lg font-bold text-white">
                {goals?.caloriesGoal ? Math.round(goals.caloriesGoal) : "—"}
              </p>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-xs text-neutral-500">Protein</p>
              <p className="text-lg font-bold text-white">
                {goals?.proteinGoal ? Math.round(goals.proteinGoal) : "—"}{" "}
                <span className="text-neutral-500 text-sm font-semibold">g</span>
              </p>
            </div>
            <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
              <p className="text-xs text-neutral-500">Carbs / Fat</p>
              <p className="text-sm font-bold text-white">
                {(goals?.carbsGoal ? Math.round(goals.carbsGoal) : "—") + "g"}{" "}
                <span className="text-neutral-500 font-semibold">/</span>{" "}
                {(goals?.fatGoal ? Math.round(goals.fatGoal) : "—") + "g"}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <Link
          href="/workout/new"
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-between group shadow-lg shadow-indigo-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-white">Start Empty Workout</h2>
              <p className="text-indigo-200 text-sm">Log as you go</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>

      <section>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-white">Recent Workouts</h3>
          <Link href="/workout" className="text-indigo-400 text-sm font-medium hover:text-indigo-300">
            View All
          </Link>
        </div>

        {!user ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to see your workouts</p>
            <p className="text-xs text-neutral-500">
              Go to{" "}
              <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
                Profile
              </Link>{" "}
              to connect your account.
            </p>
          </div>
        ) : dashboardWorkouts.length === 0 ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">No workouts yet</p>
            <p className="text-xs text-neutral-500">Start your first session to populate your heatmap.</p>
          </div>
      ) : (
          <div className="space-y-3">
            {dashboardWorkouts.map((workout) => (
              <div
                key={workout.id}
                className="bg-black p-4 rounded-2xl border border-neutral-800 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div>
                  <h4 className="text-white font-semibold mb-1">{workout.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {workout.duration}
                    </span>
                    <span>•</span>
                    <span>{workout.date}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{workout.volume.toLocaleString()} lb</p>
                  <p className="text-xs text-neutral-500">Volume</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 space-y-4">
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <p className="text-white font-bold">Top lifts</p>
            </div>
            <p className="text-xs text-neutral-500">Auto from workouts</p>
          </div>

          {!user ? (
            <p className="text-xs text-neutral-500">Sign in to see your top lifts.</p>
          ) : topLifts.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No lift data found in your workouts yet. Make sure your workouts include exercises + sets.
            </p>
          ) : (
            <div className="space-y-2">
              {topLifts.map((l) => (
                <div
                  key={l.exerciseName}
                  className="bg-black/60 border border-neutral-800 rounded-2xl p-3 flex items-center justify-between"
                >
                  <div className="pr-3">
                    <p className="text-white font-semibold text-sm">{l.exerciseName}</p>
                    <p className="text-xs text-neutral-500">
                      {l.best.weight} {l.best.unit} × {l.best.reps} • Est 1RM{" "}
                      {Math.round(l.est1RM)}
                    </p>
                  </div>
                  <p className="text-xs text-neutral-500 whitespace-nowrap">
                    {new Date(l.best.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-indigo-400" />
            <p className="text-white font-bold">Notifications</p>
          </div>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div key={n} className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                <p className="text-sm text-neutral-200">{n}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <NotebookPen className="w-4 h-4 text-emerald-400" />
              <p className="text-white font-bold">Recent notes</p>
            </div>
            <p className="text-xs text-neutral-500">{user ? `${notes.length} total` : ""}</p>
          </div>

          {!user ? (
            <p className="text-xs text-neutral-500">Sign in to add notes.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Quick note (e.g., sleep was rough)"
                  className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={savingNote || !noteText.trim()}
                  className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-white"
                >
                  {savingNote ? "Saving..." : "Add"}
                </button>
              </div>
              {noteError ? <p className="text-xs text-rose-200 mb-2">{noteError}</p> : null}
              {notes.length === 0 ? (
                <p className="text-xs text-neutral-500">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {notes.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className="bg-black/60 border border-neutral-800 rounded-2xl p-3"
                    >
                      <p className="text-sm text-neutral-200">{n.text}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {n.t > 0
                          ? new Date(n.t).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
        </>
      )}

      {isAddSectionOpen ? (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
            onClick={() => setIsAddSectionOpen(false)}
          />
          <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">Add widget</p>
              <button
                type="button"
                className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                onClick={() => setIsAddSectionOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => void handleAddSection("quickStats")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Flame className="w-5 h-5 text-orange-500" />
                  Quick stats
                </span>
                <span className="text-xs text-neutral-500">Streak + week</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("todaySnapshot")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  Today snapshot
                </span>
                <span className="text-xs text-neutral-500">Workouts, cals, weight</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("weeklyPlan")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <CalendarDays className="w-5 h-5 text-neutral-300" />
                  Weekly plan
                </span>
                <span className="text-xs text-neutral-500">Mon–Sun strip</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("activeRoutinePicker")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Dumbbell className="w-5 h-5 text-indigo-400" />
                  Routine picker
                </span>
                <span className="text-xs text-neutral-500">Start from routine</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("heatmap")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <CalendarDays className="w-5 h-5 text-emerald-400" />
                  Workout heatmap
                </span>
                <span className="text-xs text-neutral-500">This month</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("bodyWeight")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Body weight
                </span>
                <span className="text-xs text-neutral-500">Log weight</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("progressTiles")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <LayoutDashboard className="w-5 h-5 text-neutral-300" />
                  Progress tiles
                </span>
                <span className="text-xs text-neutral-500">Quick metrics</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("topLifts")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Top lifts
                </span>
                <span className="text-xs text-neutral-500">Auto from workouts</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("goals")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Target className="w-5 h-5 text-emerald-400" />
                  Goals
                </span>
                <span className="text-xs text-neutral-500">Weight + macros</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("notifications")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Bell className="w-5 h-5 text-indigo-400" />
                  Notifications
                </span>
                <span className="text-xs text-neutral-500">Smart nudges</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("recentNotes")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <NotebookPen className="w-5 h-5 text-emerald-400" />
                  Recent notes
                </span>
                <span className="text-xs text-neutral-500">Quick journal</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("recentWorkouts")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Clock className="w-5 h-5 text-neutral-300" />
                  Recent workouts
                </span>
                <span className="text-xs text-neutral-500">Latest sessions</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("startWorkout")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  Start workout CTA
                </span>
                <span className="text-xs text-neutral-500">Button</span>
              </button>

              <button
                type="button"
                onClick={() => void handleAddSection("prs")}
                className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-neutral-200 font-medium">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  PRs
                </span>
                <span className="text-xs text-neutral-500">Manual PRs</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddPROpen ? (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
            onClick={() => setIsAddPROpen(false)}
          />
          <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">Add PR</p>
              <button
                type="button"
                className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                onClick={() => setIsAddPROpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {prError ? (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-3 text-sm mb-4">
                {prError}
              </div>
            ) : null}

            <div className="space-y-3 mb-4">
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Exercise</p>
                <select
                  value={prExerciseId}
                  onChange={(e) => setPrExerciseId(e.target.value)}
                  className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white outline-none focus:border-indigo-500/60"
                >
                  <option value="">Select...</option>
                  {exercises.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">PR</p>
                  <input
                    value={prValue}
                    onChange={(e) => setPrValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="e.g., 225"
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Unit</p>
                  <select
                    value={prUnit}
                    onChange={(e) => setPrUnit(e.target.value === "kg" ? "kg" : "lb")}
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white outline-none focus:border-indigo-500/60"
                  >
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSavePR()}
              disabled={prSaving || !prExerciseId || !prValue.trim()}
              className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
            >
              {prSaving ? "Saving..." : "Save PR"}
            </button>
          </div>
        </div>
      ) : null}

      {isGoalsOpen ? (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
            onClick={() => setIsGoalsOpen(false)}
          />
          <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">Edit goals</p>
              <button
                type="button"
                className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                onClick={() => setIsGoalsOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {goalsError ? (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-3 text-sm mb-4">
                {goalsError}
              </div>
            ) : null}

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Goal weight</p>
                  <input
                    value={goalsForm.weightGoal ?? ""}
                    onChange={(e) =>
                      setGoalsForm((g) => ({
                        ...g,
                        weightGoal: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="e.g., 180"
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Unit</p>
                  <select
                    value={goalsForm.weightUnit ?? "lb"}
                    onChange={(e) =>
                      setGoalsForm((g) => ({ ...g, weightUnit: e.target.value === "kg" ? "kg" : "lb" }))
                    }
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white outline-none focus:border-indigo-500/60"
                  >
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Daily calories</p>
                <input
                  value={goalsForm.caloriesGoal ?? ""}
                  onChange={(e) =>
                    setGoalsForm((g) => ({
                      ...g,
                      caloriesGoal: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  inputMode="numeric"
                  placeholder="e.g., 2400"
                  className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Protein (g)</p>
                  <input
                    value={goalsForm.proteinGoal ?? ""}
                    onChange={(e) =>
                      setGoalsForm((g) => ({
                        ...g,
                        proteinGoal: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="200"
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Carbs (g)</p>
                  <input
                    value={goalsForm.carbsGoal ?? ""}
                    onChange={(e) =>
                      setGoalsForm((g) => ({
                        ...g,
                        carbsGoal: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="250"
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                </div>
                <div>
                  <p className="text-neutral-300 text-xs font-medium mb-1.5">Fat (g)</p>
                  <input
                    value={goalsForm.fatGoal ?? ""}
                    onChange={(e) =>
                      setGoalsForm((g) => ({
                        ...g,
                        fatGoal: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    inputMode="numeric"
                    placeholder="80"
                    className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void saveGoals()}
              disabled={savingGoals || !user}
              className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
            >
              {savingGoals ? "Saving..." : "Save goals"}
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}


