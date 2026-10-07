import { cookies } from "next/headers";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";
import { MobileTabBar } from "./mobile-tab-bar";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import { getNotificationsSummary } from "@/services/notifications";
import { getSettings } from "@/services/settings";
import { isStaffRole } from "@/lib/auth/dal";
import { publicStorageUrl } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/domain";

export async function AppShell({
  profile,
  area,
  children,
}: {
  profile: Profile;
  area: "learner" | "admin";
  children: React.ReactNode;
}) {
  const [cookieStore, notifications, settings] = await Promise.all([cookies(), getNotificationsSummary(), getSettings()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const isStaff = isStaffRole(profile.role_id);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        area={area}
        isAdmin={profile.role_id === "admin"}
        isStaff={isStaff}
        rankingEnabled={settings.ranking_enabled}
      />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-5">
          <SidebarTrigger className={cn(area === "learner" && "max-md:hidden")} />
          <Separator orientation="vertical" className={cn("mx-1 h-5", area === "learner" && "max-md:hidden")} />
          <span className="truncate text-sm font-medium text-muted-foreground">
            {area === "admin" ? "Painel de gestão" : settings.platform_name}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell items={notifications.items} unread={notifications.unread} />
            <UserMenu
              name={profile.full_name || profile.email}
              email={profile.email}
              role={profile.role_id}
              avatarUrl={publicStorageUrl("avatars", profile.avatar_path)}
              isStaff={isStaff}
            />
          </div>
        </header>
        <div className={cn("mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8", area === "learner" && "pb-24 md:pb-8")}>
          {children}
        </div>
      </SidebarInset>
      {area === "learner" && <MobileTabBar />}
    </SidebarProvider>
  );
}
