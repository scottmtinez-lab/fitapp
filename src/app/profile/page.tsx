"use client";

import { LogIn, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "../_components/AppShell";
import { useAuth } from "../../lib/auth/AuthProvider";
import { signOutClient } from "../../lib/firebase/auth";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  return (
    <AppShell title="Profile">
      <section className="pt-2 space-y-4">
        <div className="bg-black rounded-2xl p-4 border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black/70 border border-neutral-800 flex items-center justify-center">
              <User className="w-6 h-6 text-neutral-300" />
            </div>
            <div>
              <p className="text-white font-bold">{loading ? "Loading..." : user?.displayName || "Guest"}</p>
              <p className="text-xs text-neutral-500">{user?.email || "Not signed in"}</p>
            </div>
          </div>
        </div>

        {!user ? (
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-indigo-900/20"
          >
            <LogIn className="w-5 h-5" />
            Sign in
          </button>
        ) : null}

        <button
          type="button"
          className="w-full bg-black hover:bg-white/5 transition-colors rounded-2xl p-4 border border-neutral-800 flex items-center justify-between"
        >
          <span className="flex items-center gap-2 text-neutral-200 font-medium">
            <Settings className="w-5 h-5 text-neutral-400" />
            Settings
          </span>
          <span className="text-xs text-neutral-500">Soon</span>
        </button>

        <button
          type="button"
          onClick={() => void signOutClient().then(() => router.replace("/login"))}
          disabled={!user}
          className="w-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-colors rounded-2xl p-4 flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-rose-900/20"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </section>
    </AppShell>
  );
}

