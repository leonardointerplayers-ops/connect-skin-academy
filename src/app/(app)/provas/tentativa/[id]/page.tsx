import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ExamRunner } from "@/components/learning/exam-runner";
import { getAttemptForTaking } from "@/services/exams";

export const metadata: Metadata = { title: "Prova em andamento" };

export default async function AttemptPage({ params }: PageProps<"/provas/tentativa/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const attempt = await getAttemptForTaking(id);
  if (!attempt) notFound();
  if (attempt.status !== "in_progress") redirect(`/provas/resultado/${id}`);
  return <ExamRunner attempt={attempt} />;
}
