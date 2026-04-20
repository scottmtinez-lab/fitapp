"use client";

import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../lib/auth/AuthProvider";
import { signInWithGooglePopup } from "../../lib/firebase/auth";
import { getClientDb } from "../../lib/firebase/firestore";
import { ensureApprovedOrRequest } from "../../lib/db/accountRequests";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, approved, checkingApproval } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading || checkingApproval) return;
    if (!user) return;
    if (approved) router.replace("/");
    else router.replace(`/access-requested?email=${encodeURIComponent(user.email || "")}`);
  }, [approved, checkingApproval, loading, router, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const code = window.localStorage.getItem("login_error");
    if (!code) return;
    window.localStorage.removeItem("login_error");
    if (code === "permission-denied") {
      setError("Account requests are blocked by Firestore rules. Ask an admin to enable requests.");
    }
  }, []);

  async function handleSignIn() {
    setSigningIn(true);
    setError(null);
    setPending(false);
    try {
      const signedInUser = await signInWithGooglePopup();
      if (!signedInUser) return;
      const db = getClientDb();
      if (!db) return;

      const approved = await ensureApprovedOrRequest(db, signedInUser);
      if (!approved) {
        setPending(true);
        router.replace(`/access-requested?email=${encodeURIComponent(signedInUser.email || "")}`);
        return;
      }

      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in.");
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="relative min-h-[100svh] flex items-center justify-center px-6 py-10 overflow-hidden bg-gradient-to-b from-neutral-950 via-black to-neutral-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-fuchsia-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-black/70 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl shadow-black/60">
          <div className="mb-6">
            <p className="text-neutral-400 text-xs font-semibold uppercase tracking-widest mb-2">
              Sign In
            </p>
            <p className="text-white font-extrabold text-3xl leading-tight">[STACKED]</p>
            <p className="text-sm text-neutral-500 mt-2">
              Sign in to sync workouts, routines, and progress across devices.
            </p>
          </div>

          {error ? (
            <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-4 text-sm mb-4">
              {error}
            </div>
          ) : null}

          {pending ? (
            <div className="bg-amber-950/30 border border-amber-900/50 text-amber-200 rounded-2xl p-4 text-sm mb-4">
              Access requested. An admin will review your request within 24 hours.
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={signingIn || loading}
            className="w-full bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-black"
          >
            <LogIn className="w-5 h-5" />
            {signingIn ? "Signing in..." : "Continue with Google"}
          </button>

          <div className="mt-5 rounded-2xl border border-neutral-800 bg-black/40 p-4">
            <p className="text-xs text-neutral-500">
              If the sign-in popup is blocked, allow popups for this site and try again.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
