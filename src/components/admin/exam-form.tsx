"use client";

import { useActionState, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage, SubmitButton } from "@/components/shared/form-bits";
import { CheckField, SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "./form-fields";
import { updateExamAction } from "@/actions/exams";
import { DIFFICULTY_LABELS } from "@/config/app";
import type { Exam } from "@/types/domain";

export function ExamForm({ exam, categories }: { exam: Exam; categories: string[] }) {
  const [state, action] = useActionState(updateExamAction.bind(null, exam.id), null);
  const [mode, setMode] = useState(exam.selection_mode);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <TextField name="title" label="Nome *" defaultValue={exam.title} errors={fe?.title} required />
        <SelectField name="status" label="Status" defaultValue={exam.status} options={STATUS_OPTIONS} />
      </div>
      <TextAreaField name="description" label="Descrição" defaultValue={exam.description} rows={2} />
      <TextAreaField name="instructions" label="Instruções para o colaborador" defaultValue={exam.instructions} rows={3} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField name="passing_score" label="Nota mínima (%)" type="number" min={0} max={100} defaultValue={exam.passing_score} errors={fe?.passing_score} />
        <TextField name="max_attempts" label="Tentativas" type="number" min={1} defaultValue={exam.max_attempts} hint="Vazio = ilimitadas." />
        <TextField name="time_limit_minutes" label="Tempo (min)" type="number" min={1} defaultValue={exam.time_limit_minutes} hint="Vazio = sem limite." />
        <TextField name="points" label="Pontos ao ser aprovado" type="number" min={0} defaultValue={exam.points} />
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <SelectField
          name="selection_mode"
          label="Seleção de questões"
          value={mode}
          onValueChange={(v) => setMode(v as Exam["selection_mode"])}
          options={[
            { value: "fixed", label: "Fixa — questões vinculadas abaixo" },
            { value: "random", label: "Dinâmica — sortear do banco" },
          ]}
        />
        <TextField
          name="question_count"
          label={mode === "random" ? "Quantidade a sortear *" : "Número de questões"}
          type="number"
          min={1}
          defaultValue={exam.question_count}
          hint={mode === "random" ? "Ex.: 10 questões entre 30 disponíveis." : "Vazio = todas as vinculadas."}
          errors={fe?.question_count}
        />
        {mode === "random" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Sorteio entre as questões vinculadas a esta prova; se nenhuma estiver vinculada, sorteia de todo o banco publicado. Filtros
              vazios = sem filtro.
            </p>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Categorias</legend>
              <div className="flex flex-wrap gap-2">
                {categories.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma categoria cadastrada.</span>}
                {categories.map((c) => (
                  <label key={c} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
                    <Checkbox name="random_categories" value={c} defaultChecked={exam.random_categories.includes(c)} /> {c}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Dificuldade</legend>
              <div className="flex flex-wrap gap-2">
                {Object.entries(DIFFICULTY_LABELS).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary">
                    <Checkbox name="random_difficulties" value={v} defaultChecked={exam.random_difficulties.includes(v as never)} /> {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CheckField name="is_required" label="Prova obrigatória" description="Necessária para concluir o módulo." defaultChecked={exam.is_required} />
        <CheckField name="shuffle_questions" label="Randomizar questões" description="Ordem diferente a cada tentativa." defaultChecked={exam.shuffle_questions} />
        <CheckField name="shuffle_options" label="Randomizar alternativas" defaultChecked={exam.shuffle_options} />
        <CheckField name="show_result" label="Mostrar resultado" description="Nota, acertos e erros ao finalizar." defaultChecked={exam.show_result} />
        <CheckField name="show_explanations" label="Mostrar explicações" description="Feedback “por que está correta”." defaultChecked={exam.show_explanations} />
      </div>
      <SelectField
        name="show_answers"
        label="Mostrar respostas corretas"
        defaultValue={exam.show_answers}
        options={[
          { value: "after_submit", label: "Sempre, após cada tentativa" },
          { value: "after_pass", label: "Somente após aprovação" },
          { value: "after_last_attempt", label: "Após aprovação ou fim das tentativas" },
          { value: "never", label: "Nunca" },
        ]}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar prova</SubmitButton>
    </form>
  );
}
