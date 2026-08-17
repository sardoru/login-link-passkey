import type { PermissionDef, UserOverrides } from "@/lib/auth/permissions";
import type { PasskeyInfo } from "../auth/passkey-client";

export type { PermissionDef, UserOverrides, PasskeyInfo };

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: "active" | "invited" | "suspended";
  permissions: UserOverrides | null;
  created_at: string;
  last_login_at: string | null;
  passkey_count?: number;
}

export interface Role {
  key: string;
  label: string;
  description: string | null;
  permissions: string[];
  rank: number;
  is_system: boolean;
}

export interface Invite {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  sent_at: string | null;
  created_at: string;
  state: "pending" | "accepted" | "revoked" | "expired";
}

export interface AccessCode {
  id: string;
  code: string;
  label: string | null;
  role: string;
  max_uses: number;
  uses: number;
  remaining: number;
  status: "active" | "revoked" | "expired" | "exhausted";
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  joinUrl: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  note: string | null;
  source: string | null;
  status: "pending" | "invited" | "rejected";
  created_at: string;
  reviewed_at: string | null;
}
