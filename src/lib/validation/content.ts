import { z } from "zod";

export const statusSchema = z.enum(["draft", "published", "archived"]);

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const intOrNull = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), `Use um número entre ${min} e ${max}.`);

const bool = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((v) => v === true || v === "on" || v === "true");

const storagePath = z
  .string()
  .max(500)
  .regex(/^[\w\-./]+$/, "Caminho inválido.")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const courseSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(160),
  subtitle: text(200),
  description: text(4000),
  category: text(80),
  cover_path: storagePath,
  thumbnail_path: storagePath,
  status: statusSchema,
  require_sequential: bool,
  certificate_enabled: bool,
  workload_hours: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine((v) => v === null || (v >= 0 && v <= 9999), "Carga horária inválida."),
  due_days: intOrNull(1, 3650),
  audience: z.enum(["all", "groups"]),
  group_ids: z.array(z.uuid()).default([]),
});

export const moduleSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(160),
    description: text(4000),
    category: text(80),
    cover_path: storagePath,
    thumbnail_path: storagePath,
    featured_image_path: storagePath,
    status: statusSchema,
    release_type: z.enum(["immediate", "date", "days_after_join"]),
    release_at: z
      .string()
      .optional()
      .nullable()
      // datetime-local vem sem fuso: interpretar no horário de Brasília (UTC-3).
      .transform((v) => (v ? new Date(v.length <= 16 ? `${v}:00-03:00` : v).toISOString() : null)),
    release_days: intOrNull(0, 3650),
    due_date: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
    points: intOrNull(0, 10000).transform((v) => v ?? 100),
    competency_ids: z.array(z.uuid()).default([]),
  })
  .refine((v) => v.release_type !== "date" || v.release_at, { path: ["release_at"], message: "Informe a data de liberação." })
  .refine((v) => v.release_type !== "days_after_join" || v.release_days !== null, {
    path: ["release_days"],
    message: "Informe quantos dias após a entrada.",
  });

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "Informe o título.").max(160),
  description: text(1000),
  content_html: z.string().max(200_000, "Conteúdo muito longo.").optional().nullable(),
  status: statusSchema,
  is_required: bool,
  video_required: bool,
  min_video_percent: intOrNull(1, 100).transform((v) => v ?? 90),
  activity_enabled: bool,
  activity_title: text(160),
  activity_instructions: text(4000),
  activity_requires_response: bool,
  estimated_minutes: intOrNull(1, 600),
  points: intOrNull(0, 10000).transform((v) => v ?? 10),
});

export const videoSourceSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("supabase"),
    storage_path: z.string().min(3).max(500),
    title: text(200),
    size_bytes: z.number().int().nonnegative().optional(),
    mime_type: z.string().max(100).optional(),
    duration_seconds: z.number().positive().max(60 * 60 * 12).optional().nullable(),
  }),
  z.object({
    provider: z.literal("external"),
    external_url: z.url("URL inválida.").refine((u) => u.startsWith("https://"), "Use uma URL https."),
    title: text(200),
    duration_seconds: z.number().positive().max(60 * 60 * 12).optional().nullable(),
  }),
  z.object({
    provider: z.literal("youtube"),
    external_url: z.url("URL inválida."),
    title: text(200),
    duration_seconds: z.number().positive().max(60 * 60 * 12).optional().nullable(),
  }),
]);

export function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com") || u.hostname.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
      return m?.[2] ?? null;
    }
  } catch {}
  return null;
}
