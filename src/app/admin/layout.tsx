import { AppShell } from "@/components/layout/app-shell";
import { requireStaff } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireStaff();
  return (
    <AppShell profile={profile} area="admin">
      {children}
    </AppShell>
  );
}
