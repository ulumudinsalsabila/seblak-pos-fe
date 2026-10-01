"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api, refreshAccessToken, setAccessToken } from "@/lib/api";
import type { User } from "@/lib/types";
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(function schedule(expiresIn: number) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const delay = Math.max(30, expiresIn - 60) * 1000;
    refreshTimer.current = setTimeout(async () => {
      try {
        const session = await refreshAccessToken();
        schedule(session.expiresIn);
      } catch {
        // A failed background refresh is retried by the next authenticated API call.
      }
    }, delay);
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await refreshAccessToken();
        const me = await api<{ data: User }>("/auth/me");
        if (active) {
          setUser(me.data);
          scheduleRefresh(session.expiresIn);
        }
      } catch {
        setAccessToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const result = await api<{
          data: { accessToken: string; expiresIn: number };
        }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setAccessToken(result.data.accessToken);
        scheduleRefresh(result.data.expiresIn);
        const me = await api<{ data: User }>("/auth/me");
        setUser(me.data);
        return me.data;
      },
      async logout() {
        try {
          await api("/auth/logout", { method: "POST" });
        } finally {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, loading, scheduleRefresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
