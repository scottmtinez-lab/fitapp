"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "../../_components/AppShell";
import { useAuth } from "../../../lib/auth/AuthProvider";
import { getClientDb } from "../../../lib/firebase/firestore";
import { createExercise, subscribeExercises } from "../../../lib/db/exercises";
import { subscribeUserRoutines } from "../../../lib/db/users";
import { addWorkoutForUser } from "../../../lib/db/workouts";
import type { Exercise, RoutineExerciseRef, WorkoutExerciseLog, WorkoutSet } from "../../../lib/db/types";

function NewWorkoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const routineId = searchParams.get("routineId");
  const startedAtParam = searchParams.get("startedAt");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseTrackingType, setNewExerciseTrackingType] = useState<Exercise["trackingType"]>("weight_reps");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerTouched, setExercisePickerTouched] = useState(false);
  const [title, setTitle] = useState("Workout");
  const [titleTouched, setTitleTouched] = useState(false);
  const [startedAt] = useState<number>(() => {
    const raw = startedAtParam ? Number(startedAtParam) : NaN;
    return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializedFromRoutine, setInitializedFromRoutine] = useState(false);
  const [setsByExerciseId, setSetsByExerciseId] = useState<Record<string, WorkoutSet[]>>({});
  const [activeRestTimer, setActiveRestTimer] = useState<{
    exerciseId: string;
    setIndex: number;
    secondsLeft: number;
    totalSeconds: number;
  } | null>(null);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(60);
  const [creatingExercise, setCreatingExercise] = useState(false);

  function getSetType(s: WorkoutSet) {
    return s.setType || "normal";
  }

  function getSetTypeClasses(setType: WorkoutSet["setType"]) {
    if (setType === "warmup") return "bg-amber-500/15 border-amber-500/40 text-amber-200";
    if (setType === "superset") return "bg-rose-500/15 border-rose-500/40 text-rose-200";
    return "bg-neutral-500/10 border-neutral-700 text-neutral-300";
  }

  useEffect(() => {
    const db = getClientDb();
    if (!db) return;
    return subscribeExercises(db, (items) => setExercises(items));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!activeRestTimer) return;
    if (activeRestTimer.secondsLeft <= 0) return;
    const t = setInterval(() => {
      setActiveRestTimer((prev) => {
        if (!prev) return null;
        const nextLeft = Math.max(0, prev.secondsLeft - 1);
        return { ...prev, secondsLeft: nextLeft };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeRestTimer]);

  useEffect(() => {
    if (!routineId) return;
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    return subscribeUserRoutines(db, user.uid, (items) => {
      if (initializedFromRoutine) return;
      const found = items.find((r) => {
        if (!r || typeof r !== "object") return false;
        return (r as Record<string, unknown>).id === routineId;
      });
      if (!found || typeof found !== "object") return;
      const obj = found as Record<string, unknown>;
      const rn = typeof obj.name === "string" ? obj.name : "";
      const re = obj.exercises;
      const refs: RoutineExerciseRef[] = Array.isArray(re)
        ? re
            .map((x) => {
              if (!x || typeof x !== "object") return null;
              const xo = x as Record<string, unknown>;
              const id = typeof xo.id === "string" ? xo.id : "";
              const name = typeof xo.name === "string" ? xo.name : "Exercise";
              if (!id) return null;
              return { id, name };
            })
            .filter((x): x is RoutineExerciseRef => Boolean(x))
        : [];

      if (!titleTouched) setTitle(rn || "Workout");
      setSelectedExerciseIds(refs.map((x) => x.id));
      setExercisePickerOpen(false);
      setInitializedFromRoutine(true);
    });
  }, [initializedFromRoutine, routineId, titleTouched, user?.uid]);

  useEffect(() => {
    if (routineId) return;
    if (exercisePickerTouched) return;
    if (selectedExerciseIds.length > 0) return;
    setExercisePickerOpen(true);
  }, [exercisePickerTouched, routineId, selectedExerciseIds.length]);

  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => {
      const haystack =
        `${e.name} ${e.bodyPart ?? ""} ${e.category ?? ""} ${e.muscleGroup ?? ""} ${e.equipment ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [exercises, query]);

  const selectedExerciseIdSet = useMemo(() => new Set(selectedExerciseIds), [selectedExerciseIds]);

  const elapsedMs = useMemo(() => Math.max(0, nowMs - startedAt), [nowMs, startedAt]);

  function formatElapsed(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const s = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const m = totalMinutes % 60;
    const h = Math.floor(totalMinutes / 60);
    const ss = String(s).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    if (h > 0) return `${h}:${mm}:${ss}`;
    return `${mm}:${ss}`;
  }

  function formatSeconds(sec: number) {
    const s = Math.max(0, Math.floor(sec));
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function toggleExercise(id: string) {
    setSelectedExerciseIds((prev) => {
      if (prev.includes(id)) return prev.filter((existingId) => existingId !== id);
      return [...prev, id];
    });
  }

  async function handleCreateExercise() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;

    const name = newExerciseName.trim();
    if (!name) return;

    const existing = exercises.find((exercise) => exercise.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      setSelectedExerciseIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]));
      setNewExerciseName("");
      setQuery("");
      return;
    }

    setCreatingExercise(true);
    setError(null);
    try {
      const docRef = await createExercise(db, {
        name,
        createdBy: user.uid,
        bodyPart: "Full Body",
        category: "Strength",
        trackingType: newExerciseTrackingType || "weight_reps",
      });
      setSelectedExerciseIds((prev) => (prev.includes(docRef.id) ? prev : [...prev, docRef.id]));
      setNewExerciseName("");
      setQuery("");
      setNewExerciseTrackingType("weight_reps");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create exercise.");
    } finally {
      setCreatingExercise(false);
    }
  }

  const selectedExercises = useMemo(() => {
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    return selectedExerciseIds
      .map((id) => byId.get(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));
  }, [exercises, selectedExerciseIds]);

  const totalVolume = useMemo(() => {
    let v = 0;
    for (const sets of Object.values(setsByExerciseId)) {
      for (const s of sets) {
        if (typeof s.weight === "number" && typeof s.reps === "number") v += s.weight * s.reps;
      }
    }
    return v;
  }, [setsByExerciseId]);

  function getTrackingType(e: Exercise) {
    return e.trackingType || "weight_reps";
  }

  function addSet(ex: Exercise) {
    const id = ex.id;
    const tt = getTrackingType(ex);

    const prevSets = setsByExerciseId[id] || [];
    const last = prevSets[prevSets.length - 1];

    let next: WorkoutSet;
    if (tt === "weight_reps") {
      next = {
        weight: typeof last?.weight === "number" ? last.weight : undefined,
        reps: typeof last?.reps === "number" ? last.reps : undefined,
        unit: last?.unit === "kg" ? "kg" : "lb",
      };
    } else if (tt === "reps") {
      next = { reps: typeof last?.reps === "number" ? last.reps : undefined };
    } else {
      next = { seconds: typeof last?.seconds === "number" ? last.seconds : undefined };
    }

    setSetsByExerciseId((prev) => ({ ...prev, [id]: [...(prev[id] || []), next] }));
  }

  function removeSet(exerciseId: string, index: number) {
    setSetsByExerciseId((prev) => {
      const current = prev[exerciseId] || [];
      const next = current.filter((_, i) => i !== index);
      return { ...prev, [exerciseId]: next };
    });
  }

  function removeExercise(exerciseId: string) {
    setSelectedExerciseIds((prev) => prev.filter((id) => id !== exerciseId));
    setSetsByExerciseId((prev) => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  }

  function moveExercise(exerciseId: string, direction: "up" | "down") {
    setSelectedExerciseIds((prev) => {
      const index = prev.indexOf(exerciseId);
      if (index === -1) return prev;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function updateSet(exerciseId: string, index: number, patch: Partial<WorkoutSet>) {
    setSetsByExerciseId((prev) => {
      const current = prev[exerciseId] || [];
      const next = current.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, [exerciseId]: next };
    });
  }

  function toggleSetCompleted(exerciseId: string, setIndex: number) {
    const sets = setsByExerciseId[exerciseId] || [];
    const s = sets[setIndex];
    if (!s) return;

    if (typeof s.completedAt === "number" && s.completedAt > 0) {
      updateSet(exerciseId, setIndex, { completedAt: undefined });
      return;
    }

    const restSeconds =
      typeof s.restSeconds === "number" && s.restSeconds > 0 ? s.restSeconds : defaultRestSeconds;
    const now = Date.now();
    updateSet(exerciseId, setIndex, { completedAt: now, restSeconds });
    setDefaultRestSeconds(restSeconds);
    setActiveRestTimer({ exerciseId, setIndex, secondsLeft: restSeconds, totalSeconds: restSeconds });
  }

  async function handleSaveWorkout() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const t = title.trim();
    if (!t) return;

    const selected: WorkoutExerciseLog[] = selectedExercises.map((e) => {
      const tt = getTrackingType(e);
      const sets = (setsByExerciseId[e.id] || []).filter((s) => {
        if (tt === "weight_reps") return typeof s.weight === "number" && typeof s.reps === "number";
        if (tt === "reps") return typeof s.reps === "number";
        return typeof s.seconds === "number";
      });

      return {
        id: e.id,
        name: e.name,
        trackingType: tt,
        sets,
      };
    });

    setSaving(true);
    setError(null);
    try {
      const completedAt = Date.now();
      const durationMinutes = Math.max(0, Math.round((completedAt - startedAt) / 60000));
      await addWorkoutForUser(db, user.uid, {
        title: t,
        routineId: routineId || undefined,
        exercises: selected,
        startedAt,
        completedAt,
        durationMinutes,
        volume: totalVolume,
      });
      router.push("/workout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save workout.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <AppShell title="New Workout">
        <section className="pt-2">
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to save workouts</p>
            <p className="text-xs text-neutral-500">Go to Profile to connect your account.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="New Workout">
      <section className="pt-2 space-y-4">
        {error ? (
          <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-4 text-sm">
            {error}
          </div>
        ) : null}

        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-neutral-300 text-sm font-medium">Workout name</p>
            <p className="text-xs text-neutral-500 tabular-nums">{formatElapsed(elapsedMs)}</p>
          </div>
          <input
            value={title}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
            className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
            placeholder="e.g., Upper Body Power"
          />
        </div>

        <div className="bg-black rounded-2xl p-4 border border-neutral-800 space-y-3">
          <button
            type="button"
            onClick={() => {
              setExercisePickerTouched(true);
              setExercisePickerOpen((v) => !v);
            }}
            className="w-full flex items-center justify-between"
            aria-expanded={exercisePickerOpen}
          >
            <div className="text-left">
              <p className="text-white font-bold">Exercises</p>
              <p className="text-xs text-neutral-500">{selectedExerciseIds.length} selected</p>
            </div>
            <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300">
              {exercisePickerOpen ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </div>
          </button>

          {exercisePickerOpen ? (
            <>
              <div className="bg-black rounded-2xl p-3 border border-neutral-800 flex items-center gap-2">
                <Search className="w-4 h-4 text-neutral-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-neutral-600"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="p-1 rounded-lg hover:bg-white/5 text-neutral-400"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : null}
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-black/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Create exercise</p>
                    <p className="text-xs text-neutral-500">Add one without leaving this workout.</p>
                  </div>
                  <div className="text-xs text-neutral-500">Quick add</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    value={newExerciseName}
                    onChange={(e) => setNewExerciseName(e.target.value)}
                    placeholder="Exercise name"
                    className="w-full min-w-0 flex-1 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2.5 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                  />
                  <select
                    value={newExerciseTrackingType || "weight_reps"}
                    onChange={(e) =>
                      setNewExerciseTrackingType(e.target.value as Exercise["trackingType"])
                    }
                    className="w-full min-w-0 sm:w-auto sm:min-w-[10rem] rounded-xl bg-black/70 border border-neutral-800 px-3 py-2.5 text-white outline-none focus:border-indigo-500/60"
                  >
                    <option value="weight_reps">Weight + reps</option>
                    <option value="reps">Reps</option>
                    <option value="time">Time</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCreateExercise()}
                    disabled={creatingExercise || !newExerciseName.trim()}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-xl px-4 py-2.5 font-bold text-white"
                  >
                    {creatingExercise ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto no-scrollbar space-y-2">
                {filteredExercises.length === 0 ? (
                  <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                    <p className="text-white font-semibold mb-1">No exercises found</p>
                    <p className="text-xs text-neutral-500">Use the create section above to add one.</p>
                  </div>
                ) : (
                  filteredExercises.slice(0, 60).map((e) => {
                    const selected = selectedExerciseIdSet.has(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => toggleExercise(e.id)}
                        className={`w-full rounded-2xl p-3 border flex items-center justify-between transition-colors ${
                          selected
                            ? "bg-indigo-500/10 border-indigo-500/40"
                            : "bg-black border-neutral-800 hover:bg-white/5"
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-white font-medium text-sm">{e.name}</p>
                          <p className="text-xs text-neutral-500">
                            {(e.bodyPart || e.muscleGroup || "—") +
                              " • " +
                              (e.category || "—") +
                              " • " +
                              (e.equipment || "—")}
                          </p>
                        </div>
                        <div
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                            selected
                              ? "bg-indigo-600 border-indigo-500/50 text-white"
                              : "bg-black/60 border-neutral-800 text-neutral-500"
                          }`}
                        >
                          <Check className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : null}
        </div>

        {selectedExercises.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                Tracking
              </p>
              <p className="text-xs text-neutral-500">Volume: {Math.round(totalVolume)}</p>
            </div>

            {selectedExercises.map((ex, exerciseIndex) => {
              const tt = getTrackingType(ex);
              const sets = setsByExerciseId[ex.id] || [];

              return (
                <div key={ex.id} className="bg-black rounded-2xl p-4 border border-neutral-800">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-white font-semibold">{ex.name}</p>
                      <p className="text-xs text-neutral-500">
                        {(ex.bodyPart || ex.muscleGroup || "—") +
                          " • " +
                          (ex.category || "—") +
                          " • " +
                          (tt === "weight_reps" ? "Weight + reps" : tt === "reps" ? "Reps" : "Time")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveExercise(ex.id, "up")}
                          disabled={exerciseIndex === 0}
                          className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Move ${ex.name} up`}
                          title="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExercise(ex.id, "down")}
                          disabled={exerciseIndex === selectedExercises.length - 1}
                          className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Move ${ex.name} down`}
                          title="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500">{sets.length} sets</p>
                      <button
                        type="button"
                        onClick={() => removeExercise(ex.id)}
                        className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40"
                        aria-label={`Remove ${ex.name}`}
                        title="Remove exercise"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    {sets.length ? (
                      sets.map((s, idx) => (
                        <div
                          key={`${ex.id}_${idx}`}
                          className="rounded-2xl border border-neutral-800 bg-black/60 p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-neutral-400 font-semibold">Set {idx + 1}</p>
                              <div className="flex items-center gap-1">
                                {[
                                  { key: "warmup" as const, label: "W" },
                                  { key: "superset" as const, label: "S" },
                                  { key: "normal" as const, label: "N" },
                                ].map((option) => {
                                  const active = getSetType(s) === option.key;
                                  return (
                                    <button
                                      key={option.key}
                                      type="button"
                                      onClick={() => updateSet(ex.id, idx, { setType: option.key })}
                                      className={`h-6 w-6 rounded-md border text-[11px] font-bold transition-colors ${
                                        active
                                          ? getSetTypeClasses(option.key)
                                          : "bg-black/40 border-neutral-800 text-neutral-500 hover:bg-white/5"
                                      }`}
                                      aria-label={`Mark set ${idx + 1} as ${option.key}`}
                                      title={
                                        option.key === "warmup"
                                          ? "Warm-up set"
                                          : option.key === "superset"
                                            ? "Superset"
                                            : "Normal set"
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleSetCompleted(ex.id, idx)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                                  typeof s.completedAt === "number" && s.completedAt > 0
                                    ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-200 hover:bg-emerald-600/25"
                                    : "bg-black/40 border-neutral-800 text-neutral-300 hover:bg-white/5"
                                }`}
                                aria-label={`Mark set ${idx + 1} complete`}
                                title="Complete set"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5" />
                                  Done
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSet(ex.id, idx)}
                                className="text-xs font-semibold text-rose-300 hover:text-rose-200 px-2 py-1 rounded-lg hover:bg-rose-500/10"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {tt === "weight_reps" ? (
                              <>
                                <input
                                  value={typeof s.weight === "number" ? String(s.weight) : ""}
                                  onChange={(e) =>
                                    updateSet(ex.id, idx, {
                                      weight: e.target.value.trim() ? Number(e.target.value) : undefined,
                                    })
                                  }
                                  inputMode="decimal"
                                  placeholder="Weight"
                                  className="w-24 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                                />
                                <select
                                  value={s.unit === "kg" ? "kg" : "lb"}
                                  onChange={(e) =>
                                    updateSet(ex.id, idx, { unit: e.target.value as "lb" | "kg" })
                                  }
                                  className="w-20 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2 text-white outline-none focus:border-indigo-500/60"
                                >
                                  <option value="lb">lb</option>
                                  <option value="kg">kg</option>
                                </select>
                                <input
                                  value={typeof s.reps === "number" ? String(s.reps) : ""}
                                  onChange={(e) =>
                                    updateSet(ex.id, idx, {
                                      reps: e.target.value.trim() ? Number(e.target.value) : undefined,
                                    })
                                  }
                                  inputMode="numeric"
                                  placeholder="Reps"
                                  className="w-20 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                                />
                              </>
                            ) : tt === "reps" ? (
                              <input
                                value={typeof s.reps === "number" ? String(s.reps) : ""}
                                onChange={(e) =>
                                  updateSet(ex.id, idx, {
                                    reps: e.target.value.trim() ? Number(e.target.value) : undefined,
                                  })
                                }
                                inputMode="numeric"
                                placeholder="Reps"
                                className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                              />
                            ) : (
                              <input
                                value={typeof s.seconds === "number" ? String(s.seconds) : ""}
                                onChange={(e) =>
                                  updateSet(ex.id, idx, {
                                    seconds: e.target.value.trim() ? Number(e.target.value) : undefined,
                                  })
                                }
                                inputMode="numeric"
                                placeholder="Seconds"
                                className="flex-1 rounded-xl bg-black/70 border border-neutral-800 px-3 py-2 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                              />
                            )}
                          </div>

                          {activeRestTimer?.exerciseId === ex.id && activeRestTimer.setIndex === idx ? (
                            <div className="mt-3 rounded-2xl border border-neutral-800 bg-black/80 p-3">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
                                    <Clock className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white">Rest</p>
                                    <p className="text-xs text-neutral-500">
                                      {activeRestTimer.secondsLeft === 0
                                        ? "Rest complete"
                                        : `${activeRestTimer.totalSeconds}s timer`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-2xl font-extrabold text-white tabular-nums">
                                  {formatSeconds(activeRestTimer.secondsLeft)}
                                </div>
                              </div>

                              <div className="flex gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveRestTimer((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            secondsLeft: prev.secondsLeft + 15,
                                            totalSeconds: prev.totalSeconds + 15,
                                          }
                                        : prev,
                                    )
                                  }
                                  className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-3 flex items-center justify-center gap-2 font-bold text-white border border-neutral-800"
                                >
                                  +15s
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveRestTimer(null)}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-3 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/20"
                                >
                                  Skip
                                </button>
                              </div>

                              <div className="flex gap-2">
                                {[30, 60, 90].map((seconds) => (
                                  <button
                                    key={seconds}
                                    type="button"
                                    onClick={() => {
                                      setDefaultRestSeconds(seconds);
                                      updateSet(ex.id, idx, { restSeconds: seconds });
                                      setActiveRestTimer((prev) =>
                                        prev
                                          ? { ...prev, secondsLeft: seconds, totalSeconds: seconds }
                                          : prev,
                                      );
                                    }}
                                    className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-3 flex items-center justify-center font-bold text-white border border-neutral-800"
                                  >
                                    {seconds}s
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-neutral-600">No sets yet</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => addSet(ex)}
                      aria-label="Add set"
                      className="shrink-0 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl px-4 py-2 font-bold text-white"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSaveWorkout}
          disabled={saving || !title.trim() || selectedExerciseIds.length === 0}
          className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : `Complete (${selectedExerciseIds.length})`}
        </button>

        <button
          type="button"
          onClick={() => router.push("/workout")}
          className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center font-bold text-white border border-neutral-800"
        >
          Cancel
        </button>
      </section>

    </AppShell>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense fallback={<main className="min-h-[100svh] bg-neutral-950" />}>
      <NewWorkoutContent />
    </Suspense>
  );
}


