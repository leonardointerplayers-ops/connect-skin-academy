# Supabase

## 1. Criar o projeto

1. Acesse <https://supabase.com/dashboard> → **New project**.
2. Organização da empresa, nome `connect-skin-academy`, **senha forte do banco** (guarde num cofre), região **South America (São Paulo)**.
3. Plano **Free**.

## 2. Copiar as chaves

*Project Settings → API* (ou *API Keys*):

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon** (ou **publishable**) → `NEXT_PUBLIC_SUPABASE_ANON_KEY` — pública, protegida pela RLS.
- **service_role** (ou **secret**) → `SUPABASE_SERVICE_ROLE_KEY` — **nunca** exponha no navegador, no GitHub ou em prints.

## 3. Configurar Auth

*Authentication → Sign In / Providers*:

- **Email**: habilitado.
- **Allow new users to sign up**: **desligado** (o acesso é só por convite).
- **Confirm email**: pode ficar ligado (o convite já confirma o e-mail).

*Authentication → URL Configuration*:

- **Site URL**: `https://academy.suaempresa.com.br` (em dev: `http://localhost:3000`).
- **Redirect URLs**: adicione `http://localhost:3000/**` e `https://academy.suaempresa.com.br/**`.

*Authentication → Emails → Templates* — só necessário se você **não** usar o Resend (a recuperação de senha cai no e-mail nativo do Supabase). No template **Reset Password**, troque o link por:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/definir-senha">Redefinir senha</a>
```

> O e-mail nativo do Supabase tem limite baixo de envio por hora e é indicado só para testes. Com o Resend configurado, convites e recuperação de senha usam a Resend e esses templates não são usados.

## 4. Executar as migrações

*SQL Editor → New query*, cole e rode **um arquivo por vez, nesta ordem**:

| Arquivo | O que cria |
|---|---|
| `supabase/migrations/001_schema.sql` | Tabelas, índices, triggers, funções de negócio (progresso, provas, gamificação, certificados) e views de analytics |
| `supabase/migrations/002_rls.sql` | RLS em todas as tabelas, RBAC e permissões de execução das funções |
| `supabase/migrations/003_storage.sql` | 6 buckets com limites/MIME e policies do Storage |
| `supabase/migrations/004_seed.sql` | Configurações, badges, grupos, competências, a Trilha de Onboarding (4 módulos, 17 aulas) e 4 provas com 19 questões |

Se algo falhar, a mensagem indica a linha. As migrações foram validadas com `npm run db:validate` (Postgres 17 embutido + stubs de `auth`/`storage`).

## 5. Conferir

- *Table Editor*: tabelas `courses` (1), `modules` (4), `lessons` (17), `exams` (4), `questions` (19).
- *Storage*: buckets `course-covers`, `module-covers`, `avatars` (públicos) e `lesson-materials`, `documents`, `video-assets` (privados).
- *Database → Functions*: `fn_start_exam`, `fn_submit_exam`, `fn_track_video` etc.

## 6. Usuários

Crie o primeiro admin com `npm run create-admin` (ver [SETUP.md](SETUP.md#5-primeiro-administrador)). Os demais são convidados pelo painel.

Papéis (`profiles.role_id`): `admin`, `manager` (gestor — só leitura de gestão) e `collaborator`.

## 7. Tipos TypeScript (opcional)

Os tipos de domínio estão escritos à mão em `src/types/domain.ts`. Para gerar os tipos oficiais:

```bash
npx supabase login
npx supabase gen types typescript --project-id <ref-do-projeto> > src/types/supabase.ts
```

## 8. Backups e manutenção

- **Plano Free não tem backups diários acessíveis.** Exporte periodicamente (*Database → Backups* no Pro, ou `pg_dump` com a connection string).
- Projetos Free **são pausados após ~7 dias sem atividade**. A rotina diária (Vercel Cron) faz consultas todo dia e evita a pausa; se ela não estiver configurada e ninguém acessar por uma semana, reative o projeto no painel.

## 9. Limites do plano Free (confira os valores atuais em supabase.com/pricing)

| Recurso | Free (aprox.) | Uso estimado (40 usuários) | Quando migrar para Pro (US$ 25/mês) |
|---|---|---|---|
| Banco | 500 MB | < 50 MB | Muito improvável |
| Storage | 1 GB | Depende de vídeos | **Vídeos enviados ao Supabase** esgotam rápido |
| Egress (transferência) | 5 GB/mês | Vídeo: 40 pessoas × 1 h ≈ 20–40 GB | **Vídeo hospedado no Supabase** estoura o Free |
| Tamanho máx. por arquivo | 50 MB | PDFs ok | Vídeos > 50 MB |
| Usuários ativos (MAU) | 50.000 | 40 | Nunca |

**Recomendação para começar grátis:** vídeos como **YouTube “Não listado”** (o player mede o progresso) e PDFs/planilhas no Supabase Storage. Ver [STORAGE.md](STORAGE.md).
