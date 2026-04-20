"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  Clock,
  Dumbbell,
  LineChart,
  Plus,
  Settings,
  Target,
  Trash2,
  TrendingUp,
  Weight,
  X,
} from "lucide-react";
import AppShell from "../_components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import {
  subscribeUserBodyWeights,
  subscribeUserGoals,
  subscribeUserProgressSections,
  subscribeUserWorkouts,
} from "../../lib/db/users";
import { addBodyWeightEntry } from "../../lib/db/bodyWeight";
import { setProgressSections } from "../../lib/db/progressSections";
import type { ProgressSection } from "../../lib/db/types";

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDate(raw: unknown): Date | null {
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

type WeightPoint = { t: number; w: number; label: string };

function WeightChart({ points }: { points: WeightPoint[] }) {
  const width = 320;
  const height = 140;
  const padX = 14;
  const padY = 18;

  const minT = Math.min(...points.map((p) => p.t));
  const maxT = Math.max(...points.map((p) => p.t));
  const minW = Math.min(...points.map((p) => p.w));
  const maxW = Math.max(...points.map((p) => p.w));

  const tSpan = Math.max(maxT - minT, 1);
  const wSpan = Math.max(maxW - minW, 0.1);
  const wMin = minW - wSpan * 0.1;
  const wMax = maxW + wSpan * 0.1;

  const xFor = (t: number) => padX + ((t - minT) / tSpan) * (width - padX * 2);
  const yFor = (w: number) =>
    padY + ((wMax - w) / (wMax - wMin)) * (height - padY * 2);

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.t).toFixed(1)} ${yFor(p.w).toFixed(1)}`)
    .join(" ");

  const start = points[0];
  const end = points[points.length - 1];

  return (
    <div className="bg-black rounded-2xl p-4 border border-neutral-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Weight className="w-4 h-4 text-indigo-400" />
          <p className="text-white font-bold">Body weight</p>
        </div>
        <p className="text-xs text-neutral-500">{points.length} entries</p>
      </div>

      <div className="w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36"
          role="img"
          aria-label="Body weight over time"
        >
          <defs>
            <linearGradient id="bwLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgb(99, 102, 241)" stopOpacity="0.7" />
              <stop offset="1" stopColor="rgb(99, 102, 241)" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="bwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(99, 102, 241)" stopOpacity="0.25" />
              <stop offset="1" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d={`${d} L ${xFor(end.t).toFixed(1)} ${(height - padY).toFixed(1)} L ${xFor(
              start.t,
            ).toFixed(1)} ${(height - padY).toFixed(1)} Z`}
            fill="url(#bwFill)"
          />
          <path d={d} fill="none" stroke="url(#bwLine)" strokeWidth="3" strokeLinecap="round" />

          {points.map((p) => (
            <g key={p.t}>
              <circle cx={xFor(p.t)} cy={yFor(p.w)} r="3.5" fill="rgb(99, 102, 241)" />
              <title>
                {p.label}: {p.w} lb
              </title>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-xs text-neutral-500 mt-2">
        <span>
          {start.label} • {start.w} lb
        </span>
        <span>
          {end.label} • {end.w} lb
        </span>
      </div>
    </div>
  );
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
    const d = parseDate(c);
    if (d) return d;
  }
  return null;
}

function sectionMeta(type: ProgressSection["type"]) {
  switch (type) {
    case "consistency":
      return {
        title: "Consistency",
        icon: CalendarDays,
        blurb: "Workouts per week and streak",
      };
    case "volumeTrend":
      return { title: "Volume trend", icon: TrendingUp, blurb: "Weekly volume totals" };
    case "bodyWeight":
      return { title: "Body weight", icon: Weight, blurb: "Body weight over time" };
    case "topLifts":
      return { title: "Top lifts", icon: Dumbbell, blurb: "Estimated 1RM highlights" };
    case "exerciseProgress":
      return { title: "Exercise progress", icon: LineChart, blurb: "Pick an exercise to chart" };
    case "sessionDuration":
      return { title: "Session duration", icon: Clock, blurb: "Time spent training" };
    case "goalsSnapshot":
      return { title: "Goals", icon: Target, blurb: "Current targets and status" };
  }
}

function progressSectionFromAny(raw: unknown, index: number): ProgressSection | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = (typeof obj.id === "string" && obj.id) || `${index}`;
  const type = obj.type;
  const allowed: ProgressSection["type"][] = [
    "consistency",
    "volumeTrend",
    "bodyWeight",
    "topLifts",
    "exerciseProgress",
    "sessionDuration",
    "goalsSnapshot",
  ];
  if (typeof type !== "string" || !allowed.includes(type as ProgressSection["type"])) return null;
  const createdAt = typeof obj.createdAt === "string" ? obj.createdAt : undefined;
  return { id, type: type as ProgressSection["type"], createdAt };
}

function generateSectionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [rawBodyWeights, setRawBodyWeights] = useState<unknown[] | null>(null);
  const [rawWorkouts, setRawWorkouts] = useState<unknown[] | null>(null);
  const [rawGoals, setRawGoals] = useState<unknown | null>(null);
  const [rawProgressSections, setRawProgressSections] = useState<unknown[] | null>(null);

  const [editingLayout, setEditingLayout] = useState(false);
  const [draftSections, setDraftSections] = useState<ProgressSection[]>([]);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserBodyWeights(db, user.uid, (items) => setRawBodyWeights(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserWorkouts(db, user.uid, (items) => setRawWorkouts(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserGoals(db, user.uid, (g) => setRawGoals(g));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserProgressSections(db, user.uid, (items) => setRawProgressSections(items));
  }, [user?.uid]);

  const progressSections = useMemo<ProgressSection[]>(() => {
    if (!rawProgressSections) return [];
    return rawProgressSections
      .map((s, i) => progressSectionFromAny(s, i))
      .filter((x): x is ProgressSection => Boolean(x));
  }, [rawProgressSections]);

  const points = useMemo<WeightPoint[]>(() => {
    if (!rawBodyWeights) return [];
    const parsed = rawBodyWeights
      .map((e) => {
        if (!e || typeof e !== "object") return null;
        const obj = e as Record<string, unknown>;
        const w = typeof obj.weight === "number" ? obj.weight : null;
        const d = parseDate(obj.date) || parseDate(obj.createdAt);
        if (!d || w === null) return null;
        return { t: d.getTime(), w: Math.round(w * 10) / 10, label: isoDate(d) };
      })
      .filter((x): x is WeightPoint => Boolean(x))
      .sort((a, b) => a.t - b.t);
    return parsed.slice(-30);
  }, [rawBodyWeights]);

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
  const streakDays = useMemo(() => computeStreak(workoutDays), [workoutDays]);
  const thisWeekCount = useMemo(() => computeThisWeekCount(workoutDates), [workoutDates]);

  const weeklyVolume = useMemo(() => {
    if (!rawWorkouts) return 0;
    const now = new Date();
    const start = startOfWeek(now).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    let total = 0;
    for (const w of rawWorkouts) {
      if (!w || typeof w !== "object") continue;
      const obj = w as Record<string, unknown>;
      const d = getWorkoutDateFromAny(obj);
      if (!d) continue;
      const t = d.getTime();
      if (t < start || t >= end) continue;
      const v = obj.volume ?? obj.totalVolume ?? obj.tonnage;
      if (typeof v === "number" && Number.isFinite(v)) total += v;
    }
    return Math.round(total);
  }, [rawWorkouts]);

  const avgDuration = useMemo(() => {
    if (!rawWorkouts) return null;
    const mins: number[] = [];
    for (const w of rawWorkouts) {
      if (!w || typeof w !== "object") continue;
      const obj = w as Record<string, unknown>;
      const m = obj.durationMinutes ?? obj.minutes ?? obj.duration;
      if (typeof m === "number" && Number.isFinite(m) && m > 0) mins.push(m);
    }
    if (!mins.length) return null;
    const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
    return Math.round(avg);
  }, [rawWorkouts]);

  type TopLift = {
    name: string;
    est1RM: number;
    best: { weight: number; reps: number; unit: "lb" | "kg" };
  };

  const topLifts = useMemo<TopLift[]>(() => {
    if (!rawWorkouts) return [];
    const bestByExercise = new Map<string, TopLift>();

    for (const w of rawWorkouts) {
      if (!w || typeof w !== "object") continue;
      const workout = w as Record<string, unknown>;
      const exercisesRaw = Array.isArray(workout.exercises) ? workout.exercises : [];
      for (const ex of exercisesRaw) {
        if (!ex || typeof ex !== "object") continue;
        const exObj = ex as Record<string, unknown>;
        const name =
          (typeof exObj.name === "string" && exObj.name) ||
          (typeof exObj.exerciseName === "string" && exObj.exerciseName) ||
          "Exercise";

        const setsRaw = Array.isArray(exObj.sets) ? exObj.sets : [];
        for (const s of setsRaw) {
          if (!s || typeof s !== "object") continue;
          const set = s as Record<string, unknown>;
          const weight = typeof set.weight === "number" ? set.weight : null;
          const reps = typeof set.reps === "number" ? set.reps : null;
          if (!weight || !reps) continue;
          const unit: "lb" | "kg" = set.unit === "kg" ? "kg" : "lb";
          const est = weight * (1 + reps / 30);
          const key = name.trim().toLowerCase();
          const prev = bestByExercise.get(key);
          if (!prev || est > prev.est1RM) {
            bestByExercise.set(key, { name, est1RM: est, best: { weight, reps, unit } });
          }
        }
      }
    }

    return Array.from(bestByExercise.values())
      .filter((x) => x.est1RM > 0)
      .sort((a, b) => b.est1RM - a.est1RM)
      .slice(0, 6)
      .map((x) => ({ ...x, est1RM: Math.round(x.est1RM) }));
  }, [rawWorkouts]);

  async function saveWeight() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const v = Number(weightInput);
    if (!Number.isFinite(v) || v <= 0) {
      setError("Enter a valid weight.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addBodyWeightEntry(db, user.uid, {
        weight: Math.round(v * 10) / 10,
        unit: "lb",
        date: new Date().toISOString(),
      });
      setWeightInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save weight.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLayout(next: ProgressSection[]) {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    setSavingLayout(true);
    setLayoutError(null);
    try {
      await setProgressSections(db, user.uid, next);
      setEditingLayout(false);
    } catch (e) {
      setLayoutError(e instanceof Error ? e.message : "Failed to save layout.");
    } finally {
      setSavingLayout(false);
    }
  }

  const availableTypes: Array<ProgressSection["type"]> = [
    "consistency",
    "volumeTrend",
    "bodyWeight",
    "topLifts",
    "exerciseProgress",
    "sessionDuration",
    "goalsSnapshot",
  ];

  function openEditor() {
    setDraftSections(progressSections);
    setLayoutError(null);
    setEditingLayout(true);
  }

  function addSectionToDraft(type: ProgressSection["type"]) {
    if (draftSections.some((s) => s.type === type)) return;
    setDraftSections((prev) => [
      ...prev,
      { id: generateSectionId(), type, createdAt: new Date().toISOString() },
    ]);
  }

  function moveDraft(index: number, dir: -1 | 1) {
    setDraftSections((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  function removeDraft(index: number) {
    setDraftSections((prev) => prev.filter((_, i) => i !== index));
  }

  const recommendedLayout: ProgressSection[] = useMemo(
    () => [
      { id: generateSectionId(), type: "consistency", createdAt: new Date().toISOString() },
      { id: generateSectionId(), type: "volumeTrend", createdAt: new Date().toISOString() },
      { id: generateSectionId(), type: "topLifts", createdAt: new Date().toISOString() },
      { id: generateSectionId(), type: "bodyWeight", createdAt: new Date().toISOString() },
      { id: generateSectionId(), type: "sessionDuration", createdAt: new Date().toISOString() },
      { id: generateSectionId(), type: "goalsSnapshot", createdAt: new Date().toISOString() },
    ],
    [],
  );

  function renderSection(type: ProgressSection["type"]) {
    if (type === "consistency") {
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <p className="text-white font-bold">Consistency</p>
            </div>
            <p className="text-xs text-neutral-500">Workouts per week</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-neutral-800 bg-black/60 p-4">
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1">
                This week
              </p>
              <p className="text-2xl font-bold text-white">{thisWeekCount}</p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-black/60 p-4">
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1">
                Streak
              </p>
              <p className="text-2xl font-bold text-white">{streakDays}</p>
            </div>
          </div>
          {!rawWorkouts ? <p className="text-xs text-neutral-600 mt-3">Loading workouts…</p> : null}
        </div>
      );
    }

    if (type === "volumeTrend") {
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-white font-bold">Volume trend</p>
            </div>
            <p className="text-xs text-neutral-500">This week</p>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-extrabold text-white tabular-nums">{weeklyVolume}</p>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              volume
            </div>
          </div>
          <p className="text-xs text-neutral-600 mt-2">Based on your saved workout volume totals.</p>
        </div>
      );
    }

    if (type === "topLifts") {
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-indigo-400" />
              <p className="text-white font-bold">Top lifts</p>
            </div>
            <p className="text-xs text-neutral-500">Est 1RM</p>
          </div>
          {topLifts.length === 0 ? (
            <p className="text-xs text-neutral-600">
              Complete a workout with weight + reps sets to see top lifts.
            </p>
          ) : (
            <div className="space-y-2">
              {topLifts.map((l) => (
                <div
                  key={l.name}
                  className="rounded-2xl border border-neutral-800 bg-black/60 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white font-semibold text-sm">{l.name}</p>
                    <p className="text-xs text-neutral-500">
                      Best set: {l.best.weight}
                      {l.best.unit} × {l.best.reps}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                      Est 1RM
                    </p>
                    <p className="text-white font-extrabold tabular-nums">{l.est1RM}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === "sessionDuration") {
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <p className="text-white font-bold">Session duration</p>
            </div>
            <p className="text-xs text-neutral-500">Average</p>
          </div>
          <p className="text-3xl font-extrabold text-white tabular-nums">
            {avgDuration === null ? "—" : `${avgDuration}m`}
          </p>
          <p className="text-xs text-neutral-600 mt-2">Based on workouts that have a duration.</p>
        </div>
      );
    }

    if (type === "goalsSnapshot") {
      const goals = rawGoals && typeof rawGoals === "object" ? (rawGoals as Record<string, unknown>) : null;
      const weightGoal = goals && typeof goals.weightGoal === "number" ? goals.weightGoal : null;
      const weightUnit =
        goals && (goals.weightUnit === "kg" || goals.weightUnit === "lb")
          ? (goals.weightUnit as "kg" | "lb")
          : "lb";
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <p className="text-white font-bold">Goals</p>
            </div>
            <p className="text-xs text-neutral-500">Snapshot</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-black/60 p-4">
            <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-1">
              Body weight goal
            </p>
            <p className="text-white font-extrabold text-2xl tabular-nums">
              {weightGoal === null ? "—" : `${weightGoal} ${weightUnit}`}
            </p>
            <p className="text-xs text-neutral-600 mt-2">Set goals in Profile.</p>
          </div>
        </div>
      );
    }

    if (type === "exerciseProgress") {
      return (
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LineChart className="w-4 h-4 text-indigo-400" />
              <p className="text-white font-bold">Exercise progress</p>
            </div>
            <p className="text-xs text-neutral-500">Coming soon</p>
          </div>
          <p className="text-xs text-neutral-600">
            Next: choose an exercise and chart best set over time.
          </p>
        </div>
      );
    }

    // bodyWeight
    return (
      <div className="space-y-4">
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <p className="text-white font-bold mb-2">Add today&apos;s weight</p>
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
              onClick={() => void saveWeight()}
              disabled={saving || !weightInput.trim()}
              className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-white"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {error ? <p className="text-xs text-rose-200 mt-2">{error}</p> : null}
        </div>

        {points.length < 2 ? (
          <div className="bg-black rounded-2xl p-4 border border-neutral-800">
            <p className="text-white font-bold mb-1">Body weight chart</p>
            <p className="text-xs text-neutral-500">Add at least 2 entries to see a graph.</p>
          </div>
        ) : (
          <WeightChart points={points} />
        )}
      </div>
    );
  }

  return (
    <AppShell title="Progress">
      {!user ? (
        <div className="bg-black p-4 rounded-2xl border border-neutral-800">
          <p className="text-white font-semibold mb-1">Sign in to see progress</p>
          <p className="text-xs text-neutral-500">
            Go to{" "}
            <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
              Profile
            </Link>{" "}
            to connect your account.
          </p>
        </div>
      ) : (
        <>
          <section className="pt-2 flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-neutral-400">
              <BarChart3 className="w-4 h-4" />
              <p className="text-xs font-semibold uppercase tracking-wider">Your layout</p>
            </div>
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-2 bg-black hover:bg-white/5 transition-colors rounded-xl px-3 py-2 text-sm font-bold text-white border border-neutral-800"
            >
              <Settings className="w-4 h-4" /> Edit layout
            </button>
          </section>

          {progressSections.length === 0 ? (
            <div className="bg-black rounded-2xl p-4 border border-neutral-800">
              <p className="text-white font-bold mb-1">Build your Progress tab</p>
              <p className="text-xs text-neutral-500 mb-3">
                Pick the sections you want, then reorder them.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveLayout(recommendedLayout)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
                >
                  <Check className="w-5 h-5" />
                  Use recommended
                </button>
                <button
                  type="button"
                  onClick={openEditor}
                  className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white border border-neutral-800"
                >
                  <Plus className="w-5 h-5" />
                  Customize
                </button>
              </div>
            </div>
          ) : (
            <section className="space-y-4">
              {progressSections.map((s) => (
                <div key={s.id}>{renderSection(s.type)}</div>
              ))}
            </section>
          )}

          {editingLayout ? (
            <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
                onClick={() => setEditingLayout(false)}
              />

              <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-bold">Edit layout</p>
                  <button
                    type="button"
                    className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                    onClick={() => setEditingLayout(false)}
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {layoutError ? (
                  <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-3 text-sm mb-4">
                    {layoutError}
                  </div>
                ) : null}

                <div className="space-y-2 mb-4">
                  {draftSections.length === 0 ? (
                    <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                      <p className="text-white font-semibold mb-1">No sections yet</p>
                      <p className="text-xs text-neutral-500">Add a section below.</p>
                    </div>
                  ) : (
                    draftSections.map((s, i) => {
                      const meta = sectionMeta(s.type);
                      const Icon = meta.icon;
                      return (
                        <div
                          key={s.id}
                          className="bg-black p-3 rounded-2xl border border-neutral-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{meta.title}</p>
                              <p className="text-xs text-neutral-500">{meta.blurb}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveDraft(i, -1)}
                              className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300 hover:bg-white/5 disabled:opacity-50"
                              aria-label="Move up"
                              disabled={i === 0}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveDraft(i, 1)}
                              className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300 hover:bg-white/5 disabled:opacity-50"
                              aria-label="Move down"
                              disabled={i === draftSections.length - 1}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDraft(i)}
                              className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40"
                              aria-label="Remove section"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">
                    Add section
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTypes.map((t) => {
                      const meta = sectionMeta(t);
                      const Icon = meta.icon;
                      const disabled = draftSections.some((s) => s.type === t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addSectionToDraft(t)}
                          disabled={disabled}
                          className="bg-black rounded-2xl border border-neutral-800 p-3 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-semibold text-sm">{meta.title}</p>
                            <p className="text-xs text-neutral-500">Add</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLayout(false)}
                    disabled={savingLayout}
                    className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center font-bold text-white border border-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveLayout(draftSections)}
                    disabled={savingLayout}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
                  >
                    <Check className="w-5 h-5" />
                    {savingLayout ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}


