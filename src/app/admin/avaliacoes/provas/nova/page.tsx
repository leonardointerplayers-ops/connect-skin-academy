import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page";
import { SubmitButton } from "@/components/shared/form-bits";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createExamAction } from "@/actions/exams";

export const metadata: Metadata = { title: "Nova prova" };

export default async function NewExamPage({ searchParams }: PageProps<"/admin/avaliacoes/provas/nova">) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: modules }, { data: exams }] = await Promise.all([
    supabase.from("modules").select("id, title, position, course:courses(title)").is("deleted_at", null).order("position"),
    supabase.from("exams").select("module_id").is("deleted_at", null),
  ]);
  const taken = new Set((exams ?? []).map((e) => e.module_id as string));
  const available = ((modules ?? []) as unknown as { id: string; title: string; position: number; course: { title: string } | null }[]).filter(
    (m) => !taken.has(m.id),
  );
  const preselected = typeof sp.modulo === "string" ? sp.modulo : undefined;
  const error = typeof sp.erro === "string" ? sp.erro : undefined;

  return (
    <>
      <PageHeader title="Nova prova" back={{ href: "/admin/avaliacoes/provas", label: "Provas" }} />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Escolha o módulo</CardTitle>
        </CardHeader>
        <CardContent>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os módulos já possuem prova.</p>
          ) : (
            <form action={createExamAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="module_id">Módulo</Label>
                <select
                  id="module_id"
                  name="module_id"
                  defaultValue={preselected}
                  required
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                >
                  {available.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.course?.title} › {String(m.position).padStart(2, "0")} · {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Nome da prova</Label>
                <Input id="title" name="title" required minLength={2} placeholder="Ex.: Prova — Execute no Campo" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <SubmitButton pendingText="Criando…">Criar e configurar</SubmitButton>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
}
