"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SortableList } from "./sortable-list";
import { QuestionEditor } from "./question-editor";
import { linkQuestionsAction, searchQuestionsForExamAction, unlinkQuestionAction } from "@/actions/exams";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/config/app";
import type { Question } from "@/types/domain";

type Found = Awaited<ReturnType<typeof searchQuestionsForExamAction>>[number];

function BankDialog({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const search = () => startTransition(async () => setResults(await searchQuestionsForExamAction(examId, term)));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setSelected(new Set());
          search();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Search /> Do banco de questões
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar do banco</DialogTitle>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Texto ou número da questão" />
          <Button type="submit" variant="outline" disabled={pending}>
            Buscar
          </Button>
        </form>
        <ul className="max-h-96 space-y-1.5 overflow-y-auto">
          {results.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhuma questão disponível.</li>}
          {results.map((q) => (
            <li key={q.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-secondary/50">
                <Checkbox
                  checked={selected.has(q.id)}
                  onCheckedChange={(c) =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (c) n.add(q.id);
                      else n.delete(q.id);
                      return n;
                    })
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0 space-y-1">
                  <span className="block text-sm">
                    <span className="font-mono text-xs text-muted-foreground">Q-{String(q.number).padStart(3, "0")} </span>
                    {q.statement}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                    <Badge variant="outline">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
                    {q.category && <Badge variant="secondary">{q.category}</Badge>}
                    {q.status !== "published" && <Badge variant="outline">Rascunho</Badge>}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            disabled={pending || selected.size === 0}
            onClick={() =>
              startTransition(async () => {
                const res = await linkQuestionsAction(examId, [...selected]);
                if (res.ok) {
                  toast.success(res.message);
                  setOpen(false);
                } else toast.error(res.error);
              })
            }
          >
            Adicionar {selected.size || ""} questão(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExamQuestions({
  examId,
  questions,
  modules,
  categories,
}: {
  examId: string;
  questions: Question[];
  modules: { id: string; title: string; position: number }[];
  categories: string[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus /> Nova questão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova questão</DialogTitle>
            </DialogHeader>
            <QuestionEditor
              modules={modules}
              categories={categories}
              linkToExamId={examId}
              onSaved={() => {
                setNewOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
        <BankDialog examId={examId} />
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma questão vinculada.</p>
      ) : (
        <SortableList
          items={questions}
          kind="exam_questions"
          parentId={examId}
          render={(q, i) => (
            <div className="flex items-start gap-3 py-2.5 pr-2">
              <span className="mt-0.5 w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <Link href={`/admin/avaliacoes/questoes/${q.id}`} className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm hover:underline">{q.statement}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Q-{String(q.number).padStart(3, "0")} · {QUESTION_TYPE_LABELS[q.type]} · {DIFFICULTY_LABELS[q.difficulty]}
                  {q.category ? ` · ${q.category}` : ""} · {Number(q.points)} pt
                  {q.status !== "published" && " · não publicada (fica fora da prova)"}
                </p>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remover da prova"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await unlinkQuestionAction(examId, q.id);
                    if (res.ok) toast.success(res.message);
                    else toast.error(res.error);
                  })
                }
              >
                <X />
              </Button>
            </div>
          )}
        />
      )}
    </div>
  );
}
