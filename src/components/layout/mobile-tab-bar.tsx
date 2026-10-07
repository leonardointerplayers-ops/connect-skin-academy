"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEARNER_NAV } from "@/config/navigation";
import { cn } from "@/lib/utils";

/** Barra inferior para o colaborador no celular (acesso em 1 toque). */
export function MobileTabBar() {
  const pathname = usePathname();
  const items = LEARNER_NAV.filter((i) => i.mobile);
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`) ||
            (item.href === "/trilhas" && (pathname.startsWith("/modulos") || pathname.startsWith("/aulas")));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "stroke-[2.25]")} />
                {item.title.replace("Minha ", "").replace("Meu ", "")}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
