import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page";
import { AttemptResultView } from "@/components/learning/attempt-result";
import { getAttemptResult } from "@/services/exams";

export const metadata: Metadata = { title: "Tentativa" };

export default async function AdminAttemptPage({ params }: PageProps<"/admin/avaliacoes/resultados/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await getAttemptResult(id);
  if (!result) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/avaliacoes/resultados", label: "Resultados" }} eyebrow="Revisão da tentativa" title={result.exam_title} />
      <AttemptResultView result={result} />
    </>
  );
}
