import type { Metadata } from "next";
import { ExternalLink, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { getAnnouncements } from "@/services/learning";
import { publicStorageUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Comunicados" };

export default async function AnnouncementsPage() {
  const items = await getAnnouncements(50);
  return (
    <>
      <PageHeader title="Comunicados" description="Avisos e novidades da Universidade Corporativa." />
      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhum comunicado no momento." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">
          {items.map((a) => (
            <Card key={a.id} className="gap-0 overflow-hidden py-0">
              {a.image_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={publicStorageUrl("course-covers", a.image_path) ?? ""} alt="" className="aspect-[3/1] w-full object-cover" />
              )}
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {a.priority === "high" && <Badge className="bg-brand-accent text-brand-accent-foreground">Importante</Badge>}
                  <span className="text-xs text-muted-foreground">{formatDate(a.publish_at)}</span>
                </div>
                <h2 className="text-lg font-semibold">📢 {a.title}</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{a.body}</p>
                {a.link_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={a.link_url} target={a.link_url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">
                      {a.link_label || "Saiba mais"} <ExternalLink />
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
