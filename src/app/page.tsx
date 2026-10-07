import { redirect } from "next/navigation";
import { isStaffRole, requireUser } from "@/lib/auth/dal";

export default async function RootPage() {
  const profile = await requireUser();
  redirect(isStaffRole(profile.role_id) ? "/admin" : "/inicio");
}
