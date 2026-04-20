"use client";

import Link from "next/link";
import { Check, Shield, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AppShell from "../_components/AppShell";
import { useAuth } from "../../lib/auth/AuthProvider";
import { getClientDb } from "../../lib/firebase/firestore";
import { subscribeUserRole } from "../../lib/db/users";
import {
  approveAccountRequest,
  denyAccountRequest,
  subscribeAccountRequests,
  type AccountRequest,
} from "../../lib/db/accountRequests";

export default function AccountRequestsPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [items, setItems] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    return subscribeUserRole(db, user.uid, (r) => setRole(r));
  }, [user?.uid]);

  const isAdmin = role?.toLowerCase() === "admin";

  useEffect(() => {
    const db = getClientDb();
    if (!db || !user?.uid) return;
    if (!isAdmin) return;
    return subscribeAccountRequests(
      db,
      (next) => {
        setItems(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load requests.");
        setLoading(false);
      },
    );
  }, [isAdmin, user?.uid]);

  const pending = useMemo(() => items.filter((i) => i.status === "pending"), [items]);

  async function handleApprove(req: AccountRequest) {
    const db = getClientDb();
    if (!db) return;
    setActingId(req.id);
    setError(null);
    try {
      await approveAccountRequest(db, req);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve request.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDeny(uid: string) {
    const db = getClientDb();
    if (!db) return;
    setActingId(uid);
    setError(null);
    try {
      await denyAccountRequest(db, uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to deny request.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <AppShell title="Account Requests">
      <section className="pt-2 space-y-4">
        {!user ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <p className="text-white font-semibold mb-1">Sign in to continue</p>
            <p className="text-xs text-neutral-500">
              Go to{" "}
              <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
                Login
              </Link>{" "}
              to connect your account.
            </p>
          </div>
        ) : !isAdmin ? (
          <div className="bg-black p-4 rounded-2xl border border-neutral-800">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-indigo-400" />
              <p className="text-white font-semibold">Admins only</p>
            </div>
            <p className="text-xs text-neutral-500">You don’t have permission to view this page.</p>
          </div>
        ) : (
          <>
            {error ? (
              <div className="bg-rose-950/30 border border-rose-900/50 text-rose-200 rounded-2xl p-4 text-sm">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider">
                Pending
              </p>
              <p className="text-xs text-neutral-500">{pending.length} requests</p>
            </div>

            {loading ? (
              <div className="bg-black p-4 rounded-2xl border border-neutral-800">
                <p className="text-xs text-neutral-500">Loading…</p>
              </div>
            ) : pending.length === 0 ? (
              <div className="bg-black p-4 rounded-2xl border border-neutral-800">
                <p className="text-white font-semibold mb-1">No pending requests</p>
                <p className="text-xs text-neutral-500">New requests will show up here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((r) => (
                  <div
                    key={r.id}
                    className="bg-black p-4 rounded-2xl border border-neutral-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-black/70 border border-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                        {r.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.photoURL}
                            alt={`${r.displayName || r.email || r.uid} avatar`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xs font-bold text-neutral-300">?</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {r.displayName || "New user"}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">{r.email || r.uid}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleApprove(r)}
                        disabled={actingId === r.id}
                        className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-white shadow-lg shadow-emerald-900/20"
                        aria-label="Approve"
                        title="Approve"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeny(r.uid)}
                        disabled={actingId === r.uid}
                        className="p-2 rounded-xl bg-black/60 border border-neutral-800 text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        aria-label="Deny"
                        title="Deny"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </AppShell>
  );
}
