import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

/** Land on the first tab this admin is actually allowed to see. */
export default async function Page() {
  const actor = await currentActor();
  const perms = actor?.perms ?? [];
  const first =
    (
      [
        ["users.read", "/admin/users"],
        ["roles.read", "/admin/roles"],
        ["invites.read", "/admin/invites"],
        ["codes.read", "/admin/access-codes"],
        ["waitlist.read", "/admin/waitlist"],
        ["audit.read", "/admin/audit"],
      ] as const
    ).find(([perm]) => can(perms, perm))?.[1] ?? "/";
  redirect(first);
}
