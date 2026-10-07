import { describe, expect, it } from "vitest";
import { questionSchema } from "./exams";
import { validateUpload } from "@/config/uploads";
import { safeNextPath } from "./auth";
import { youtubeIdFromUrl } from "./content";

const base = { statement: "Qual plataforma é usada para leitura de gôndola?", category: null, difficulty: "easy" as const, explanation: null, points: 1, status: "published" as const };

describe("questionSchema", () => {
  it("aceita múltipla escolha com uma correta", () => {
    const r = questionSchema.safeParse({ ...base, type: "single_choice", options: [{ text: "Trax", is_correct: true }, { text: "Paytrack", is_correct: false }] });
    expect(r.success).toBe(true);
  });
  it("rejeita múltipla escolha com duas corretas", () => {
    const r = questionSchema.safeParse({ ...base, type: "single_choice", options: [{ text: "A", is_correct: true }, { text: "B", is_correct: true }] });
    expect(r.success).toBe(false);
  });
  it("exige ao menos uma correta em múltiplas respostas", () => {
    const r = questionSchema.safeParse({ ...base, type: "multiple_choice", options: [{ text: "A", is_correct: false }, { text: "B", is_correct: false }] });
    expect(r.success).toBe(false);
  });
  it("verdadeiro/falso tem exatamente 2 alternativas", () => {
    const r = questionSchema.safeParse({ ...base, type: "true_false", options: [{ text: "V", is_correct: true }, { text: "F", is_correct: false }, { text: "?", is_correct: false }] });
    expect(r.success).toBe(false);
  });
});

describe("validateUpload", () => {
  it("aceita PDF dentro do limite", () => {
    expect(validateUpload("material", { name: "pop.pdf", size: 1024, type: "application/pdf" }).ok).toBe(true);
  });
  it("rejeita extensão não permitida", () => {
    expect(validateUpload("material", { name: "virus.exe", size: 10, type: "application/octet-stream" }).ok).toBe(false);
  });
  it("rejeita MIME incompatível com a extensão", () => {
    expect(validateUpload("material", { name: "planilha.xlsx", size: 10, type: "application/pdf" }).ok).toBe(false);
  });
  it("rejeita arquivo acima do limite", () => {
    expect(validateUpload("avatar", { name: "foto.jpg", size: 3 * 1024 * 1024, type: "image/jpeg" }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("bloqueia open redirect", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/aulas/1")).toBe("/aulas/1");
  });
  it("extrai o id de links do YouTube", () => {
    expect(youtubeIdFromUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFromUrl("https://example.com/v.mp4")).toBeNull();
  });
});
