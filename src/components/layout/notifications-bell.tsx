"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markNotificationsReadAction } from "@/actions/notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/domain";

export function NotificationsBell({ items, unread }: { items: Notification[]; unread: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificações (${unread} não lidas)`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold leading-4 text-brand-accent-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              onClick={() => startTransition(async () => void (await markNotificationsReadAction()))}
            >
              <CheckCheck /> Marcar todas como lidas
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.link ?? "/notificacoes"}
                    onClick={() => !n.read_at && startTransition(async () => void (await markNotificationsReadAction([n.id])))}
                    className={cn("block px-4 py-3 hover:bg-muted/60", !n.read_at && "bg-secondary/50")}
                  >
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link href="/notificacoes">Ver todas</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
