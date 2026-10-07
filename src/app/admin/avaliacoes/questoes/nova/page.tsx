import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { QuestionPageClient } from "@/components/admin/question-page-client";
import { listQuestionCategories } from "@/services/exams";
import { listModulesAdmin } from "@/services/content";
import { requireAdmin } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Nova questão" };

export default async function NewQuestionPage() {
  await requireAdmin();
  const [categories, modules] = await Promise.all([listQuestionCategories(), listModulesAdmin()]);
  return (
    <>
      <PageHeader title="Nova questão" back={{ href: "/admin/avaliacoes/questoes", label: "Banco de questões" }} />
      <Card className="max-w-3xl">
        <CardContent>
          <QuestionPageClient modules={modules.map((m) => ({ id: m.id, title: m.title, position: m.position }))} categories={categories} />
        </CardContent>
      </Card>
    </>
  );
}
