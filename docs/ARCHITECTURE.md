# Arquitetura — Connect Skin Academy

Universidade Corporativa interna da Connect Skin (by NIVEA • Eucerin).
Público inicial: 30–40 colaboradores de campo. Infra 100% em planos gratuitos (Supabase Free, Vercel Hobby, Resend Free), com caminho claro de crescimento.

---

## 1. Visão geral

```
                ┌──────────────────────────── Vercel ────────────────────────────┐
 Navegador ───► │ Next.js 16 (App Router)                                          │
 (celular/PC)   │  • Server Components  → leitura (RLS com o JWT do usuário)       │
                │  • Server Actions     → escrita validada (Zod) + auditoria        │
                │  • Route Handlers     → /auth/confirm, exportações, cron, sinais  │
                │  • proxy.ts           → renova sessão e protege rotas             │
                └──────────┬──────────────────────────────┬────────────────────────┘
                           │ supabase-js (anon + JWT)     │ service role (somente servidor)
                ┌──────────▼──────────── Supabase ────────▼────────────────────────┐
                │ Auth (e-mail/senha, convite, recuperação)                         │
                │ PostgreSQL: tabelas + RLS + RBAC + funções SECURITY DEFINER       │
                │   (progresso, provas, gamificação e certificados são calculados   │
                │    no banco — o cliente nunca informa "concluí" ou "acertei")     │
                │ Views de analytics (security_invoker)                             │
                │ Storage: buckets públicos (capas/avatars) e privados (Signed URL) │
                └───────────────────────────────────────────────────────────────────┘
                           │
                       Resend (e-mails transacionais) • Vercel Cron (rotina diária)
```

### Princípio de segurança central
A anon key do Supabase é pública: qualquer usuário autenticado pode chamar a API REST diretamente, sem passar pelo Next.js. Por isso **toda regra de negócio sensível vive no banco**:

| Regra | Onde |
|---|---|
| Quem vê qual conteúdo (publicado, liberado, sequencial, grupo) | RLS + `can_access_*()` |
| Concluir aula, % de vídeo mínimo | `fn_track_video`, `fn_complete_lesson` |
| Provas: sortear questões, corrigir, limitar tentativas e tempo | `fn_start_exam`, `fn_submit_exam` |
| Gabarito nunca visível ao aluno antes da correção | RLS em `questions/question_options` só para staff |
| Badges, pontos, sequência, certificado | `fn_recalc_progress`, `fn_award_badges` |
| Validação pública de certificado | `fn_verify_certificate` (expõe só nome, programa, data) |

O Next.js valida tudo de novo (Zod) para dar boas mensagens de erro, mas não é a última linha de defesa.

---

## 2. Estrutura de pastas

```
connect-skin-academy/
├── supabase/migrations/        001_schema.sql 002_rls.sql 003_storage.sql 004_seed.sql
├── scripts/                    create-admin.mjs, validate-sql.mjs (PGlite)
├── docs/                       ARCHITECTURE, SETUP, SUPABASE, STORAGE, AUTH, EMAIL, DEPLOY, SECURITY
├── public/brand/               logo
└── src/
    ├── proxy.ts                sessão + proteção de rotas
    ├── config/                 app.ts, uploads.ts (limites centrais), navigation.ts
    ├── app/
    │   ├── (auth)/             login, esqueci-senha, definir-senha
    │   ├── auth/               confirm (route handler), signout
    │   ├── (app)/              área do colaborador (inicio, trilhas, modulos, aulas, provas, perfil…)
    │   ├── admin/              painel administrativo
    │   ├── certificados/[codigo]  validação pública
    │   └── api/                cron, exportações, upload (assinatura), tracking
    ├── components/
    │   ├── ui/                 shadcn/ui
    │   ├── layout/             sidebars, header, brand
    │   ├── learning/           cards de trilha/módulo, player, progresso
    │   ├── admin/              editores, tabelas, DnD, upload
    │   └── charts/             gráficos (Recharts)
    ├── lib/
    │   ├── supabase/           server.ts, client.ts, admin.ts, proxy.ts
    │   ├── auth/               dal.ts (getCurrentUser, requireAdmin…)
    │   ├── video/              VideoProvider + implementações
    │   ├── storage/            validação, signed URLs
    │   ├── email/              Resend + templates
    │   ├── analytics/          health score, insights (regras), agregações
    │   └── validation/         schemas Zod
    ├── services/               acesso a dados por domínio (courses, exams, users…)
    ├── actions/                Server Actions por domínio
    └── types/                  tipos de domínio
```

---

## 3. Modelo de dados

```
roles ─┐
       └─< profiles >─< group_members >─ groups ─< course_groups >─ courses
                │                                                    │
                │                                  ┌─────────────────┤
                │                                  │                 │
                ├─< enrollments >──────────────────┘          modules ─< module_competencies >─ competencies
                │                                               │  │
                ├─< course_progress                             │  └─ exams ─< exam_questions >─ questions ─< question_options
                ├─< module_progress                          lessons ─< lesson_materials >─ materials
                ├─< lesson_progress                             │
                ├─< exam_attempts ─< exam_answers               └── videos
                ├─< user_badges >─ badges
                ├─< point_events
                ├─< daily_activity
                ├─< notifications
                ├─< certificates
                └─< audit_logs
announcements · app_settings · email_logs
```

Decisões:
* **Hierarquia**: Trilha (course) → Módulo → Aula → (vídeo, texto rico, materiais, atividade) → Prova do módulo.
* **Biblioteca reutilizável**: `materials` é independente; `lesson_materials` liga um arquivo a N aulas.
* **Banco de questões reutilizável**: `questions` independentes; `exam_questions` liga a provas. Prova dinâmica: `selection_mode = 'random'` + `question_count` + filtros de categoria/dificuldade.
* **Snapshot da tentativa**: `exam_attempts.question_ids` guarda as questões sorteadas; todas as tentativas são preservadas.
* **Status de conteúdo**: `draft | published | archived` em trilhas, módulos, aulas, provas e questões.
* **Soft delete** (`deleted_at`) em conteúdo e perfis; histórico de progresso e provas nunca é apagado.
* **Desnormalização controlada**: `lesson_progress` guarda `module_id` e `course_id` para analytics rápidos.
* **Preparado para crescer**: `organization_id` não foi criado (multiempresa fora do escopo), mas todas as consultas passam por `services/` e funções SQL, facilitando adicioná-lo.

---

## 4. Fluxos principais

**Convite** — Admin cadastra → Server Action valida → `auth.admin.generateLink('invite')` cria o usuário (trigger cria `profiles`) → e-mail Resend com botão “ACESSAR PLATAFORMA” → `/auth/confirm?token_hash=…&type=invite` → `verifyOtp` cria a sessão → `/definir-senha` → início. Sem Resend configurado, o painel mostra o link para copiar e avisa que o e-mail **não** foi enviado.

**Estudo** — Início → “Continue de onde parou” → aula → player envia sinais a cada ~15s (`fn_track_video`) e tempo de estudo (`fn_track_study_time`) → ao atingir o % exigido a aula pode ser concluída → `fn_recalc_progress` atualiza módulo/trilha, badges, pontos, notificações e certificado.

**Prova** — `fn_start_exam` verifica liberação, tentativas, sorteia questões e devolve enunciados **sem gabarito** → respostas → `fn_submit_exam` corrige no banco, registra acertos/erros/tempo → resultado com feedback conforme configuração.

**Liberação** — imediata, em data, ou X dias após `profiles.joined_at`; opcionalmente sequencial (módulo anterior concluído).

**Rotina diária (Vercel Cron)** — lembretes de estudo para inativos, aviso de provas pendentes, notificação de módulos liberados por data.

---

## 5. Autenticação e autorização

* Supabase Auth com e-mail/senha; sessão em cookies httpOnly via `@supabase/ssr`.
* `proxy.ts` renova a sessão a cada requisição e redireciona não autenticados.
* `lib/auth/dal.ts` (Data Access Layer) — `getCurrentUser()`, `requireUser()`, `requireStaff()`, `requireAdmin()` — usado em toda página e Server Action.
* **RBAC** com 3 papéis em `roles`: `admin` (gerencia tudo), `manager` (gestor: lê colaboradores, analytics e relatórios), `collaborator`.
* RLS usa `public.current_role()` (SECURITY DEFINER, `search_path` fixo) para evitar recursão.
* Service Role Key só em `lib/supabase/admin.ts` (marcado `server-only`), usada para convites e geração de links.

---

## 6. Storage

| Bucket | Visibilidade | Conteúdo | Leitura do aluno |
|---|---|---|---|
| `course-covers` | público | capas de trilhas e imagens de comunicados | URL pública |
| `module-covers` | público | capas/thumbnail de módulos | URL pública |
| `avatars` | público | fotos de perfil (`{userId}/…`) | URL pública |
| `lesson-materials` | privado | PDFs, planilhas, documentos, ZIP | Signed URL (10 min) se a aula for acessível |
| `documents` | privado | documentos gerais da biblioteca | Signed URL se ligado a aula acessível |
| `video-assets` | privado | vídeos e thumbnails | Signed URL (2 h) se a aula for acessível |

* Upload direto do navegador para o Storage com **URL de upload assinada** gerada no servidor depois de validar tipo e tamanho (evita o limite de corpo das Server Actions e da Vercel) e com barra de progresso real (XHR).
* Limites centralizados em `src/config/uploads.ts`, espelhados em `file_size_limit`/`allowed_mime_types` dos buckets.
* Capas e avatars são públicos por desempenho (otimização de imagem e cache) — os caminhos usam UUID. Material de treinamento é sempre privado.

---

## 7. Vídeo

```ts
interface VideoProvider {
  id: 'supabase' | 'youtube' | 'external' | …
  getPlayback(video): Promise<{ kind: 'file' | 'youtube'; src: string }>
}
```

* `SupabaseVideoProvider` — arquivo no bucket `video-assets` servido via Signed URL; player próprio (play/pause, volume, tela cheia, velocidade, timeline).
* `ExternalUrlVideoProvider` — MP4/WebM hospedado em outro lugar (mesmo player).
* `YouTubeVideoProvider` — vídeo não listado; usa a IFrame API para medir progresso.
* Novos provedores (Cloudflare Stream, Mux, Vimeo) = nova classe registrada em `lib/video/registry.ts`; o banco já guarda `provider` + `provider_asset_id`.
* **Atenção ao plano Free**: limite de 50 MB por arquivo e 1 GB de Storage. Ver STORAGE.md.

O progresso nunca é aceito “no grito”: `fn_track_video` só aceita avanço plausível (no máximo o tempo real decorrido desde o último sinal + margem), registra ponto atual, máximo assistido e % e marca `video_completed_at` quando atinge o % exigido pela aula (padrão 90%).

---

## 8. Analytics e inteligência

Camadas:
1. **Eventos brutos** — `lesson_progress` (views, tempo, %), `daily_activity` (tempo por dia), `exam_attempts`/`exam_answers`, `audit_logs`.
2. **Views SQL** (`security_invoker`, só staff enxerga tudo):
   * `v_user_learning_summary` — progresso, aulas/módulos concluídos, nota média, tentativas, último acesso, tempo estudado, atraso.
   * `v_module_stats` — matriculados, concluídos, pendentes, nota média, aprovação, tentativas médias.
   * `v_lesson_stats` — acessos, visitantes únicos, conclusões, abandono.
   * `v_question_stats` — respostas, acertos, erros, % de acerto por questão.
   * `v_exam_stats`.
3. **Regras em TypeScript** (`lib/analytics/`):
   * **Learning Health Score** (0–100): progresso 35% • recência 25% • conclusões/ritmo 10% • notas 20% • tentativas 10% → 🟢 ≥70 • 🟡 40–69 • 🔴 <40. Indicador de engajamento educacional — **não** é avaliação profissional.
   * **Alertas e insights** gerados por regras com dados reais (“5 colaboradores não acessam há mais de 7 dias”, “A questão 07 tem 42% de acerto”).
   * Interface `InsightProvider` permite plugar IA no futuro sem mudar telas.
4. **Exportação** CSV e Excel (`exceljs`) via Route Handler autenticado.

Desempenho: 40 usuários × ~20 aulas ≈ 800 linhas de progresso — as views respondem em milissegundos com os índices criados. Listas têm paginação; nenhuma página carrega “tudo”.

---

## 9. Decisões de framework

* **Next.js 16** com `cacheComponents` **desligado**. Praticamente toda página é autenticada e filtrada por RLS do usuário; o modelo dinâmico clássico (render por requisição + `revalidatePath` após mutações + `React.cache` para deduplicar) é mais simples e previsível para este volume. Reavaliar com >1.000 usuários.
* `proxy.ts` (substitui `middleware.ts` no Next 16).
* Tipos do banco: tipos de domínio escritos à mão em `src/types`; depois de criar o projeto é possível gerar tipos oficiais com `npx supabase gen types` (ver SUPABASE.md).

## 10. Preparado para o futuro (não implementado)

Multiempresa (`organization_id` + RLS por tenant), SSO (SAML no Supabase Pro), API pública, cobrança, IA (resumos, tutor, geração de questões via `InsightProvider`/`AiProvider`), questões discursivas com correção manual (tipo `essay` já existe no schema e é bloqueado na UI).
