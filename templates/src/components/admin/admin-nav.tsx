"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, Send, KeyRound, ListChecks, ScrollText, ArrowLeft } from "lucide-react";
import { can } from "@/lib/auth/permissions";
import { cx } from "../auth/cx";

const TABS = [
  { href: "/admin/users", label: "Users", icon: Users, perm: "users.read" },
  { href: "/admin/roles", label: "Roles", icon: Shield, perm: "roles.read" },
  { href: "/admin/invites", label: "Invites", icon: Send, perm: "invites.read" },
  { href: "/admin/access-codes", label: "Access codes", icon: KeyRound, perm: "codes.read" },
  { href: "/admin/waitlist", label: "Waitlist", icon: ListChecks, perm: "waitlist.read" },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, perm: "audit.read" },
];

/** Tabs are filtered by permission — you never see a page you'd be bounced from. */
export function AdminNav({ perms }: { perms: string[] }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => can(perms, t.perm));

  return (
    <nav className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
      {visible.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition",
              active
                ? "bg-ink text-paper"
                : "text-inksoft hover:bg-surface2 hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
      <Link
        href="/"
        className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-inkfaint transition hover:bg-surface2 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to app
      </Link>
    </nav>
  );
}
