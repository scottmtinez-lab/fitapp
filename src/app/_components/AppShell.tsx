"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Dumbbell,
  Home,
  LineChart,
  List,
  Menu,
  Shield,
  User,
  Utensils,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import { subscribeUserMacros, subscribeUserRole } from "../../lib/db/users";
import { subscribeHasPendingAccountRequests } from "../../lib/db/accountRequests";

type MacroBarProps = {
  label: string;
  current: number;
  target: number;
  colorClass: string;
};

function MacroBar({ label, current, target, colorClass }: MacroBarProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-neutral-300">{label}</span>
        <span className="text-neutral-500">
          {current}g / {target}g
        </span>
      </div>
      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

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

type NutritionTotals = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  caloriesGoal?: number;
  carbsGoal?: number;
  proteinGoal?: number;
  fatGoal?: number;
};

function numberOrNull(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function computeTodayNutrition(entries: unknown[]): NutritionTotals | null {
  const today = new Date();
  const todayId = isoDate(today);

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
      parseDate(obj.date) ||
      parseDate(obj.loggedAt) ||
      parseDate(obj.createdAt) ||
      parseDate(obj.day);

    if (!d) continue;
    if (isoDate(d) !== todayId) continue;

    calories += numberOrNull(obj.calories) ?? numberOrNull(obj.kcal) ?? 0;
    carbs += numberOrNull(obj.carbs) ?? 0;
    protein += numberOrNull(obj.protein) ?? 0;
    fat += numberOrNull(obj.fat) ?? 0;

    const goals = obj.goals;
    if (goals && typeof goals === "object") {
      const g = goals as Record<string, unknown>;
      caloriesGoal = numberOrNull(g.calories) ?? caloriesGoal;
      carbsGoal = numberOrNull(g.carbs) ?? carbsGoal;
      proteinGoal = numberOrNull(g.protein) ?? proteinGoal;
      fatGoal = numberOrNull(g.fat) ?? fatGoal;
    }

    caloriesGoal = numberOrNull(obj.caloriesGoal) ?? caloriesGoal;
    carbsGoal = numberOrNull(obj.carbsGoal) ?? carbsGoal;
    proteinGoal = numberOrNull(obj.proteinGoal) ?? proteinGoal;
    fatGoal = numberOrNull(obj.fatGoal) ?? fatGoal;
  }

  if (calories === 0 && carbs === 0 && protein === 0 && fat === 0) return null;

  return { calories, carbs, protein, fat, caloriesGoal, carbsGoal, proteinGoal, fatGoal };
}

function DrawerLink({
  href,
  icon,
  label,
  onClick,
  badge,
}: {
  href: string;
  icon: ReactNode;
  label: ReactNode;
  onClick?: () => void;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="w-full flex items-center gap-4 text-neutral-300 hover:text-white hover:bg-white/5 p-3 rounded-xl transition-colors text-left"
    >
      <span className="text-neutral-400">{icon}</span>
      <span className="font-medium text-sm flex-1 flex items-center gap-2">
        {label}
        {badge ? <span className="shrink-0">{badge}</span> : null}
      </span>
    </Link>
  );
}

function BottomNavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 min-w-[64px]">
      <div
        className={`p-2 rounded-xl transition-colors ${
          active
            ? "text-indigo-400 bg-indigo-500/10"
            : "text-neutral-500 hover:text-neutral-300"
        }`}
      >
        {icon}
      </div>
      <span className={`text-[10px] font-medium ${active ? "text-indigo-400" : "text-neutral-500"}`}>
        {label}
      </span>
    </Link>
  );
}

export default function AppShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, approved, loading, checkingApproval } = useAuth();
  const [nutrition, setNutrition] = useState<unknown[] | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hasPendingAccountRequests, setHasPendingAccountRequests] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (loading || checkingApproval) return;
    if (approved) return;
    if (pathname === "/login" || pathname === "/access-requested") return;
    router.replace(`/access-requested?email=${encodeURIComponent(user.email || "")}`);
  }, [approved, checkingApproval, loading, pathname, router, user]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserMacros(db, user.uid, (items) => setNutrition(items));
  }, [user?.uid]);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserRole(db, user.uid, (next) => setRole(next));
  }, [user?.uid]);

  const todayNutrition = useMemo(
    () => (user?.uid && nutrition ? computeTodayNutrition(nutrition) : null),
    [nutrition, user?.uid],
  );
  const caloriesGoal = todayNutrition?.caloriesGoal;
  const caloriesPct =
    todayNutrition && caloriesGoal && caloriesGoal > 0
      ? Math.min(Math.round((todayNutrition.calories / caloriesGoal) * 100), 999)
      : null;

  const displayName = useMemo(() => user?.displayName || "Guest", [user?.displayName]);
  const initials = useMemo(() => {
    const parts = displayName.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "S";
    const second = parts[1]?.[0] || parts[0]?.[1] || "M";
    return `${first}${second}`.toUpperCase();
  }, [displayName]);
  const photoURL = user?.photoURL || null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 18) return "Good afternoon,";
    return "Good evening,";
  }, []);

  const isAdmin = role?.toLowerCase() === "admin";

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid || !isAdmin) return;
    return subscribeHasPendingAccountRequests(db, (hasPending) => setHasPendingAccountRequests(hasPending));
  }, [isAdmin, user?.uid]);

  const activePath = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-black flex justify-center w-full text-neutral-100 font-sans">
      <main className="w-full max-w-md mx-auto min-h-screen relative overflow-hidden bg-black flex flex-col shadow-2xl border-x border-neutral-900">
        <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-black z-10 relative">
          <div>
            <p className="text-neutral-400 text-sm font-medium">{title ?? greeting}</p>
            <h1 className="text-2xl font-bold text-white tracking-tight">{displayName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center border-2 border-neutral-800 shadow-sm overflow-hidden">
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoURL}
                  alt={`${displayName} profile photo`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-bold text-white text-sm">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="p-2 bg-black rounded-xl hover:bg-white/5 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </header>

        {isMenuOpen && (
          <div className="absolute inset-0 z-50 flex justify-end">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm drawer-backdrop"
              onClick={() => setIsMenuOpen(false)}
            />

            <aside className="relative w-4/5 h-full bg-black/85 backdrop-blur-xl border-l border-neutral-800 shadow-2xl p-6 flex flex-col drawer-in">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
                    {photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoURL}
                        alt={`${displayName} profile photo`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="font-bold text-white text-sm">{initials}</span>
                    )}
                  </div>
                  <span className="font-bold text-lg text-white">{displayName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 text-neutral-200"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-2 mb-8">
                <DrawerLink
                  href="/"
                  icon={<Home className="w-5 h-5" />}
                  label="Home"
                  onClick={() => setIsMenuOpen(false)}
                />
                <DrawerLink
                  href="/workout"
                  icon={<Dumbbell className="w-5 h-5" />}
                  label="Workout"
                  onClick={() => setIsMenuOpen(false)}
                />
                <DrawerLink
                  href="/exercises"
                  icon={<List className="w-5 h-5" />}
                  label="Exercises"
                  onClick={() => setIsMenuOpen(false)}
                />
                <DrawerLink
                  href="/progress"
                  icon={<LineChart className="w-5 h-5" />}
                  label="Progress"
                  onClick={() => setIsMenuOpen(false)}
                />
                <DrawerLink
                  href="/nutrition"
                  icon={<Apple className="w-5 h-5" />}
                  label="Nutrition"
                  onClick={() => setIsMenuOpen(false)}
                />
                {isAdmin ? (
                  <DrawerLink
                    href="/account-requests"
                    icon={<Shield className="w-5 h-5" />}
                    label="Account Requests"
                    onClick={() => setIsMenuOpen(false)}
                    badge={
                      hasPendingAccountRequests ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      ) : null
                    }
                  />
                ) : null}
                <DrawerLink
                  href="/profile"
                  icon={<User className="w-5 h-5" />}
                  label="Profile"
                  onClick={() => setIsMenuOpen(false)}
                />
              </nav>

              <div className="mt-auto bg-black/80 rounded-2xl p-5 border border-neutral-800">
                <div className="flex items-center gap-2 mb-4">
                  <Utensils className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-white font-bold text-sm">Today&apos;s Macros</h3>
                </div>

                <div className="flex items-center justify-between mb-6 pb-6 border-b border-neutral-800">
                  <div>
                    <p className="text-3xl font-bold text-white">
                      {todayNutrition ? Math.round(todayNutrition.calories) : "—"}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {todayNutrition && caloriesGoal ? `/ ${Math.round(caloriesGoal)} kcal Goal` : "No data today"}
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center -rotate-45">
                    <span className="text-xs font-bold text-emerald-400 rotate-45">
                      {caloriesPct !== null ? `${caloriesPct}%` : "—"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <MacroBar
                    label="Carbs"
                    current={todayNutrition ? Math.round(todayNutrition.carbs) : 0}
                    target={todayNutrition?.carbsGoal ?? 0}
                    colorClass="bg-blue-500"
                  />
                  <MacroBar
                    label="Protein"
                    current={todayNutrition ? Math.round(todayNutrition.protein) : 0}
                    target={todayNutrition?.proteinGoal ?? 0}
                    colorClass="bg-indigo-500"
                  />
                  <MacroBar
                    label="Fat"
                    current={todayNutrition ? Math.round(todayNutrition.fat) : 0}
                    target={todayNutrition?.fatGoal ?? 0}
                    colorClass="bg-orange-500"
                  />
                </div>
              </div>
            </aside>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 pb-28 no-scrollbar">{children}</div>

        <nav className="absolute bottom-0 w-full bg-black/90 backdrop-blur-md border-t border-neutral-900 pt-2 px-6 pb-safe">
          <div className="flex justify-between items-center py-2 pb-6">
            <BottomNavItem
              href="/"
              icon={<Home className="w-6 h-6" />}
              label="Home"
              active={activePath("/")}
            />
            <BottomNavItem
              href="/workout"
              icon={<Dumbbell className="w-6 h-6" />}
              label="Workout"
              active={activePath("/workout")}
            />
            <BottomNavItem
              href="/progress"
              icon={<LineChart className="w-6 h-6" />}
              label="Progress"
              active={activePath("/progress")}
            />
            <BottomNavItem
              href="/profile"
              icon={<User className="w-6 h-6" />}
              label="Profile"
              active={activePath("/profile")}
            />
          </div>
        </nav>
      </main>
    </div>
  );
}


