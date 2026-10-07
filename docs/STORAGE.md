# Storage

## Buckets

| Bucket | Acesso | Limite | Conteúdo |
|---|---|---|---|
| `course-covers` | Público | 5 MB · JPG/PNG/WebP/AVIF | Capas de trilha, imagens do editor e de comunicados |
| `module-covers` | Público | 5 MB | Capas, thumbnails e destaques de módulos |
| `avatars` | Público | 2 MB · JPG/PNG/WebP | Fotos (`{userId}/arquivo`) |
| `lesson-materials` | **Privado** | 50 MB | Materiais enviados dentro das aulas |
| `documents` | **Privado** | 50 MB | Arquivos enviados pela Biblioteca |
| `video-assets` | **Privado** | 50 MB (Free) | Vídeos e thumbnails de vídeo |

Formatos aceitos para materiais: PDF, XLSX, XLS, CSV, DOCX, DOC, PPTX, PPT, ZIP, TXT, JPG, PNG, WebP.

Capas e avatars são públicos por desempenho (otimização de imagem/cache); os caminhos usam UUID. **Material de treinamento é sempre privado** e entregue por **Signed URL** (10 min para materiais, 2 h para vídeo).

## Limites centralizados

Todos os limites ficam em **`src/config/uploads.ts`** e são validados no navegador e no servidor (extensão, MIME declarado × extensão, tamanho). O Supabase reforça com `file_size_limit` e `allowed_mime_types` de cada bucket (`003_storage.sql`). **Ao alterar um limite, altere os dois.**

O limite de vídeo vem de `NEXT_PUBLIC_VIDEO_MAX_UPLOAD_MB` (padrão 50).

## Como o upload funciona

1. O navegador pede ao servidor (`requestUploadAction`) uma URL de upload assinada — o servidor valida tipo/tamanho e permissão (admin; avatar: o próprio usuário).
2. O arquivo vai **direto** do navegador para o Storage com barra de progresso real (sem passar pela Vercel, que limita o corpo das requisições).
3. O servidor confirma que o objeto existe (`assertObjectExists`) e só então grava os metadados (`materials`, `videos`, `avatar_path`…).

## Policies (resumo)

- **Admin**: select/insert/update/delete em todos os buckets da plataforma.
- **Autenticado**: leitura dos buckets públicos.
- **Colaborador**: leitura de objetos privados **somente** se o arquivo estiver ligado a uma aula publicada, de um módulo liberado para ele (`can_read_storage_object`). Arquivo solto, de aula em rascunho ou de módulo bloqueado → negado.
- **Avatars**: cada usuário gerencia apenas `avatars/{seu-id}/…`.

## Vídeo: estratégia e custos

A aplicação usa a abstração **`VideoProvider`** (`src/lib/video/provider.ts`):

| Provedor | Status | Quando usar |
|---|---|---|
| `youtube` | Implementado | **Recomendado no Free**: vídeo “Não listado”, sem custo de banda; progresso medido pela IFrame API |
| `supabase` | Implementado | Vídeos curtos (≤ 50 MB no Free). Consome Storage e egress |
| `external` | Implementado | Link direto para .mp4/.webm hospedado em outro serviço |
| `vimeo`, `cloudflare`, `mux` | Preparado (schema + registro) | Quando houver orçamento: implementar uma classe e registrar em `registry` |

Para migrar para Cloudflare Stream / Mux / Vimeo: criar `class XProvider implements VideoProvider`, registrar em `registry`, e no editor de aula gravar `provider` + `provider_asset_id`. Telas e banco não mudam.

### Quando o plano gratuito deixa de servir

- **Supabase Storage (1 GB / 5 GB egress)**: se os vídeos forem hospedados no Supabase, 40 pessoas assistindo 1 h cada já passam do egress. → Supabase **Pro** (100 GB storage, 250 GB egress, uploads até 500 GB) **ou** mover vídeos para YouTube/Cloudflare Stream.
- **Arquivos > 50 MB**: o Free recusa. → Pro, ou YouTube para vídeos.
