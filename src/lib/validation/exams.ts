import { z } from "zod";

const bool = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((v) => v === true || v === "on" || v === "true");

const intOrNull = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), `Use um número entre ${min} e ${max}.`);

export const examSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o nome da prova.").max(160),
    description: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
    instructions: z.string().trim().max(4000).optional().nullable().transform((v) => v || null),
    passing_score: intOrNull(0, 100).refine((v) => v !== null, "Informe a nota mínima."),
    question_count: intOrNull(1, 200),
    max_attempts: intOrNull(1, 50),
    time_limit_minutes: intOrNull(1, 600),
    selection_mode: z.enum(["fixed", "random"]),
    random_categories: z.array(z.string().trim().min(1).max(80)).default([]),
    random_difficulties: z.array(z.enum(["easy", "medium", "hard"])).default([]),
    shuffle_questions: bool,
    shuffle_options: bool,
    show_result: bool,
    show_answers: z.enum(["never", "after_submit", "after_pass", "after_last_attempt"]),
    show_explanations: bool,
    is_required: bool,
    points: intOrNull(0, 10000).transform((v) => v ?? 50),
    status: z.enum(["draft", "published", "archived"]),
  })
  .refine((v) => v.selection_mode !== "random" || v.question_count !== null, {
    path: ["question_count"],
    message: "Na prova dinâmica, informe quantas questões sortear.",
  });

export const optionSchema = z.object({
  id: z.uuid().optional(),
  text: z.string().trim().min(1, "Alternativa vazia.").max(1000),
  is_correct: z.boolean(),
});

export const questionSchema = z
  .object({
    statement: z.string().trim().min(3, "Escreva o enunciado.").max(4000),
    type: z.enum(["single_choice", "true_false", "multiple_choice"]),
    category: z.string().trim().max(80).optional().nullable().transform((v) => v || null),
    difficulty: z.enum(["easy", "medium", "hard"]),
    explanation: z.string().trim().max(4000).optional().nullable().transform((v) => v || null),
    points: z.coerce.number().positive("Pontuação deve ser maior que zero.").max(100),
    module_id: z.uuid().optional().nullable().or(z.literal("").transform(() => null)),
    status: z.enum(["draft", "published", "archived"]),
    options: z.array(optionSchema).min(2, "Inclua pelo menos 2 alternativas.").max(10, "Máximo de 10 alternativas."),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.is_correct).length;
    if (correct === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "Marque a(s) alternativa(s) correta(s)." });
    if ((q.type === "single_choice" || q.type === "true_false") && correct !== 1) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Este tipo de questão deve ter exatamente 1 alternativa correta." });
    }
    if (q.type === "true_false" && q.options.length !== 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Verdadeiro/Falso deve ter exatamente 2 alternativas." });
    }
  });

export type QuestionInput = z.input<typeof questionSchema>;
