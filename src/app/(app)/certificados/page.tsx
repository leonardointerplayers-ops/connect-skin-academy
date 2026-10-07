import type { Metadata } from "next";
import Link from "next/link";
import { FileBadge, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Certificados" };

export default async function CertificatesPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select("*").eq("user_id", profile.id).order("issued_at", { ascending: false });
  const certs = (data ?? []) as { id: string; code: string; course_title: string; issued_at: string; workload_hours: number | null }[];

  return (
    <>
      <PageHeader title="Certificados" description="Emitidos automaticamente ao concluir todos os módulos de uma trilha." />
      {certs.length === 0 ? (
        <EmptyState icon={FileBadge} title="Nenhum certificado ainda" description="Conclua todos os módulos da sua trilha para receber o certificado de conclusão." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {certs.map((c) => (
            <Card key={c.id} className="py-0">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <GraduationCap className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.course_title}</p>
                  <p className="text-xs text-muted-foreground">
                    Emitido em {formatDate(c.issued_at)} · código <span className="font-mono">{c.code}</span>
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/certificados/${c.code}`}>Ver</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
