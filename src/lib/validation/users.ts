import { z } from "zod";
import { emailSchema } from "./auth";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .optional()
    .transform((v) => (v ? v : null));

export const collaboratorSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  email: emailSchema,
  phone: optionalText(30),
  job_title: optionalText(80),
  department: optionalText(80),
  area: optionalText(80),
  company: optionalText(80),
  role_id: z.enum(["collaborator", "manager", "admin"]).default("collaborator"),
  joined_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  group_ids: z.array(z.uuid()).default([]),
  manager_id: z
    .union([z.uuid(), z.literal(""), z.literal("none"), z.null(), z.undefined()])
    .transform((v) => (v && v !== "none" ? v : null)),
});

export const collaboratorUpdateSchema = collaboratorSchema.omit({ email: true }).extend({
  status: z.enum(["invited", "active", "inactive"]),
});

export const ownProfileSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  phone: optionalText(30),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80),
  description: optionalText(300),
});
