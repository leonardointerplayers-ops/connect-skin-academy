import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/dal";

export default async function LearnerLayout({ children }: LayoutProps<"/">) {
  const profile = await requireUser();
  return (
    <AppShell profile={profile} area="learner">
      {children}
    </AppShell>
  );
}
