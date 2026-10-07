"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Plus, Square, SquareCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveQuestionAction } from "@/actions/exams";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@/config/app";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/domain";

type QType = "single_choice" | "true_false" | "multiple_choice";
interface Opt {
  key: string;
  id?: string;
  text: string;
  is_correct: boolean;
}

const TF: Opt[] = [
  { key: "t", text: "Verdadeiro", is_correct: true },
  { key: "f", text: "Falso", is_correct: false },
];

export function QuestionEditor({
  question,
  modules,
  categories,
  linkToExamId,
  onSaved,
  answersCount = 0,
}: {
  question?: Question;
  modules: { id: string; title: string; position: number }[];
  categories: string[];
  linkToExamId?: string;
  onSaved?: (id: string) => void;
  answersCount?: number;
}) {
  const [type, setType] = useState<QType>((question?.type as QType) ?? "single_choice");
  const [statement, setStatement] = useState(question?.statement ?? "");
  const [category, setCategory] = useState(question?.category ?? "");
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? "medium");
  const [points, setPoints] = useState(String(question?.points ?? 1));
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [moduleId, setModuleId] = useState(question?.module_id ?? "none");
  const [status, setStatus] = useState(question?.status ?? "published");
  const [options, setOptions] = useState<Opt[]>(
    question?.question_options?.length
      ? question.question_options.map((o) => ({ key: o.id, id: o.id, text: o.text, is_correct: o.is_correct }))
      : [
          { key: crypto.randomUUID(), text: "", is_correct: true },
          { key: crypto.randomUUID(), text: "", is_correct: false },
          { key: crypto.randomUUID(), text: "", is_correct: false },
          { key: crypto.randomUUID(), text: "", is_correct: false },
        ],
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const locked = answersCount > 0;

  function changeType(t: QType) {
    setType(t);
    if (t === "true_false" && !locked) setOptions(TF.map((o) => ({ ...o, key: crypto.randomUUID() })));
    if (t === "single_choice") {
      const first = options.findIndex((o) => o.is_correct);
      setOptions(options.map((o, i) => ({ ...o, is_correct: i === (first < 0 ? 0 : first) })));
    }
  }

  function toggleCorrect(key: string) {
    setOptions((prev) =>
      prev.map((o) => (type === "multiple_choice" ? (o.key === key ? { ...o, is_correct: !o.is_correct } : o) : { ...o, is_correct: o.key === key })),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveQuestionAction(
        question?.id ?? null,
        {
          statement,
          type,
          category,
          difficulty,
          explanation,
          points: Number(points),
          module_id: moduleId === "none" ? null : moduleId,
          status,
          options: options.map((o) => ({ id: o.id, text: o.text, is_correct: o.is_correct })),
        },
        linkToExamId,
      );
      if (res.ok && res.data) {
        toast.success(res.message);
        onSaved?.(res.data.id);
      } else if (!res.ok) setError(res.error);
    });
  }

  const Marker = type === "multiple_choice" ? { on: SquareCheck, off: Square } : { on: CheckCircle2, off: Circle };

  return (
    <div className="space-y-5">
      {locked && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Esta questão já foi respondida {answersCount} vez(es). Você pode ajustar textos e o gabarito; para incluir ou remover
          alternativas, duplique a questão.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="q-statement">Pergunta *</Label>
        <Textarea id="q-statement" value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} placeholder="Escreva o enunciado…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => changeType(v as QType)} disabled={locked}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["single_choice", "true_false", "multiple_choice"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {QUESTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
              <SelectItem value="essay" disabled>
                {QUESTION_TYPE_LABELS.essay}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dificuldade</Label>
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-category">Categoria</Label>
          <Input id="q-category" list="q-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="q-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-points">Pontuação</Label>
          <Input id="q-points" type="number" min={0.5} step={0.5} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Módulo relacionado</Label>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {String(m.position).padStart(2, "0")} · {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published">Publicada (disponível para provas)</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="archived">Arquivada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Alternativas — clique no marcador para indicar {type === "multiple_choice" ? "as corretas" : "a correta"}</Label>
        <ul className="space-y-2">
          {options.map((o, i) => (
            <li key={o.key} className={cn("flex items-center gap-2 rounded-lg border p-2", o.is_correct && "border-success/50 bg-success/5")}>
              <button type="button" onClick={() => toggleCorrect(o.key)} aria-label={o.is_correct ? "Correta" : "Marcar como correta"} className="p-1">
                {o.is_correct ? <Marker.on className="size-5 text-success" /> : <Marker.off className="size-5 text-muted-foreground" />}
              </button>
              <Input
                value={o.text}
                onChange={(e) => setOptions((prev) => prev.map((x) => (x.key === o.key ? { ...x, text: e.target.value } : x)))}
                placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
                className="border-0 shadow-none focus-visible:ring-0"
                readOnly={type === "true_false" && locked}
              />
              {type !== "true_false" && options.length > 2 && !(locked && o.id) && (
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover alternativa" onClick={() => setOptions((prev) => prev.filter((x) => x.key !== o.key))}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {type !== "true_false" && options.length < 10 && !locked && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOptions((p) => [...p, { key: crypto.randomUUID(), text: "", is_correct: false }])}>
            <Plus /> Adicionar alternativa
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="q-expl">Por que essa resposta está correta? (feedback)</Label>
        <Textarea id="q-expl" value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} placeholder="Mostrado após a prova quando configurado." />
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={pending}>
        {pending ? "Salvando…" : "Salvar questão"}
      </Button>
    </div>
  );
}
