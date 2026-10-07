-- =============================================================================
-- Connect Skin Academy — 002_rls.sql
-- Row Level Security, RBAC e privilégios.
--
-- Regras:
--   • admin    → gerencia tudo.
--   • manager  → lê colaboradores, progresso, provas, analytics (sem editar).
--   • colaborador → lê apenas conteúdo publicado e liberado para ele;
--                   lê apenas o próprio progresso/provas/notificações;
--                   NUNCA escreve progresso diretamente (somente via funções fn_*).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Privilégios base
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Funções: ninguém executa por padrão; liberamos explicitamente abaixo.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Helpers usados nas policies
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.user_in_course_audience(uuid, uuid) to authenticated;
grant execute on function public.module_release_at(uuid, uuid) to authenticated;
grant execute on function public.module_unlock_state(uuid, uuid) to authenticated;
grant execute on function public.can_access_course(uuid) to authenticated;
grant execute on function public.can_access_module(uuid) to authenticated;
grant execute on function public.can_access_lesson(uuid) to authenticated;
grant execute on function public.protect_profile_columns() to authenticated;
grant execute on function public.set_updated_at() to authenticated;

-- RPCs do colaborador
grant execute on function public.fn_track_lesson_view(uuid) to authenticated;
grant execute on function public.fn_track_study_time(uuid, integer) to authenticated;
grant execute on function public.fn_track_video(uuid, numeric, numeric) to authenticated;
grant execute on function public.fn_submit_activity(uuid, text) to authenticated;
grant execute on function public.fn_complete_lesson(uuid) to authenticated;
grant execute on function public.fn_start_exam(uuid) to authenticated;
grant execute on function public.fn_get_attempt(uuid) to authenticated;
grant execute on function public.fn_save_answer(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.fn_submit_exam(uuid, jsonb) to authenticated;
grant execute on function public.fn_get_attempt_result(uuid) to authenticated;
grant execute on function public.fn_course_outline(uuid) to authenticated;
grant execute on function public.fn_module_state(uuid) to authenticated;
grant execute on function public.fn_ranking(integer) to authenticated;
grant execute on function public.fn_mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.fn_log_event(text, text, text, text, jsonb) to authenticated;
grant execute on function public.fn_activate_me() to authenticated;

-- RPCs administrativas (verificam is_admin() internamente)
grant execute on function public.fn_admin_sync_enrollments() to authenticated;
grant execute on function public.fn_admin_recalc_module(uuid) to authenticated;
grant execute on function public.fn_admin_reorder(text, uuid, uuid[]) to authenticated;
grant execute on function public.fn_admin_duplicate_lesson(uuid, uuid) to authenticated;
grant execute on function public.fn_admin_duplicate_exam(uuid, uuid) to authenticated;
grant execute on function public.fn_admin_duplicate_module(uuid) to authenticated;

-- Validação pública de certificado
grant execute on function public.fn_verify_certificate(text) to anon, authenticated;

-- fn_admin_notify_releases e funções _internas: apenas service_role (já concedido acima).

-- ---------------------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.roles               enable row level security;
alter table public.app_settings        enable row level security;
alter table public.profiles            enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.courses             enable row level security;
alter table public.course_groups       enable row level security;
alter table public.modules             enable row level security;
alter table public.videos              enable row level security;
alter table public.lessons             enable row level security;
alter table public.materials           enable row level security;
alter table public.lesson_materials    enable row level security;
alter table public.competencies        enable row level security;
alter table public.module_competencies enable row level security;
alter table public.enrollments         enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.module_progress     enable row level security;
alter table public.course_progress     enable row level security;
alter table public.daily_activity      enable row level security;
alter table public.exams               enable row level security;
alter table public.questions           enable row level security;
alter table public.question_options    enable row level security;
alter table public.exam_questions      enable row level security;
alter table public.exam_attempts       enable row level security;
alter table public.exam_answers        enable row level security;
alter table public.badges              enable row level security;
alter table public.user_badges         enable row level security;
alter table public.point_events        enable row level security;
alter table public.notifications       enable row level security;
alter table public.announcements       enable row level security;
alter table public.email_logs          enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.certificates        enable row level security;

-- ---------------------------------------------------------------------------
-- Referência
-- ---------------------------------------------------------------------------
create policy roles_select on public.roles for select to authenticated using (true);

create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
-- O próprio usuário edita nome/telefone/foto (demais colunas protegidas por trigger).
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Inserção/remoção: somente via Auth (trigger) ou service role.

-- ---------------------------------------------------------------------------
-- Grupos e competências
-- ---------------------------------------------------------------------------
create policy groups_select on public.groups for select to authenticated using (public.is_staff());
create policy groups_admin_all on public.groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy group_members_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy group_members_admin_all on public.group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy competencies_select on public.competencies for select to authenticated using (true);
create policy competencies_admin_all on public.competencies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy module_competencies_select on public.module_competencies for select to authenticated using (true);
create policy module_competencies_admin_all on public.module_competencies for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Conteúdo
-- ---------------------------------------------------------------------------
create policy courses_select on public.courses for select to authenticated
  using (public.is_staff() or (deleted_at is null and public.can_access_course(id)));
create policy courses_admin_all on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy course_groups_select on public.course_groups for select to authenticated using (public.is_staff());
create policy course_groups_admin_all on public.course_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Módulos publicados de trilhas acessíveis são visíveis (mesmo bloqueados, para
-- exibir a trilha com cadeado). O conteúdo das aulas exige módulo liberado.
create policy modules_select on public.modules for select to authenticated
  using (
    public.is_staff()
    or (status = 'published' and deleted_at is null and public.can_access_course(course_id))
  );
create policy modules_admin_all on public.modules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lessons_select on public.lessons for select to authenticated
  using (public.is_staff() or public.can_access_lesson(id));
create policy lessons_admin_all on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy videos_select on public.videos for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.lessons l where l.video_id = videos.id and public.can_access_lesson(l.id))
  );
create policy videos_admin_all on public.videos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy materials_select on public.materials for select to authenticated
  using (
    public.is_staff()
    or (deleted_at is null and status = 'active' and exists (
      select 1 from public.lesson_materials lm
      where lm.material_id = materials.id and public.can_access_lesson(lm.lesson_id)
    ))
  );
create policy materials_admin_all on public.materials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lesson_materials_select on public.lesson_materials for select to authenticated
  using (public.is_staff() or public.can_access_lesson(lesson_id));
create policy lesson_materials_admin_all on public.lesson_materials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Matrículas e progresso (somente leitura para o dono; escrita via funções)
-- ---------------------------------------------------------------------------
create policy enrollments_select on public.enrollments for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy enrollments_admin_all on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy module_progress_select on public.module_progress for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy course_progress_select on public.course_progress for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy daily_activity_select on public.daily_activity for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Avaliações — gabarito só para staff; aluno usa fn_get_attempt / fn_get_attempt_result
-- ---------------------------------------------------------------------------
create policy exams_select on public.exams for select to authenticated
  using (
    public.is_staff()
    or (status = 'published' and deleted_at is null and public.can_access_module(module_id))
  );
create policy exams_admin_all on public.exams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy questions_staff_select on public.questions for select to authenticated using (public.is_staff());
create policy questions_admin_all on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy question_options_staff_select on public.question_options for select to authenticated using (public.is_staff());
create policy question_options_admin_all on public.question_options for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy exam_questions_staff_select on public.exam_questions for select to authenticated using (public.is_staff());
create policy exam_questions_admin_all on public.exam_questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy exam_attempts_select on public.exam_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- Respostas corrigidas: o colaborador vê via fn_get_attempt_result (respeita
-- "mostrar resultado/respostas"); leitura direta só para staff.
create policy exam_answers_staff_select on public.exam_answers for select to authenticated
  using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Gamificação
-- ---------------------------------------------------------------------------
create policy badges_select on public.badges for select to authenticated using (true);
create policy badges_admin_all on public.badges for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy user_badges_select on public.user_badges for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

create policy point_events_select on public.point_events for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check (public.is_admin());
create policy notifications_delete_own on public.notifications for delete to authenticated
  using (user_id = auth.uid());
-- Marcar como lida: via fn_mark_notifications_read.

create policy announcements_select on public.announcements for select to authenticated
  using (
    public.is_staff()
    or (status = 'published' and deleted_at is null and publish_at <= now()
        and (expires_at is null or expires_at > now()) and public.is_active_user())
  );
create policy announcements_admin_all on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy email_logs_admin_select on public.email_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Auditoria e certificados
-- ---------------------------------------------------------------------------
create policy audit_logs_admin_select on public.audit_logs for select to authenticated using (public.is_admin());
-- Inserção somente via fn_log_event / funções internas.

create policy certificates_select on public.certificates for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------------
-- Views de analytics: leitura para autenticados (RLS das tabelas se aplica).
-- ---------------------------------------------------------------------------
grant select on public.v_user_learning_summary, public.v_module_stats, public.v_lesson_stats,
                public.v_question_stats, public.v_exam_stats to authenticated;
