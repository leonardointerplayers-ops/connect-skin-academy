import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";

export default async function AssessmentsIndex() {
  const profile = await getCurrentProfile();
  redirect(profile?.role_id === "admin" ? "/admin/avaliacoes/provas" : "/admin/avaliacoes/resultados");
}
