import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { InvitesPanel } from "@/components/admin/invites-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "invites.read")) redirect("/admin");
  return (
    <InvitesPanel
      canWrite={can(actor.perms, "invites.write")}
      canRevoke={can(actor.perms, "invites.revoke")}
    />
  );
}
