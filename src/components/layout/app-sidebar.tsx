"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, GraduationCap, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrandMark } from "@/components/shared/brand";
import { ADMIN_NAV, LEARNER_NAV, filterNav, type NavItem } from "@/config/navigation";
import { APP_CONFIG } from "@/config/app";

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppSidebar({
  area,
  isAdmin,
  isStaff,
  rankingEnabled,
}: {
  area: "learner" | "admin";
  isAdmin: boolean;
  isStaff: boolean;
  rankingEnabled: boolean;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const items =
    area === "admin"
      ? filterNav(ADMIN_NAV, isAdmin)
      : LEARNER_NAV.filter((i) => i.href !== "/ranking" || rankingEnabled);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        <Link href={area === "admin" ? "/admin" : "/inicio"} className="flex items-center gap-2.5 px-1.5 py-1.5">
          <BrandMark className="size-8 text-base" />
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">{APP_CONFIG.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {area === "admin" ? "Painel de gestão" : "Universidade Corporativa"}
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{area === "admin" ? "Gestão" : "Aprendizagem"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
                item.children ? (
                  <Collapsible key={item.href} defaultOpen={pathname.startsWith(item.href)} className="group/collapsible" asChild>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton tooltip={item.title} isActive={pathname.startsWith(item.href)}>
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuSubButton asChild isActive={isActive(pathname, child)}>
                                <Link href={child.href} onClick={() => setOpenMobile(false)}>
                                  <span>{child.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.title} isActive={isActive(pathname, item)}>
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {isStaff && (
        <SidebarFooter className="border-t border-sidebar-border/60">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip={area === "admin" ? "Área do colaborador" : "Painel de gestão"}>
                <Link href={area === "admin" ? "/inicio" : "/admin"}>
                  {area === "admin" ? <GraduationCap /> : <LayoutDashboard />}
                  <span>{area === "admin" ? "Ver como colaborador" : "Painel de gestão"}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
