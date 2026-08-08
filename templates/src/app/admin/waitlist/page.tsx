import { redirect } from "next/navigation";
import { currentActor } from "@/lib/auth/rbac";
import { can } from "@/lib/auth/permissions";
import { WaitlistPanel } from "@/components/admin/waitlist-panel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const actor = await currentActor();
  if (!actor || !can(actor.perms, "waitlist.read")) redirect("/admin");
  return <WaitlistPanel canApprove={can(actor.perms, "waitlist.approve")} />;
}
