/**
 * Configuração central de uploads. Os limites daqui são validados no
 * navegador e no servidor, e espelham os buckets em
 * supabase/migrations/003_storage.sql (file_size_limit / allowed_mime_types).
 * Ao alterar um limite, altere também o bucket correspondente.
 */

export const MB = 1024 * 1024;

export type BucketId =
  | "course-covers"
  | "module-covers"
  | "avatars"
  | "lesson-materials"
  | "documents"
  | "video-assets";

export const PUBLIC_BUCKETS: readonly BucketId[] = ["course-covers", "module-covers", "avatars"];

export type MaterialKind =
  | "pdf"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "archive"
  | "image"
  | "video"
  | "link"
  | "other";

interface FileTypeRule {
  kind: MaterialKind;
  mimes: string[];
}

/** Extensões aceitas e seus tipos MIME válidos. */
export const FILE_TYPES: Record<string, FileTypeRule> = {
  pdf: { kind: "pdf", mimes: ["application/pdf"] },
  xlsx: { kind: "spreadsheet", mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] },
  xls: { kind: "spreadsheet", mimes: ["application/vnd.ms-excel"] },
  csv: { kind: "spreadsheet", mimes: ["text/csv", "application/vnd.ms-excel", "text/plain"] },
  docx: { kind: "document", mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] },
  doc: { kind: "document", mimes: ["application/msword"] },
  txt: { kind: "document", mimes: ["text/plain"] },
  pptx: { kind: "presentation", mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] },
  ppt: { kind: "presentation", mimes: ["application/vnd.ms-powerpoint"] },
  zip: { kind: "archive", mimes: ["application/zip", "application/x-zip-compressed"] },
  jpg: { kind: "image", mimes: ["image/jpeg"] },
  jpeg: { kind: "image", mimes: ["image/jpeg"] },
  png: { kind: "image", mimes: ["image/png"] },
  webp: { kind: "image", mimes: ["image/webp"] },
  avif: { kind: "image", mimes: ["image/avif"] },
  mp4: { kind: "video", mimes: ["video/mp4"] },
  webm: { kind: "video", mimes: ["video/webm"] },
  mov: { kind: "video", mimes: ["video/quicktime"] },
};

const videoMaxMb = Number(process.env.NEXT_PUBLIC_VIDEO_MAX_UPLOAD_MB ?? 50);

export interface UploadProfile {
  bucket: BucketId;
  maxBytes: number;
  extensions: string[];
  label: string;
}

export const UPLOAD_PROFILES = {
  courseCover: {
    bucket: "course-covers",
    maxBytes: 5 * MB,
    extensions: ["jpg", "jpeg", "png", "webp", "avif"],
    label: "Imagem (JPG, PNG, WebP) até 5 MB",
  },
  moduleCover: {
    bucket: "module-covers",
    maxBytes: 5 * MB,
    extensions: ["jpg", "jpeg", "png", "webp", "avif"],
    label: "Imagem (JPG, PNG, WebP) até 5 MB",
  },
  announcementImage: {
    bucket: "course-covers",
    maxBytes: 5 * MB,
    extensions: ["jpg", "jpeg", "png", "webp"],
    label: "Imagem (JPG, PNG, WebP) até 5 MB",
  },
  avatar: {
    bucket: "avatars",
    maxBytes: 2 * MB,
    extensions: ["jpg", "jpeg", "png", "webp"],
    label: "Foto (JPG, PNG, WebP) até 2 MB",
  },
  material: {
    bucket: "lesson-materials",
    maxBytes: 50 * MB,
    extensions: ["pdf", "xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt", "zip", "txt", "jpg", "jpeg", "png", "webp"],
    label: "PDF, planilhas, documentos, apresentações, ZIP ou imagens até 50 MB",
  },
  document: {
    bucket: "documents",
    maxBytes: 50 * MB,
    extensions: ["pdf", "xlsx", "xls", "csv", "docx", "doc", "pptx", "ppt", "zip", "txt", "jpg", "jpeg", "png", "webp"],
    label: "PDF, planilhas, documentos, apresentações, ZIP ou imagens até 50 MB",
  },
  video: {
    bucket: "video-assets",
    maxBytes: (Number.isFinite(videoMaxMb) && videoMaxMb > 0 ? videoMaxMb : 50) * MB,
    extensions: ["mp4", "webm", "mov"],
    label: `Vídeo (MP4, WebM, MOV) até ${Number.isFinite(videoMaxMb) && videoMaxMb > 0 ? videoMaxMb : 50} MB`,
  },
  videoThumbnail: {
    bucket: "video-assets",
    maxBytes: 5 * MB,
    extensions: ["jpg", "jpeg", "png", "webp"],
    label: "Imagem (JPG, PNG, WebP) até 5 MB",
  },
} as const satisfies Record<string, UploadProfile>;

export type UploadProfileId = keyof typeof UPLOAD_PROFILES;

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : "";
}

export function kindFromFileName(fileName: string): MaterialKind {
  return FILE_TYPES[getExtension(fileName)]?.kind ?? "other";
}

export type UploadValidation = { ok: true; ext: string; mime: string } | { ok: false; error: string };

/** Valida nome, MIME declarado e tamanho de um arquivo contra um perfil. */
export function validateUpload(
  profileId: UploadProfileId,
  file: { name: string; size: number; type: string },
): UploadValidation {
  const profile: UploadProfile = UPLOAD_PROFILES[profileId];
  const ext = getExtension(file.name);
  if (!(profile.extensions as readonly string[]).includes(ext)) {
    return { ok: false, error: `Formato .${ext || "?"} não permitido. Aceitos: ${profile.extensions.join(", ")}.` };
  }
  const rule = FILE_TYPES[ext];
  const mime = file.type || rule.mimes[0];
  if (!rule.mimes.includes(mime)) {
    return { ok: false, error: `O conteúdo do arquivo (${mime}) não corresponde à extensão .${ext}.` };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (file.size > profile.maxBytes) {
    return { ok: false, error: `Arquivo maior que o limite de ${formatBytes(profile.maxBytes)}.` };
  }
  return { ok: true, ext, mime };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1).replace(".", ",")} MB`;
  return `${(bytes / (1024 * MB)).toFixed(2).replace(".", ",")} GB`;
}

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  pdf: "PDF",
  spreadsheet: "Planilha",
  document: "Documento",
  presentation: "Apresentação",
  archive: "Arquivo compactado",
  image: "Imagem",
  video: "Vídeo",
  link: "Link",
  other: "Outro",
};
