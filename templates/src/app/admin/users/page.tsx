import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { UsersPanel } from "@/components/admin/users-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "users.read")) redirect("/admin");
  return (
    <UsersPanel
      canWrite={can(actor.perms, "users.write")}
      canDelete={can(actor.perms, "users.delete")}
      canEditPerms={can(actor.perms, "users.permissions")}
      canPasskeys={can(actor.perms, "users.passkeys")}
      selfId={actor.user.id}
    />
  );
}
