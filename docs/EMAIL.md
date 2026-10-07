# E-mail (Resend)

## 1. Criar a conta

<https://resend.com> → *Sign up* (plano Free: ~3.000 e-mails/mês, 100/dia, 1 domínio — confira em resend.com/pricing).

## 2. Configurar o domínio

1. *Domains → Add Domain* → use um subdomínio, ex.: `mail.suaempresa.com.br` (não interfere no e-mail corporativo).
2. Região: São Paulo (`sa-east-1`) se disponível.
3. O Resend mostra registros DNS — adicione-os no provedor de DNS da empresa (Registro.br, Cloudflare, GoDaddy…):
   - **MX** (bounce) e **TXT SPF** em `send.mail…`
   - **TXT DKIM** (`resend._domainkey…`)
   - (recomendado) **TXT DMARC** em `_dmarc.mail…`: `v=DMARC1; p=none;`
4. Clique em *Verify*. A propagação leva de minutos a algumas horas. Só envie depois do status **Verified**.

## 3. Criar a API Key

*API Keys → Create API Key* → permissão **Sending access**, domínio do passo 2. Copie (aparece uma vez).

## 4. Variáveis

```env
RESEND_API_KEY=re_xxxxxxxxx
RESEND_FROM_EMAIL=Connect Skin Academy <academy@mail.suaempresa.com.br>
```

Em produção, cadastre ambas na Vercel (*Settings → Environment Variables*) e faça redeploy.

## 5. Testar

Painel → *Comunicação* → **Enviar e-mail de teste para mim**. O resultado (enviado/falhou + motivo) aparece em “Últimos e-mails” (tabela `email_logs`).

## Templates

`src/lib/email/templates.ts` (HTML responsivo com a identidade visual):

| Template | Quando é enviado |
|---|---|
| Convite | Cadastro / reenvio de convite |
| Recuperação de senha | “Esqueci minha senha” |
| Novo módulo | Módulo publicado com liberação imediata (para os matriculados) |
| Prova pendente | Rotina diária: aulas concluídas e prova ainda não iniciada (uma vez) |
| Resultado | Ao finalizar uma prova (se “mostrar resultado” estiver ativo) |
| Curso concluído | Conclusão da trilha (com link do certificado) |
| Lembrete de estudo | Rotina diária: N e 2N dias sem acesso (N = configuração) |
| Comunicado | Envio manual de um comunicado por e-mail |

## Comportamento honesto sem Resend

Sem `RESEND_API_KEY`/`RESEND_FROM_EMAIL`, nada é enviado: cada tentativa é registrada como **“Não enviado”** em `email_logs`, convites mostram o link para envio manual e a tela de Comunicação mostra “Inativo”.

## Volume

40 colaboradores: convites (40) + resultados e lembretes cabem com folga em 100/dia. Um comunicado por e-mail para todos usa 40 do limite diário. Se precisar de mais, Resend Pro (~US$ 20/mês, 50.000/mês).
