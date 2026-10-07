# Deploy — GitHub → Vercel → Supabase

## 1. GitHub

```bash
git add -A
git commit -m "Connect Skin Academy"
git remote add origin https://github.com/<org>/connect-skin-academy.git
git push -u origin main
```

Repositório **privado**. `.env.local` está no `.gitignore` — confira que nenhuma chave foi commitada.

## 2. Vercel

1. <https://vercel.com/new> → *Import Git Repository* → selecione o repositório.
2. Framework: **Next.js** (detectado). Build: `next build`. Node 22.
3. *Environment Variables* (Production e Preview):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key (**sem** `NEXT_PUBLIC_`) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | ver [EMAIL.md](EMAIL.md) |
| `NEXT_PUBLIC_APP_URL` | `https://academy.suaempresa.com.br` |
| `CRON_SECRET` | segredo aleatório (a Vercel o envia ao cron como `Authorization: Bearer …`) |

4. **Deploy**.

## 3. Domínio

Sugestões: `academy.suaempresa.com.br`, `universidade.suaempresa.com.br` ou `treinamento.suaempresa.com.br`.

1. Vercel → *Project → Settings → Domains → Add* → `academy.suaempresa.com.br`.
2. No DNS da empresa: **CNAME** `academy` → `cname.vercel-dns.com` (a Vercel mostra o valor exato).
3. HTTPS é emitido automaticamente.
4. Atualize `NEXT_PUBLIC_APP_URL` na Vercel e faça **Redeploy**.
5. Supabase → *Authentication → URL Configuration*: Site URL = domínio novo; Redirect URLs inclui `https://academy.suaempresa.com.br/**`.

## 4. Rotina diária (Cron)

`vercel.json` agenda `GET /api/cron/daily` todo dia às 11:00 UTC (08:00 de Brasília): liberações programadas, lembretes de estudo e provas pendentes. Confira em *Settings → Cron Jobs*. Teste manual:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://academy.suaempresa.com.br/api/cron/daily
```

## 5. Testar em produção

- Configurações → **Integrações** todas verdes.
- Comunicação → **e-mail de teste**.
- Convidar um colaborador de teste e fazer o fluxo completo (aula → prova → resultado).

## Custos

| Serviço | Plano inicial | Observação |
|---|---|---|
| Supabase | Free | Pro (US$ 25/mês) se vídeos forem hospedados no Supabase ou para backups diários |
| Resend | Free | Pro só se passar de 100 e-mails/dia |
| Vercel | **Atenção** | O plano **Hobby** é gratuito, mas os termos da Vercel o restringem a **uso pessoal/não comercial**. Uma plataforma interna de empresa é uso comercial → o adequado é **Vercel Pro (US$ 20/mês por membro)**. Confirme os termos vigentes antes de decidir. O app também roda em qualquer host Node.js (`npm run build && npm start`). |

Valores aproximados — confira as páginas de preço de cada serviço.
