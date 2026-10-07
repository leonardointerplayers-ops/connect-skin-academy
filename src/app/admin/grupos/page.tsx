import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { GroupManager } from "@/components/admin/group-manager";
import { listAllPeople, listGroups } from "@/services/users";
import { requireStaff } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [groups, people, { data: members }] = await Promise.all([
    listGroups(),
    listAllPeople(),
    supabase.from("group_members").select("group_id, user_id"),
  ]);
  const byGroup = new Map<string, string[]>();
  for (const m of members ?? []) byGroup.set(m.group_id as string, [...(byGroup.get(m.group_id as string) ?? []), m.user_id as string]);

  return (
    <>
      <PageHeader
        title="Grupos"
        description="Organize colaboradores por área (Comercial, Operações…). Trilhas podem ser liberadas apenas para grupos específicos."
      />
      {groups.length === 0 && profile.role_id !== "admin" ? (
        <EmptyState icon={UsersRound} title="Nenhum grupo cadastrado" />
      ) : (
        <GroupManager
          canEdit={profile.role_id === "admin"}
          people={people}
          groups={groups.map((g) => ({ ...g, memberIds: byGroup.get(g.id) ?? [] }))}
        />
      )}
    </>
  );
}
