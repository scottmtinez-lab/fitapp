"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Dumbbell, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import AppShell from "../_components/AppShell";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import { createExercise, deleteExercise, subscribeExercises, updateExercise } from "../../lib/db/exercises";
import type { Exercise } from "../../lib/db/types";

export default function ExercisesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [trackingType, setTrackingType] = useState<"time" | "reps" | "weight_reps">("weight_reps");
  const [equipment, setEquipment] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [editName, setEditName] = useState("");
  const [editBodyPart, setEditBodyPart] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editTrackingType, setEditTrackingType] = useState<"time" | "reps" | "weight_reps">("weight_reps");
  const [editEquipment, setEditEquipment] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  useEffect(() => {
    const db = getClientDb();
    if (!db) return;
    return subscribeExercises(
      db,
      (next) => {
        setItems(next);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load exercises.");
      },
    );
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => {
      const haystack =
        `${e.name} ${e.bodyPart ?? ""} ${e.category ?? ""} ${e.muscleGroup ?? ""} ${e.equipment ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const db = getClientDb();
    if (!db) return;

    setSaving(true);
    setError(null);
    try {
      const bp = bodyPart.trim() || undefined;
      await createExercise(db, {
        name: trimmed,
        bodyPart: bp,
        category: category.trim() || undefined,
        duration: duration.trim() || undefined,
        trackingType,
        muscleGroup: bp,
        equipment: equipment.trim() || undefined,
        createdBy: user?.uid,
      });
      setName("");
      setBodyPart("");
      setCategory("");
      setDuration("");
      setTrackingType("weight_reps");
      setEquipment("");
      setIsAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create exercise.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(exercise: Exercise) {
    setEditing(exercise);
    setEditName(exercise.name || "");
    setEditBodyPart(exercise.bodyPart || exercise.muscleGroup || "");
    setEditCategory(exercise.category || "");
    setEditDuration(exercise.duration || "");
    setEditTrackingType(exercise.trackingType || "weight_reps");
    setEditEquipment(exercise.equipment || "");
    setError(null);
  }

  function closeEdit() {
    setEditing(null);
    setSavingEdit(false);
    setDeletingExerciseId(null);
    setError(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    const db = getClientDb();
    if (!db) return;

    const n = editName.trim();
    if (!n) return;

    setSavingEdit(true);
    setError(null);
    try {
      const bp = editBodyPart.trim() || "Full Body";
      await updateExercise(db, editing.id, {
        name: n,
        bodyPart: bp,
        muscleGroup: bp,
        category: editCategory.trim() || "Strength",
        duration: editDuration.trim(),
        trackingType: editTrackingType,
        equipment: editEquipment.trim(),
      });
      closeEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update exercise.");
      setSavingEdit(false);
    }
  }

  async function handleDeleteExercise(exercise: Exercise) {
    const db = getClientDb();
    if (!db) return;

    setDeletingExerciseId(exercise.id);
    setError(null);
    try {
      await deleteExercise(db, exercise.id);
      if (editing?.id === exercise.id) closeEdit();
      else setDeletingExerciseId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete exercise.");
      setDeletingExerciseId(null);
    }
  }

  return (
    <AppShell title="Exercises">
      <section className="pt-2 space-y-4">
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

        {error ? (
          <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-4 text-sm">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
            {filtered.length} exercises
          </p>
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-xl px-3 py-2 text-sm font-bold text-white"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {isAdding ? (
          <div className="bg-black rounded-2xl p-4 border border-neutral-800 space-y-3">
            <div>
              <p className="text-neutral-300 text-xs font-medium mb-1.5">Name</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Barbell Bench Press"
                className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Body part</p>
                <input
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  placeholder="Full Body"
                  className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Equipment</p>
                <input
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                  placeholder="Barbell"
                  className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Category</p>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Strength"
                  className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <p className="text-neutral-300 text-xs font-medium mb-1.5">Tracking</p>
                <select
                  value={trackingType}
                  onChange={(e) =>
                    setTrackingType(e.target.value as "time" | "reps" | "weight_reps")
                  }
                  className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white outline-none focus:border-indigo-500/60"
                >
                  <option value="weight_reps">Weight + reps</option>
                  <option value="reps">Reps</option>
                  <option value="time">Time</option>
                </select>
              </div>
            </div>
            <div>
              <p className="text-neutral-300 text-xs font-medium mb-1.5">Duration (optional)</p>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder={trackingType === "time" ? "e.g., 00:10:00" : "Leave blank"}
                className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
            >
              <Check className="w-5 h-5" />
              {saving ? "Saving..." : "Save Exercise"}
            </button>
          </div>
        ) : null}

        <div className="space-y-3">
          {filtered.map((exercise) => (
            <div key={exercise.id} className="bg-black p-4 rounded-2xl border border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold">{exercise.name}</p>
                  <p className="text-xs text-neutral-500">
                    {(exercise.bodyPart || exercise.muscleGroup || "—") +
                      " • " +
                      (exercise.category || "—") +
                      " • " +
                      (exercise.equipment || "—")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(exercise)}
                    className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-neutral-300 hover:bg-white/5"
                    aria-label={`Edit ${exercise.name}`}
                    title="Edit"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {editing?.id === exercise.id ? (
                <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/70 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-bold">Edit exercise</p>
                    <button
                      type="button"
                      className="p-2 bg-black rounded-full hover:bg-white/5 text-neutral-200 border border-neutral-800"
                      onClick={closeEdit}
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
                      <p className="text-neutral-300 text-xs font-medium mb-1.5">Name</p>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                        placeholder="Exercise name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-neutral-300 text-xs font-medium mb-1.5">Body part</p>
                        <input
                          value={editBodyPart}
                          onChange={(e) => setEditBodyPart(e.target.value)}
                          placeholder="Full Body"
                          className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                        />
                      </div>
                      <div>
                        <p className="text-neutral-300 text-xs font-medium mb-1.5">Equipment</p>
                        <input
                          value={editEquipment}
                          onChange={(e) => setEditEquipment(e.target.value)}
                          placeholder="Barbell"
                          className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-neutral-300 text-xs font-medium mb-1.5">Category</p>
                        <input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          placeholder="Strength"
                          className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                        />
                      </div>
                      <div>
                        <p className="text-neutral-300 text-xs font-medium mb-1.5">Tracking</p>
                        <select
                          value={editTrackingType}
                          onChange={(e) =>
                            setEditTrackingType(e.target.value as "time" | "reps" | "weight_reps")
                          }
                          className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white outline-none focus:border-indigo-500/60"
                        >
                          <option value="weight_reps">Weight + reps</option>
                          <option value="reps">Reps</option>
                          <option value="time">Time</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="text-neutral-300 text-xs font-medium mb-1.5">Duration (optional)</p>
                      <input
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        placeholder={editTrackingType === "time" ? "e.g., 00:10:00" : "Leave blank"}
                        className="w-full rounded-xl bg-black/70 border border-neutral-800 px-4 py-3 text-white placeholder:text-neutral-600 outline-none focus:border-indigo-500/60"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDeleteExercise(exercise)}
                      disabled={savingEdit || deletingExerciseId === exercise.id}
                      className="flex-1 bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-rose-500 active:bg-rose-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-rose-900/20"
                    >
                      <Trash2 className="w-5 h-5" />
                      {deletingExerciseId === exercise.id ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveEdit()}
                      disabled={savingEdit || deletingExerciseId === exercise.id || !editName.trim()}
                      className="flex-1 bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-emerald-500 active:bg-emerald-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-emerald-900/20"
                    >
                      <Check className="w-5 h-5" />
                      {savingEdit ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}



