# Connect Skin Academy

Universidade Corporativa da **Connect Skin by NIVEA • Eucerin** — plataforma interna de desenvolvimento e capacitação do time de campo, com área do colaborador, painel administrativo (CMS) e inteligência de gestão.

> Feita para 30–40 colaboradores em planos gratuitos (Supabase Free + Vercel + Resend Free), com arquitetura pronta para crescer.

## O que a plataforma faz

**Colaborador** — entra por convite, define a própria senha, vê "Olá, Nome 👋", continua de onde parou, assiste às aulas (vídeo com progresso medido no servidor), baixa materiais, faz atividades e provas (cronômetro, salvamento automático, feedback "por que essa resposta está correta?"), acompanha a evolução, ganha conquistas e recebe certificado com código validável em `/certificados/[codigo]`. Funciona no celular (barra inferior de navegação).

**Administrador** — cria trilhas, módulos e aulas sem tocar em código: capas, editor rico (títulos, listas, links, imagens, tabelas), vídeo (upload, YouTube ou URL), PDFs/planilhas/documentos/ZIP com barra de progresso, biblioteca reutilizável, drag & drop, duplicação, rascunho/publicado/arquivado, liberação imediata/por data/X dias após a entrada, conclusão sequencial, provas fixas ou dinâmicas (sorteio por categoria/dificuldade), banco de questões, comunicados, banners, grupos, competências, configurações e auditoria.

**Gestor** — dashboard executivo, visão da equipe (atrasados, inativos, próximos da conclusão, baixo desempenho, reprovações, destaques), alertas e insights automáticos por regras, **Learning Health Score**, relatório individual com linha do tempo, relatório por módulo e por questão, matriz de competências e exportação CSV/Excel.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui · Lucide · Supabase (Postgres, Auth, Storage, RLS) · Resend · Vercel · Recharts · Tiptap · dnd-kit · Zod · ExcelJS.

## Início rápido

```bash
npm install
cp .env.example .env.local   # preencha (ver docs/SETUP.md)
npm run dev
```

O passo a passo completo (Supabase, Resend, primeiro admin, deploy) está em **[docs/SETUP.md](docs/SETUP.md)**.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (inclui verificação de tipos) |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint |
| `npm run test` | Testes unitários (Vitest): health score, insights, validação de questões e uploads |
| `npm run db:validate` | Executa as 4 migrações num Postgres embutido (PGlite) e roda **49 verificações** ponta a ponta com RLS ativo |
| `npm run check` | Tudo acima em sequência |
| `npm run create-admin -- email "Nome"` | Cria/promove o primeiro administrador e imprime o link de definição de senha |

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, pastas, modelo de dados, fluxos, vídeo, analytics |
| [docs/SETUP.md](docs/SETUP.md) | Do zero ao primeiro acesso |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Projeto, migrações, Auth, tipos, limites do plano Free |
| [docs/STORAGE.md](docs/STORAGE.md) | Buckets, policies, limites, vídeo e quando trocar de provedor |
| [docs/AUTH.md](docs/AUTH.md) | Convite, login, recuperação de senha, papéis (RBAC) |
| [docs/EMAIL.md](docs/EMAIL.md) | Resend: conta, domínio, DNS, teste, templates |
| [docs/DEPLOY.md](docs/DEPLOY.md) | GitHub → Vercel, variáveis, domínio, cron, custos |
| [docs/SECURITY.md](docs/SECURITY.md) | RLS, RBAC, validações, uploads, segredos |

## Estrutura do conteúdo inicial

`supabase/migrations/004_seed.sql` cria a **Trilha de Onboarding Connect Skin** a partir da estrutura oficial ([docs/estrutura-onboarding.png](docs/estrutura-onboarding.png)):

1. **Entenda o Negócio** — Connect Skin · Marcas e Mercado · Como Geramos Resultado · Campanhas e Planos Comerciais
2. **Execute no Campo** — Rotina de Trabalho · Execução em Loja · Registros e Evidências · Indicadores e Metas
3. **Use as Plataformas** — Pharmalink · Involves · Trax · Paytrack · Outras (Acode, Radar)
4. **Suporte e Materiais** — Processos Administrativos · Materiais de Consulta · Treinamentos · Conclusão do Onboarding

As aulas vêm com o **roteiro** (subtópicos) e precisam ser complementadas pela equipe com o conteúdo real, vídeos e materiais. As 19 questões das provas usam apenas fatos presentes nessa estrutura (ex.: "Qual plataforma é usada para leitura de gôndola? → Trax").
