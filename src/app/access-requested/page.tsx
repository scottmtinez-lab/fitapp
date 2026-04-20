"use client";

import { Suspense, useState } from "react";
import { Clock, Shield } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOutClient } from "../../lib/firebase/auth";

function AccessRequestedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [warning] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const code = window.localStorage.getItem("login_error");
    if (!code) return null;
    window.localStorage.removeItem("login_error");
    if (code !== "permission-denied") return null;
    return "We couldn’t submit your request due to Firestore permissions. Ask an admin to enable account requests in security rules.";
  });

  async function backToLogin() {
    await signOutClient();
    router.replace("/login");
  }

  return (
    <main className="relative min-h-[100svh] flex items-center justify-center px-6 py-10 overflow-hidden bg-gradient-to-b from-neutral-950 via-black to-neutral-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-black/70 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-indigo-300">
              <Shield className="w-5 h-5" />
            </div>
            <p className="text-white font-bold">Access requested</p>
          </div>

          <p className="text-sm text-neutral-500 mb-4">
            {email ? (
              <>
                Your account <span className="text-white font-semibold">{email}</span> is pending
                approval.
              </>
            ) : (
              "Your account is pending approval."
            )}{" "}
            An admin will review your request within <span className="text-white font-semibold">24 hours</span>.
          </p>

          {warning ? (
            <div className="bg-amber-950/30 border border-amber-900/50 text-amber-200 rounded-2xl p-4 text-sm mb-4">
              {warning}
            </div>
          ) : null}

          <div className="rounded-2xl border border-neutral-800 bg-black/40 p-4 mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-neutral-300 font-semibold uppercase tracking-wider">
                What to do next
              </p>
            </div>
            <p className="text-xs text-neutral-500">
              Close the app and try signing in again later. Once approved, you&apos;ll be able to
              access the dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void backToLogin()}
            className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 flex items-center justify-center font-bold text-white border border-neutral-800"
          >
            Back to login
          </button>
        </div>
      </div>
    </main>
  );
}

export default function AccessRequestedPage() {
  return (
    <Suspense
      fallback={<main className="min-h-[100svh] bg-gradient-to-b from-neutral-950 via-black to-neutral-950" />}
    >
      <AccessRequestedContent />
    </Suspense>
  );
}
