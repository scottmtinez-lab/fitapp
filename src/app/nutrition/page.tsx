"use client";

import Link from "next/link";
import { Plus, Utensils } from "lucide-react";
import AppShell from "../_components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import { subscribeUserMacros } from "../../lib/db/users";
import { addNutritionEntry } from "../../lib/db/nutrition";

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

function numberOrZero(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export default function NutritionPage() {
  const { user } = useAuth();
  const [nutrition, setNutrition] = useState<unknown[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [entryName, setEntryName] = useState("");
  const [entryCalories, setEntryCalories] = useState("");
  const [entryProtein, setEntryProtein] = useState("");
  const [entryCarbs, setEntryCarbs] = useState("");
  const [entryFat, setEntryFat] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserMacros(db, user.uid, (items) => setNutrition(items));
  }, [user?.uid]);

  const todayId = useMemo(() => isoDate(new Date()), []);

  const todaysEntries = useMemo(() => {
    if (!user?.uid || !nutrition) return [];
    return nutrition.filter((e) => {
      if (!e || typeof e !== "object") return false;
      const obj = e as Record<string, unknown>;
      const d =
        parseDate(obj.date) || parseDate(obj.loggedAt) || parseDate(obj.createdAt) || parseDate(obj.day);
      if (!d) return false;
      return isoDate(d) === todayId;
    });
  }, [nutrition, todayId, user?.uid]);

  const totals = useMemo(() => {
    let calories = 0;
    let carbs = 0;
    let protein = 0;
    let fat = 0;
    for (const e of todaysEntries) {
      if (!e || typeof e !== "object") continue;
      const obj = e as Record<string, unknown>;
      calories += numberOrZero(obj.calories) + numberOrZero(obj.kcal);
      carbs += numberOrZero(obj.carbs);
      protein += numberOrZero(obj.protein);
      fat += numberOrZero(obj.fat);
    }
    return { calories, carbs, protein, fat };
  }, [todaysEntries]);

  return (
    <AppShell title="Nutrition">
      <section className="pt-2 space-y-4">
        {!user ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to see nutrition</p>
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
            <div className="bg-black rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="w-5 h-5 text-emerald-400" />
                <p className="text-white font-bold">Today&apos;s Macros</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Calories</p>
                  <p className="text-xl font-bold text-white">{Math.round(totals.calories) || "—"}</p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Protein</p>
                  <p className="text-xl font-bold text-white">{Math.round(totals.protein) || "—"}g</p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Carbs</p>
                  <p className="text-xl font-bold text-white">{Math.round(totals.carbs) || "—"}g</p>
                </div>
                <div className="bg-black/60 border border-neutral-800 rounded-2xl p-3">
                  <p className="text-xs text-neutral-500">Fat</p>
                  <p className="text-xl font-bold text-white">{Math.round(totals.fat) || "—"}g</p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-3">
                Reads from <span className="font-medium">users/{`{uid}`}.macros</span>
              </p>
            </div>

            <div className="bg-black rounded-2xl p-4 border border-neutral-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-400" />
                  <p className="text-white font-bold">Quick Add</p>
                </div>
                <p className="text-xs text-neutral-500">{todaysEntries.length} logged today</p>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3">
                <div>
                  <p className="text-[11px] text-neutral-500 mb-1">Food name</p>
                  <input
                    value={entryName}
                    onChange={(e) => setEntryName(e.target.value)}
                    placeholder="e.g. Chicken Breast"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-1">Calories</p>
                    <input
                      value={entryCalories}
                      onChange={(e) => setEntryCalories(e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-1">Protein (g)</p>
                    <input
                      value={entryProtein}
                      onChange={(e) => setEntryProtein(e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-1">Carbs (g)</p>
                    <input
                      value={entryCarbs}
                      onChange={(e) => setEntryCarbs(e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] text-neutral-500 mb-1">Fat (g)</p>
                    <input
                      value={entryFat}
                      onChange={(e) => setEntryFat(e.target.value)}
                      placeholder="0"
                      inputMode="decimal"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!entryName.trim() || logLoading}
                  onClick={async () => {
                    if (!user?.uid) return;
                    const db = getClientDb();
                    if (!db) return;

                    const toNum = (raw: string) => {
                      const n = Number(raw);
                      return Number.isFinite(n) ? n : 0;
                    };

                    setEntryError(null);
                    setLogLoading(true);
                    try {
                      const id =
                        typeof crypto !== "undefined" && "randomUUID" in crypto
                          ? crypto.randomUUID()
                          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

                      await addNutritionEntry(db, user.uid, {
                        id,
                        name: entryName.trim(),
                        calories: toNum(entryCalories),
                        protein: toNum(entryProtein),
                        carbs: toNum(entryCarbs),
                        fat: toNum(entryFat),
                        day: todayId,
                      });

                      setEntryCalories("");
                      setEntryProtein("");
                      setEntryCarbs("");
                      setEntryFat("");
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Failed to save";
                      setEntryError(message);
                    } finally {
                      setLogLoading(false);
                    }
                  }}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:hover:bg-emerald-600 text-white text-sm font-semibold px-3 py-3"
                >
                  {logLoading ? "Saving..." : "Ate"}
                </button>

                {entryError ? <p className="text-xs text-rose-300">{entryError}</p> : null}
              </div>
            </div>

          </>
        )}
      </section>
    </AppShell>
  );
}


