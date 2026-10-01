"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
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
  useEffect(() => {
    void (async () => {
      try {
        await refreshAccessToken();
        const me = await api<{ data: User }>("/auth/me");
        setUser(me.data);
      } catch {
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const result = await api<{ data: { accessToken: string } }>(
          "/auth/login",
          { method: "POST", body: JSON.stringify({ email, password }) },
        );
        setAccessToken(result.data.accessToken);
        const me = await api<{ data: User }>("/auth/me");
        setUser(me.data);
        return me.data;
      },
      async logout() {
        try {
          await api("/auth/logout", { method: "POST" });
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
