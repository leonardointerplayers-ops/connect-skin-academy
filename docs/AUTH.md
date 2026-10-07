# Autenticação e autorização

## Fluxos

### Convite (cadastro de colaborador)

1. Admin preenche *Colaboradores → Adicionar colaborador*.
2. Server Action valida (Zod) e chama `auth.admin.generateLink({ type: "invite" })` com a service role → o usuário é criado no Supabase Auth **sem senha**; o trigger `handle_new_user` cria o `profile` e matricula nas trilhas publicadas.
3. O servidor monta o link `APP_URL/auth/confirm?token_hash=…&type=invite&next=/definir-senha` e envia pelo Resend o e-mail **“Você foi convidado para a Universidade Corporativa”** com o botão **ACESSAR PLATAFORMA**.
4. O colaborador clica → `/auth/confirm` chama `verifyOtp` → sessão criada → `/definir-senha` → `fn_activate_me` muda o status para **ativo**.

Nenhuma senha é enviada por e-mail. O link expira em 24 h e é de uso único. Se o Resend não estiver configurado, o painel mostra o link para envio manual e diz claramente que o e-mail **não** foi enviado. *Reenviar convite* gera um novo link (tipo recovery).

### Login / logout

- `signInWithPassword`; contas **inativas** são bloqueadas e deslogadas.
- Eventos `auth.login` / `auth.logout` vão para a auditoria.
- Sessão em cookies httpOnly (`@supabase/ssr`), renovada em toda requisição pelo `src/proxy.ts`.

### Esqueci minha senha

- Com Resend: link de recuperação gerado no servidor e enviado pelo Resend (mensagem genérica — não revela se o e-mail existe).
- Sem Resend: `resetPasswordForEmail` (e-mail nativo do Supabase; configure o template conforme [SUPABASE.md](SUPABASE.md#3-configurar-auth)).

## RBAC

| Papel | Pode |
|---|---|
| `admin` | Tudo: conteúdo, usuários, provas, comunicação, configurações, auditoria |
| `manager` (Gestor) | Ler dashboard, colaboradores, analytics, relatórios, resultados e exportar — **sem editar** |
| `collaborator` | Estudar o conteúdo liberado e ver apenas os próprios dados |

O papel é verificado em três camadas:

1. **Proxy** — exige sessão em rotas privadas.
2. **DAL** (`src/lib/auth/dal.ts`) — `requireUser/requireStaff/requireAdmin` em páginas e `assertUser/assertAdmin` em Server Actions.
3. **Banco (RLS + funções)** — a última e mais importante linha de defesa (a anon key é pública; ver [SECURITY.md](SECURITY.md)).

## Desativar colaborador

*Colaborador → Desativar acesso*: `status = inactive`. O login é bloqueado (RLS também nega dados), e **todo o histórico é preservado**. Pode ser reativado.

## SSO (futuro)

Supabase suporta SAML 2.0 (plano Pro) e OAuth (Google/Microsoft). O DAL não depende do método de login, então adicionar SSO não exige mudar as telas internas.
