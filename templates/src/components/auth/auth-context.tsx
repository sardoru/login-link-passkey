"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { can as hasPermission } from "@/lib/auth/permissions";

export interface Me {
  authenticated: boolean;
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  permissions?: string[];
  isAdmin?: boolean;
  hasPasskey?: boolean;
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Permission check for conditional UI. The server always re-checks. */
  can: (permission: string) => boolean;
}

const Ctx = createContext<AuthCtx>({
  me: null,
  loading: true,
  refresh: async () => {},
  can: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      setMe(await res.json());
    } catch {
      setMe({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const can = useCallback(
    (permission: string) => hasPermission(me?.permissions, permission),
    [me]
  );

  return (
    <Ctx.Provider value={{ me, loading, refresh, can }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
