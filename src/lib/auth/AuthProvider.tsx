"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "../firebase/auth";
import { getClientDb } from "../firebase/firestore";
import { upsertUserProfile } from "../db/users";
import { ensureApprovedOrRequest } from "../db/accountRequests";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  approved: boolean;
  checkingApproval: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);

  useEffect(() => {
    const auth = getClientAuth();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      setApproved(false);
      setCheckingApproval(Boolean(nextUser));

      if (nextUser) {
        const db = getClientDb();
        if (db) {
          void (async () => {
            try {
              const approved = await ensureApprovedOrRequest(db, nextUser);
              const devBypass =
                process.env.NODE_ENV !== "production" &&
                typeof window !== "undefined" &&
                window.localStorage?.getItem("dev_allow_unapproved") === "1";
              const ok = Boolean(approved || devBypass);
              setApproved(ok);
              if (ok) {
                await upsertUserProfile(db, nextUser);
              }
            } catch (e) {
              try {
                if (typeof window !== "undefined") {
                  window.localStorage?.setItem(
                    "login_error",
                    e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "unknown",
                  );
                }
              } catch {
                // ignore
              }
              setApproved(false);
            } finally {
              setCheckingApproval(false);
            }
          })();
        } else {
          setCheckingApproval(false);
        }
      } else {
        setCheckingApproval(false);
      }
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, approved, checkingApproval }),
    [approved, checkingApproval, loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within <AuthProvider />.");
  }
  return value;
}
