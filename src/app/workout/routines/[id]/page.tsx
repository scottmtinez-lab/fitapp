"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import AppShell from "../../../_components/AppShell";
import { useAuth } from "../../../../lib/auth/AuthProvider";
import { getClientDb } from "../../../../lib/firebase/firestore";
import { subscribeUserRoutines } from "../../../../lib/db/users";
import { subscribeExercises } from "../../../../lib/db/exercises";
import { updateRoutineForUser } from "../../../../lib/db/routines";
import type { Exercise, RoutineExerciseRef } from "../../../../lib/db/types";

type RoutineDetail = {
  id: string;
  name: string;
  description: string;
  exercises: RoutineExerciseRef[];
};

function routineDetailFromAny(raw: unknown, fallbackId: string): RoutineDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" && obj.id ? obj.id : fallbackId;
  const name = typeof obj.name === "string" ? obj.name : "Routine";
  const description = typeof obj.description === "string" ? obj.description : "";
  const exercisesRaw = obj.exercises;
  const exercises: RoutineExerciseRef[] = Array.isArray(exercisesRaw)
    ? exercisesRaw
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const xo = x as Record<string, unknown>;
          const exId = typeof xo.id === "string" ? xo.id : "";
          const exName = typeof xo.name === "string" ? xo.name : "Exercise";
          if (!exId) return null;
          return { id: exId, name: exName };
        })
        .filter((x): x is RoutineExerciseRef => Boolean(x))
    : [];

  return { id, name, description, exercises };
}

export default function EditRoutinePage() {
  const params = useParams<{ id: string }>();
  const routineId = useMemo(() => {
    const raw = params?.id;
    if (typeof raw !== "string") return "";
    return decodeURIComponent(raw);
  }, [params?.id]);
  const router = useRouter();
  const { user } = useAuth();

  const [rawRoutines, setRawRoutines] = useState<unknown[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const routine = useMemo(() => {
    if (!rawRoutines) return null;
    const found = rawRoutines.find((r) => {
      if (!r || typeof r !== "object") return false;
      return (r as Record<string, unknown>).id === routineId;
    });
    return routineDetailFromAny(found, routineId);
  }, [rawRoutines, routineId]);

  useEffect(() => {
    if (!routine || initialized) return;
    setName(routine.name);
    setDescription(routine.description);
    setSelectedExerciseIds(new Set(routine.exercises.map((e) => e.id)));
    setInitialized(true);
  }, [initialized, routine]);

  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((e) => {
      const haystack =
        `${e.name} ${e.bodyPart ?? ""} ${e.category ?? ""} ${e.muscleGroup ?? ""} ${e.equipment ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [exercises, query]);

  function toggleExercise(id: string) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!user?.uid) return;
    const db = getClientDb();
    if (!db) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const idToName = new Map<string, string>();
    for (const e of exercises) idToName.set(e.id, e.name);
    for (const re of routine?.exercises ?? []) idToName.set(re.id, re.name);

    const selected: RoutineExerciseRef[] = Array.from(selectedExerciseIds).map((id) => ({
      id,
      name: idToName.get(id) || "Exercise",
    }));

    setSaving(true);
    setError(null);
    try {
      await updateRoutineForUser(db, user.uid, routineId, {
        name: trimmed,
        description: description.trim() || undefined,
        exercises: selected,
      });
      router.push("/workout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save routine.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <AppShell title="Edit Routine">
        <section className="pt-2">
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to edit routines</p>
            <p className="text-xs text-neutral-500">Go to Profile to connect your account.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (rawRoutines && !routine) {
    return (
      <AppShell title="Edit Routine">
        <section className="pt-2">
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Routine not found</p>
            <button
              type="button"
              onClick={() => router.push("/workout")}
              className="mt-2 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-xl px-3 py-2 text-sm font-bold text-white"
            >
              Back
            </button>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Edit Routine">
      <section className="pt-2 space-y-4">
        {error ? (
          <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="bg-black rounded-2xl p-4 border border-neutral-800 space-y-3">
          <div>
            <p className="text-neutral-300 text-xs font-medium mb-1.5">Routine name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Push / Pull / Legs"
              className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
            />
          </div>
          <div>
            <p className="text-neutral-300 text-xs font-medium mb-1.5">Description (optional)</p>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Strength focus"
              className="w-full rounded-xl bg-black border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
            />
          </div>
        </div>

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

        <div className="max-h-[55vh] overflow-y-auto no-scrollbar space-y-2">
          {filteredExercises.slice(0, 80).map((e) => {
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
          })}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/workout")}
            className="flex-1 bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white border border-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-[2] bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
          >
            <Plus className="w-5 h-5" />
            {saving ? "Saving..." : `Save routine (${selectedExerciseIds.size})`}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
