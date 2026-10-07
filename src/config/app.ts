export const APP_CONFIG = {
  name: "Connect Skin Academy",
  shortName: "Academy",
  company: "Connect Skin",
  tagline: "Universidade Corporativa Connect Skin by NIVEA • Eucerin",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  pageSize: 20,
  /** Intervalo (s) entre sinais de progresso do vídeo e de tempo de estudo. */
  trackingIntervalSeconds: 15,
  /** Validade das Signed URLs (s). */
  signedUrlTtl: {
    material: 60 * 10,
    video: 60 * 60 * 2,
  },
} as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gestor",
  collaborator: "Colaborador",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
  invited: "Convidado",
  active: "Ativo",
  inactive: "Inativo",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "Múltipla escolha",
  true_false: "Verdadeiro/Falso",
  multiple_choice: "Múltiplas respostas",
  essay: "Discursiva (em breve)",
};
