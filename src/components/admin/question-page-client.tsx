"use client";

import { useRouter } from "next/navigation";
import { QuestionEditor } from "./question-editor";
import type { Question } from "@/types/domain";

export function QuestionPageClient({
  question,
  modules,
  categories,
  answersCount,
}: {
  question?: Question;
  modules: { id: string; title: string; position: number }[];
  categories: string[];
  answersCount?: number;
}) {
  const router = useRouter();
  return (
    <QuestionEditor
      question={question}
      modules={modules}
      categories={categories}
      answersCount={answersCount}
      onSaved={(id) => {
        if (!question) router.push(`/admin/avaliacoes/questoes/${id}`);
        else router.refresh();
      }}
    />
  );
}
