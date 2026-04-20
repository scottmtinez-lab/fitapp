"use client";

import Link from "next/link";
import { Check, ChevronRight, Dumbbell, Play, Plus, Search, Trash2, X } from "lucide-react";
import AppShell from "../_components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import { subscribeUserRoutines } from "../../lib/db/users";
import { createExercise, subscribeExercises } from "../../lib/db/exercises";
import { createRoutineForUser, deleteRoutineForUser } from "../../lib/db/routines";
import type { Exercise, RoutineExerciseRef } from "../../lib/db/types";

type Routine = {
  id: string;
  name: string;
  description?: string;
  exercisesCount?: number;
};

function routineFromAny(raw: unknown, index: number): Routine | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = (typeof obj.id === "string" && obj.id) || `${index}`;
  const name =
    (typeof obj.name === "string" && obj.name) ||
    (typeof obj.title === "string" && obj.title) ||
    "Routine";

  const description = typeof obj.description === "string" ? obj.description : undefined;

  const exercises = obj.exercises;
  const exercisesCount = Array.isArray(exercises)
    ? exercises.length
    : typeof obj.exercisesCount === "number"
      ? obj.exercisesCount
      : undefined;

  return { id, name, description, exercisesCount };
}

export default function WorkoutPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rawRoutines, setRawRoutines] = useState<unknown[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exercisesQuery, setExercisesQuery] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [isCreatingRoutine, setIsCreatingRoutine] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineDescription, setRoutineDescription] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserRoutines(db, user.uid, (items) => setRawRoutines(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db) return;
    return subscribeExercises(db, (items) => setExercises(items));
  }, []);

  const routines = useMemo(() => {
    if (!rawRoutines) return [];
    return rawRoutines
      .map((r, i) => routineFromAny(r, i))
      .filter((x): x is Routine => Boolean(x));
  }, [rawRoutines]);

  const filteredExercises = useMemo(() => {
    const q = exercisesQuery.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => {
      const haystack =
        `${e.name} ${e.bodyPart ?? ""} ${e.category ?? ""} ${e.muscleGroup ?? ""} ${e.equipment ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [exercises, exercisesQuery]);

  function toggleExercise(id: string) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetRoutineForm() {
    setRoutineName("");
    setRoutineDescription("");
    setSelectedExerciseIds(new Set());
    setExercisesQuery("");
    setError(null);
  }

  async function handleCreateRoutine() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const name = routineName.trim();
    if (!name) return;

    const selected: RoutineExerciseRef[] = exercises
      .filter((e) => selectedExerciseIds.has(e.id))
      .map((e) => ({ id: e.id, name: e.name }));

    setSavingRoutine(true);
    setError(null);
    try {
      await createRoutineForUser(db, user.uid, {
        name,
        description: routineDescription.trim() || undefined,
        exercises: selected,
      });
      setIsCreatingRoutine(false);
      resetRoutineForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create routine.");
    } finally {
      setSavingRoutine(false);
    }
  }

  async function handleCreateExerciseFromModal() {
    const db = getClientDb();
    if (!db) return;
    const n = exercisesQuery.trim();
    if (!n) return;
    if (!user?.uid) return;

    setCreatingExercise(true);
    setError(null);
    try {
      const existing = exercises.find((e) => e.name.trim().toLowerCase() === n.toLowerCase());
      if (existing) {
        setSelectedExerciseIds((prev) => new Set(prev).add(existing.id));
        setExercisesQuery("");
        return;
      }

      const docRef = await createExercise(db, {
        name: n,
        createdBy: user.uid,
        bodyPart: "Full Body",
        category: "Strength",
        duration: "",
        trackingType: "weight_reps",
      });
      setSelectedExerciseIds((prev) => new Set(prev).add(docRef.id));
      setExercisesQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create exercise.");
    } finally {
      setCreatingExercise(false);
    }
  }

  async function performDeleteRoutine(id: string) {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;

    setDeletingRoutineId(id);
    setError(null);
    try {
      await deleteRoutineForUser(db, user.uid, id);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete routine.");
    } finally {
      setDeletingRoutineId(null);
    }
  }

  return (
    <AppShell title="Workout">
      <section className="pt-2 mb-6">
        <button
          type="button"
          onClick={() => router.push(`/workout/new?startedAt=${Date.now()}`)}
          className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-between group shadow-lg shadow-indigo-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-white">Start Workout</h2>
              <p className="text-indigo-200 text-sm">Create a new session</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
        </button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">All Workouts</h3>
          <button
            type="button"
            onClick={() => {
              resetRoutineForm();
              setIsCreatingRoutine(true);
            }}
            className="inline-flex items-center gap-2 bg-black hover:bg-white/5 transition-colors rounded-xl px-3 py-2 text-sm font-bold text-white border border-neutral-800"
          >
            <Plus className="w-4 h-4" /> Routine
          </button>
        </div>

        {!user ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to see your routines</p>
            <p className="text-xs text-neutral-500">
              Go to{" "}
              <Link href="/profile" className="text-indigo-300 hover:text-indigo-200">
                Profile
              </Link>{" "}
              to connect your account.
            </p>
          </div>
        ) : routines.length === 0 ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">No routines yet</p>
              <p className="text-xs text-neutral-500">
                Add routines to the <span className="font-medium">routines</span> array on your user
                doc.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
              <Dumbbell className="w-5 h-5" />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {routines.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/workout/routines/${encodeURIComponent(r.id)}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/workout/routines/${encodeURIComponent(r.id)}`);
                  }
                }}
                className="bg-black p-4 rounded-2xl border border-neutral-800 flex items-center justify-between cursor-pointer hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <div>
                  <p className="text-white font-semibold">{r.name}</p>
                  <p className="text-xs text-neutral-500">
                    {typeof r.exercisesCount === "number"
                      ? `${r.exercisesCount} exercises`
                      : r.description || "Routine"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete({ id: r.id, name: r.name });
                    }}
                    disabled={!user?.uid || deletingRoutineId === r.id}
                    className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label={`Delete ${r.name}`}
                    title="Delete routine"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/workout/new?routineId=${encodeURIComponent(r.id)}&startedAt=${Date.now()}`,
                      );
                    }}
                    className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300 hover:bg-white/5"
                    aria-label={`Start ${r.name}`}
                    title="Start workout"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {confirmDelete ? (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
            onClick={() => setConfirmDelete(null)}
          />

          <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold">Delete routine?</p>
              <button
                type="button"
                className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                onClick={() => setConfirmDelete(null)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-neutral-400 mb-5">
              This removes <span className="text-white font-semibold">{confirmDelete.name}</span>{" "}
              from your routines. This can’t be undone.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingRoutineId === confirmDelete.id}
                className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center font-bold text-white border border-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void performDeleteRoutine(confirmDelete.id)}
                disabled={deletingRoutineId === confirmDelete.id}
                className="flex-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-rose-900/20"
              >
                <Trash2 className="w-5 h-5" />
                {deletingRoutineId === confirmDelete.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreatingRoutine ? (
        <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
            onClick={() => setIsCreatingRoutine(false)}
          />

          <div className="relative w-full max-w-md bg-black border-t border-neutral-800 sm:border sm:rounded-2xl p-5 shadow-2xl drawer-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">Create routine</p>
              <button
                type="button"
                className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                onClick={() => setIsCreatingRoutine(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error ? (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-3 text-sm mb-4">
                {error}
              </div>
            ) : null}

            <div className="space-y-3 mb-4">
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Routine name</p>
                <input
                  value={routineName}
                  onChange={(e) => setRoutineName(e.target.value)}
                  placeholder="e.g., Push / Pull / Legs"
                  className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Description (optional)</p>
                <input
                  value={routineDescription}
                  onChange={(e) => setRoutineDescription(e.target.value)}
                  placeholder="e.g., Strength focus"
                  className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>
            </div>

            <div className="bg-black rounded-2xl p-3 border border-neutral-800 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                value={exercisesQuery}
                onChange={(e) => setExercisesQuery(e.target.value)}
                placeholder="Add exercises..."
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-neutral-600"
              />
              {exercisesQuery ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setExercisesQuery("")}
                    className="p-1 rounded-lg hover:bg-white/5 text-neutral-400"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleCreateExerciseFromModal}
              disabled={creatingExercise || !exercisesQuery.trim() || !user?.uid}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 bg-black hover:bg-white/5 transition-colors rounded-xl px-3 py-3 text-sm font-bold text-indigo-200 border border-neutral-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {creatingExercise ? "Creating..." : "Create exercise"}
            </button>

            <div className="max-h-52 overflow-y-auto no-scrollbar space-y-2 mb-4">
              {filteredExercises.length === 0 ? (
                <div className="bg-black rounded-2xl p-4 border border-neutral-800">
                  <p className="text-white font-semibold mb-1">No exercises found</p>
                  <p className="text-xs text-neutral-500">
                    Type a name above and hit <span className="font-medium">Create exercise</span>.
                  </p>
                </div>
              ) : (
                filteredExercises.slice(0, 40).map((e) => {
                  const selected = selectedExerciseIds.has(e.id);
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

            <button
              type="button"
              onClick={handleCreateRoutine}
              disabled={savingRoutine || !routineName.trim() || !user?.uid}
              className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-5 h-5" />
              {savingRoutine ? "Saving..." : `Save routine (${selectedExerciseIds.size})`}
            </button>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}


