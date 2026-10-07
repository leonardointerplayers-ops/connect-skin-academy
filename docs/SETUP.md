# Setup — do zero ao primeiro acesso

Tempo estimado: 30–45 minutos. Você vai precisar de: uma conta no GitHub, no Supabase, na Vercel e (recomendado) no Resend, além de acesso ao DNS do domínio da empresa.

## 1. Requisitos locais

- Node.js 22 LTS (`node -v`)
- Git

```bash
npm install
cp .env.example .env.local
```

## 2. Supabase (banco, autenticação e arquivos)

Siga **[SUPABASE.md](SUPABASE.md)** — resumo:

1. Criar o projeto (região **South America (São Paulo)**).
2. Copiar **Project URL**, **anon/publishable key** e **service_role/secret key** para `.env.local`.
3. Em *Authentication*: desligar cadastro público, configurar Site URL e Redirect URLs.
4. No *SQL Editor*, executar **na ordem**: `001_schema.sql` → `002_rls.sql` → `003_storage.sql` → `004_seed.sql`.
5. Conferir em *Storage* que os 6 buckets foram criados.

## 3. Resend (e-mails)

Siga **[EMAIL.md](EMAIL.md)**. Sem o Resend a plataforma funciona, mas **não envia e-mails**: convites mostram o link para você copiar e enviar manualmente (a tela avisa explicitamente).

## 4. Variáveis de ambiente (`.env.local`)

| Variável | Onde obter | Obrigatória |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → `anon` (legado) ou `publishable` | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → `service_role` (legado) ou `secret` | Sim (convites) |
| `RESEND_API_KEY` | Resend → API Keys | Para e-mails |
| `RESEND_FROM_EMAIL` | Ex.: `Connect Skin Academy <academy@suaempresa.com.br>` (domínio verificado) | Para e-mails |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` local; URL pública em produção | Sim |
| `CRON_SECRET` | Gere: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Para a rotina diária |
| `NEXT_PUBLIC_VIDEO_MAX_UPLOAD_MB` | `50` no plano Free | Não |

## 5. Primeiro administrador

```bash
npm run create-admin -- voce@suaempresa.com.br "Seu Nome"
```

O script cria o usuário (ou promove um existente), define o papel **admin** e imprime um link para definir a senha. Abra o link com o app rodando (`npm run dev`).

> Alternativa sem terminal: em Supabase → Authentication → Users → *Invite user*, depois no SQL Editor:
> `update public.profiles set role_id = 'admin', status = 'active' where email = 'voce@suaempresa.com.br';`

## 6. Testar localmente

```bash
npm run dev
```

1. Entre com o admin → você cai no **Painel de gestão**.
2. *Colaboradores → Adicionar colaborador* (use um e-mail seu de teste).
3. Abra o convite, defina a senha e navegue como colaborador: Início → Trilha → Aula → Prova.
4. Volte ao painel e veja Dashboard, Analytics e Relatórios atualizados.

## 7. Verificações automáticas

```bash
npm run check   # typecheck + lint + testes + validação do banco + build
```

## 8. Deploy

Siga **[DEPLOY.md](DEPLOY.md)** (GitHub → Vercel → domínio → cron).

## Checklist pós-setup

- [ ] Login / logout / "Esqueci minha senha" funcionando
- [ ] Convite chega por e-mail (ou link exibido, se sem Resend)
- [ ] Colaborador vê só o módulo 1 liberado (sequencial)
- [ ] Upload de PDF e de capa funcionando
- [ ] Prova: tentativa, nota, histórico
- [ ] Certificado gerado ao concluir os 4 módulos e validável em `/certificados/CÓDIGO`
- [ ] Configurações → Integrações todas verdes em produção
