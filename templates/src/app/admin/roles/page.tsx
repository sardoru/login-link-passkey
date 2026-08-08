import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { RolesPanel } from "@/components/admin/roles-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "roles.read")) redirect("/admin");
  return <RolesPanel canWrite={can(actor.perms, "roles.write")} />;
}
