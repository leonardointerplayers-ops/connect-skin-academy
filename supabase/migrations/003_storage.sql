-- =============================================================================
-- Connect Skin Academy — 003_storage.sql
-- Buckets e policies do Supabase Storage.
--
-- Limites espelham src/config/uploads.ts. Ao alterar um, altere o outro.
-- Plano Free: tamanho máximo por arquivo = 50 MB (limite global do projeto).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('course-covers', 'course-covers', true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('module-covers', 'module-covers', true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', true, 2097152,
     array['image/jpeg', 'image/png', 'image/webp']),
  ('lesson-materials', 'lesson-materials', false, 52428800,
     array[
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.ms-excel',
       'text/csv',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/msword',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
       'application/vnd.ms-powerpoint',
       'application/zip', 'application/x-zip-compressed',
       'image/jpeg', 'image/png', 'image/webp',
       'text/plain'
     ]),
  ('documents', 'documents', false, 52428800,
     array[
       'application/pdf',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/vnd.ms-excel',
       'text/csv',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/msword',
       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
       'application/vnd.ms-powerpoint',
       'application/zip', 'application/x-zip-compressed',
       'image/jpeg', 'image/png', 'image/webp',
       'text/plain'
     ]),
  ('video-assets', 'video-assets', false, 52428800,
     array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Colaborador só lê objetos privados ligados a aulas que ele pode acessar.
create or replace function public.can_read_storage_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
    or exists (
      select 1
      from public.materials m
      join public.lesson_materials lm on lm.material_id = m.id
      where m.bucket = p_bucket and m.storage_path = p_name
        and m.deleted_at is null and m.status = 'active'
        and public.can_access_lesson(lm.lesson_id)
    )
    or exists (
      select 1
      from public.videos v
      join public.lessons l on l.video_id = v.id
      where p_bucket = 'video-assets'
        and (v.storage_path = p_name or v.thumbnail_path = p_name)
        and v.deleted_at is null
        and public.can_access_lesson(l.id)
    );
$$;

revoke execute on function public.can_read_storage_object(text, text) from public, anon;
grant execute on function public.can_read_storage_object(text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Administradores: acesso total aos buckets da plataforma
-- ---------------------------------------------------------------------------
create policy "admin select platform objects" on storage.objects for select to authenticated
  using (bucket_id in ('course-covers', 'module-covers', 'avatars', 'lesson-materials', 'documents', 'video-assets')
         and public.is_admin());

create policy "admin insert platform objects" on storage.objects for insert to authenticated
  with check (bucket_id in ('course-covers', 'module-covers', 'avatars', 'lesson-materials', 'documents', 'video-assets')
              and public.is_admin());

create policy "admin update platform objects" on storage.objects for update to authenticated
  using (bucket_id in ('course-covers', 'module-covers', 'avatars', 'lesson-materials', 'documents', 'video-assets')
         and public.is_admin())
  with check (bucket_id in ('course-covers', 'module-covers', 'avatars', 'lesson-materials', 'documents', 'video-assets')
              and public.is_admin());

create policy "admin delete platform objects" on storage.objects for delete to authenticated
  using (bucket_id in ('course-covers', 'module-covers', 'avatars', 'lesson-materials', 'documents', 'video-assets')
         and public.is_admin());

-- ---------------------------------------------------------------------------
-- Leitura (download / signed URL)
-- ---------------------------------------------------------------------------
-- Buckets públicos já são servidos por URL pública; a policy abaixo permite
-- listar/baixar via API para usuários autenticados.
create policy "authenticated read public buckets" on storage.objects for select to authenticated
  using (bucket_id in ('course-covers', 'module-covers', 'avatars'));

create policy "collaborator read accessible private objects" on storage.objects for select to authenticated
  using (bucket_id in ('lesson-materials', 'documents', 'video-assets')
         and public.can_read_storage_object(bucket_id, name));

-- ---------------------------------------------------------------------------
-- Avatars: cada usuário gerencia apenas a pasta {user_id}/
-- ---------------------------------------------------------------------------
create policy "users insert own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users update own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
