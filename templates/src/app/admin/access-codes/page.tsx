import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { AccessCodesPanel } from "@/components/admin/access-codes-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "codes.read")) redirect("/admin");
  return (
    <AccessCodesPanel
      canWrite={can(actor.perms, "codes.write")}
      canRevoke={can(actor.perms, "codes.revoke")}
    />
  );
}
