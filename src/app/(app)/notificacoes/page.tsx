import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { Pagination } from "@/components/shared/list-controls";
import { MarkAllRead } from "./mark-all-read";
import { listNotifications } from "@/services/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notificações" };

export default async function NotificationsPage({ searchParams }: PageProps<"/notificacoes">) {
  const sp = await searchParams;
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const { items, total } = await listNotifications(page, 30);

  return (
    <>
      <PageHeader title="Notificações" actions={items.some((n) => !n.read_at) && <MarkAllRead />} />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhuma notificação" description="Você será avisado sobre novos módulos, provas e conquistas." />
      ) : (
        <Card className="py-0">
          <CardContent className="p-2">
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "#"} className={cn("block rounded-lg px-3 py-3 hover:bg-muted/50", !n.read_at && "bg-secondary/40")}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{n.title}</p>
                      {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-accent" aria-label="Não lida" />}
                    </div>
                    {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <Suspense>
              <Pagination page={page} pageSize={30} total={total} />
            </Suspense>
          </CardContent>
        </Card>
      )}
    </>
  );
}
