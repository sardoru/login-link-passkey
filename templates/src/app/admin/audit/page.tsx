import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { AuditPanel } from "@/components/admin/audit-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "audit.read")) redirect("/admin");
  return <AuditPanel />;
}
