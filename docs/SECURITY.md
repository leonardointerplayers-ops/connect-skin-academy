# Segurança

## Modelo de ameaça

A `anon key` do Supabase é pública por design. Qualquer usuário logado pode chamar a API REST diretamente com o próprio JWT, **sem passar pelo Next.js**. Por isso as regras sensíveis estão no banco, e o Next.js é uma camada adicional de validação e UX.

## Camadas

1. **RLS em todas as 33 tabelas** (`002_rls.sql`). Colaborador lê apenas: conteúdo publicado, de trilhas do seu público (grupos), e — para aulas, vídeos e materiais — de módulos **liberados** para ele (data, dias após entrada, sequência); e somente os próprios progresso, tentativas, notificações, badges e certificados.
2. **Escrita de progresso só por funções** `SECURITY DEFINER` com `search_path` fixo, que usam `auth.uid()`:
   - `fn_track_video` aceita avanço no máximo proporcional ao tempo real decorrido (pular para o fim não conta).
   - `fn_complete_lesson` exige vídeo mínimo e atividade quando configurados.
   - `fn_start_exam` / `fn_submit_exam` sorteiam, limitam tentativas e tempo e **corrigem no banco**. O gabarito (`question_options.is_correct`) não é legível por colaboradores; `fn_get_attempt` devolve enunciados sem gabarito e `fn_get_attempt_result` respeita “mostrar resultado/respostas”.
3. **Colunas protegidas**: trigger `protect_profile_columns` impede que um usuário altere papel, status, pontos, sequência, cargo etc. do próprio perfil.
4. **EXECUTE revogado** de todas as funções por padrão; liberado apenas o necessário. Funções administrativas verificam `is_admin()`; internas (`_…`) só o `service_role`.
5. **DAL no servidor** (`requireAdmin`, `assertAdmin`…) em toda página e Server Action; **Zod** valida toda entrada.
6. **Service Role Key** só em `src/lib/supabase/admin.ts` (`import "server-only"`) — usada para convites, links de senha, log de e-mails e cron. Nunca chega ao navegador.

Essas regras são verificadas automaticamente por `npm run db:validate` (49 checagens, incluindo: colaborador não lê gabarito, não altera progresso, não se promove a admin, não vê dados de outros; gestor não edita; arquivo de aula em rascunho fica inacessível).

## Uploads

- Extensão permitida + MIME compatível + tamanho, no navegador **e** no servidor (`src/config/uploads.ts`).
- Buckets com `allowed_mime_types` e `file_size_limit`.
- Upload por URL assinada de uso único; o servidor confirma o objeto antes de registrar.
- Arquivos privados só por Signed URL de curta duração e só se a aula estiver acessível.

## Conteúdo rico

HTML do editor é **sanitizado no servidor** (`sanitize-html`, allowlist de tags/atributos; imagens só https; links com `rel="noopener noreferrer nofollow"`).

## Outras proteções

- Cabeçalhos: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
- Redirecionamentos pós-login aceitam apenas caminhos internos (anti open-redirect).
- “Esqueci minha senha” não revela se o e-mail existe.
- Filtros de busca escapam caracteres especiais do PostgREST.
- Cron protegido por `CRON_SECRET`.
- `robots: noindex`.

## Auditoria

`audit_logs` registra login/logout, criação, alteração (com diff “de → para”), exclusão, publicação, upload, início/envio de prova, conclusão de aula/módulo/trilha, exportações e a rotina diária. Visível em *Admin → Auditoria*.

## LGPD

- Dados pessoais mínimos (nome, e-mail, telefone, cargo, foto).
- Exclusão definitiva de um usuário (Supabase → Authentication → Delete user) remove o perfil e o histórico em cascata — use **Desativar** para preservar histórico.
- Certificado público expõe apenas nome, programa, carga horária, data e código.

## Recomendações operacionais

- Ative **MFA** nas contas Supabase, Vercel, Resend e GitHub.
- Rotacione a service role key se houver suspeita de vazamento (*API Keys → Roll*).
- Revise periodicamente quem tem papel `admin`.
