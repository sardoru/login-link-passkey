import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { AdminNav } from "@/components/admin/admin-nav";
import { BRAND } from "@/lib/auth/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Admin · ${BRAND.appName}`,
  robots: { index: false, follow: false },
};

/**
 * Server-side gate. The edge proxy also checks `admin.access`, but it trusts
 * the (cacheable) session claim — this check reads the database, and so does
 * every /api/admin route. Three layers, one source of truth.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await currentActor();
  if (!actor) redirect("/login?next=/admin");
  if (!can(actor.perms, "admin.access")) redirect("/");

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brass">
            {BRAND.appName} admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            People &amp; access
          </h1>
          <p className="mt-1 text-sm text-inksoft">
            Signed in as{" "}
            <span className="font-medium text-ink">{actor.user.email}</span> ·{" "}
            <span className="capitalize">{actor.user.role}</span>
          </p>
        </header>

        <AdminNav perms={actor.perms} />
        <main className="mt-5 space-y-6">{children}</main>
      </div>
    </div>
  );
}
