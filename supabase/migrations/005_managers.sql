-- =============================================================================
-- Connect Skin Academy — 005_managers.sql
-- Gestor responsável (hierarquia) + visibilidade por equipe + RLS mais rápida.
-- Executar UMA vez no SQL Editor, depois do 001–004.
-- =============================================================================

alter table public.profiles add column if not exists manager_id uuid references public.profiles (id) on delete set null;
create index if not exists profiles_manager_idx on public.profiles (manager_id);
alter table public.profiles drop constraint if exists profiles_manager_not_self;
alter table public.profiles add constraint profiles_manager_not_self check (manager_id is null or manager_id <> id);

-- Equipe do usuário logado (subordinados diretos e indiretos). Vazio para não-gestores.
create or replace function public.team_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select case when public.current_app_role() = 'manager' then coalesce((
    with recursive team as (
      select p.id, 1 as depth from public.profiles p where p.manager_id = auth.uid()
      union
      select p.id, t.depth + 1 from public.profiles p join team t on p.manager_id = t.id where t.depth < 10
    )
    select array_agg(distinct id) from team
  ), '{}'::uuid[]) else '{}'::uuid[] end;
$$;

-- Pode ver os dados de aprendizagem deste usuário? (ele mesmo, admin, ou gestor da equipe)
create or replace function public.can_view_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user = auth.uid() or public.is_admin() or p_user = any (public.team_user_ids());
$$;

revoke execute on function public.team_user_ids() from public, anon;
revoke execute on function public.can_view_user(uuid) from public, anon;
grant execute on function public.team_user_ids() to authenticated, service_role;
grant execute on function public.can_view_user(uuid) to authenticated, service_role;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.id             := old.id;
    new.email          := old.email;
    new.role_id        := old.role_id;
    new.status         := old.status;
    new.joined_at      := old.joined_at;
    new.invited_at     := old.invited_at;
    new.activated_at   := old.activated_at;
    new.total_points   := old.total_points;
    new.current_streak := old.current_streak;
    new.longest_streak := old.longest_streak;
    new.last_study_date:= old.last_study_date;
    new.last_seen_at   := old.last_seen_at;
    new.deleted_at     := old.deleted_at;
    new.job_title      := old.job_title;
    new.department     := old.department;
    new.area           := old.area;
    new.company        := old.company;
    new.manager_id     := old.manager_id;
  end if;
  return new;
end;
$$;

create or replace function public.fn_get_attempt_result(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_staff   boolean := false;
  a         public.exam_attempts;
  e         public.exams;
  v_used    integer;
  v_review  boolean;
  v_show    boolean;
  v_items   jsonb;
  v_history jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  v_staff := found and public.can_view_user(a.user_id) and a.user_id <> v_uid;
  if not found or (a.user_id <> v_uid and not v_staff) then raise exception 'Tentativa não encontrada.'; end if;
  select * into e from public.exams where id = a.exam_id;

  select count(*) into v_used from public.exam_attempts
  where exam_id = a.exam_id and user_id = a.user_id and status in ('submitted', 'expired');

  v_show := v_staff or e.show_result;
  v_review := v_staff or (a.status <> 'in_progress' and e.show_result and case e.show_answers
    when 'after_submit' then true
    when 'after_pass' then coalesce(a.passed, false)
    when 'after_last_attempt' then coalesce(a.passed, false) or (e.max_attempts is not null and v_used >= e.max_attempts)
    else false end);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'number', q.number, 'statement', q.statement, 'type', q.type,
           'is_correct', case when v_show then ans.is_correct end,
           'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb),
           'explanation', case when v_review and (v_staff or e.show_explanations) then q.explanation end,
           'options', case when v_review then (
              select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text, 'is_correct', o.is_correct) order by o.position)
              from public.question_options o where o.question_id = q.id) end
         ) order by qi.n), '[]'::jsonb)
    into v_items
  from unnest(a.question_ids) with ordinality as qi(qid, n)
  join public.questions q on q.id = qi.qid
  left join public.exam_answers ans on ans.attempt_id = a.id and ans.question_id = q.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'attempt_number', h.attempt_number, 'status', h.status,
           'score_percent', case when v_show then h.score_percent end,
           'passed', h.passed, 'submitted_at', h.submitted_at) order by h.attempt_number), '[]'::jsonb)
    into v_history
  from public.exam_attempts h
  where h.exam_id = a.exam_id and h.user_id = a.user_id;

  return jsonb_build_object(
    'attempt_id', a.id, 'exam_id', e.id, 'exam_title', e.title, 'module_id', e.module_id,
    'status', a.status, 'attempt_number', a.attempt_number, 'attempts_used', v_used,
    'max_attempts', e.max_attempts, 'passing_score', e.passing_score,
    'show_result', v_show, 'review_allowed', v_review,
    'score_percent', case when v_show then a.score_percent end,
    'passed', case when v_show then a.passed end,
    'correct_count', case when v_show then a.correct_count end,
    'wrong_count', case when v_show then a.wrong_count end,
    'time_spent_seconds', a.time_spent_seconds,
    'started_at', a.started_at, 'submitted_at', a.submitted_at,
    'questions', v_items, 'history', v_history
  );
end;
$$;

create or replace view public.v_user_learning_summary
with (security_invoker = true) as
select
  p.id as user_id,
  p.full_name, p.email, p.job_title, p.department, p.area, p.company, p.avatar_path,
  p.role_id, p.status, p.joined_at, p.activated_at, p.last_seen_at,
  p.total_points, p.current_streak, p.longest_streak,
  coalesce(cp.avg_percent, 0)::numeric(5, 2)      as overall_percent,
  coalesce(cp.courses_completed, 0)               as courses_completed,
  coalesce(cp.courses_enrolled, 0)                as courses_enrolled,
  coalesce(mp.modules_completed, 0)               as modules_completed,
  coalesce(lp.lessons_completed, 0)               as lessons_completed,
  coalesce(lp.lessons_started, 0)                 as lessons_started,
  coalesce(ex.attempts_count, 0)                  as exam_attempts,
  coalesce(ex.exams_taken, 0)                     as exams_taken,
  coalesce(ex.exams_passed, 0)                    as exams_passed,
  coalesce(ex.exams_failed_attempts, 0)           as failed_attempts,
  ex.avg_best_score,
  ex.avg_attempts_per_exam,
  coalesce(da.seconds_studied, 0)                 as time_studied_seconds,
  coalesce(da.active_days_30, 0)                  as active_days_30,
  greatest(p.last_seen_at, da.last_activity::timestamptz) as last_activity_at,
  case when greatest(p.last_seen_at, da.last_activity::timestamptz) is null then null
       else (current_date - greatest(p.last_seen_at, da.last_activity::timestamptz)::date) end as days_since_activity,
  coalesce(od.overdue_count, 0)                   as overdue_items,
  od.next_due_date,
  p.manager_id
from public.profiles p
left join lateral (
  select avg(coalesce(c.percent, 0)) as avg_percent,
         count(*) filter (where c.status = 'completed') as courses_completed,
         count(*) as courses_enrolled
  from public.enrollments en
  left join public.course_progress c on c.course_id = en.course_id and c.user_id = en.user_id
  where en.user_id = p.id and en.status <> 'cancelled'
) cp on true
left join lateral (
  select count(*) filter (where status = 'completed') as modules_completed
  from public.module_progress where user_id = p.id
) mp on true
left join lateral (
  select count(*) filter (where status = 'completed') as lessons_completed, count(*) as lessons_started
  from public.lesson_progress where user_id = p.id
) lp on true
left join lateral (
  select count(*) as attempts_count,
         count(distinct exam_id) as exams_taken,
         count(distinct exam_id) filter (where passed) as exams_passed,
         count(*) filter (where passed is false) as exams_failed_attempts,
         (select round(avg(best), 2) from (
            select max(a2.score_percent) as best from public.exam_attempts a2
            where a2.user_id = p.id and a2.status <> 'in_progress' group by a2.exam_id) b) as avg_best_score,
         round(count(*)::numeric / nullif(count(distinct exam_id), 0), 2) as avg_attempts_per_exam
  from public.exam_attempts a
  where a.user_id = p.id and a.status <> 'in_progress'
) ex on true
left join lateral (
  select sum(seconds_studied) as seconds_studied,
         count(*) filter (where activity_date >= current_date - 30) as active_days_30,
         max(activity_date) as last_activity
  from public.daily_activity where user_id = p.id
) da on true
left join lateral (
  select count(*) filter (where d.pending and d.due < current_date) as overdue_count,
         min(d.due) filter (where d.pending and d.due >= current_date) as next_due_date
  from (
    select en.due_date as due, coalesce(c.status, 'not_started') <> 'completed' as pending
    from public.enrollments en
    left join public.course_progress c on c.course_id = en.course_id and c.user_id = en.user_id
    where en.user_id = p.id and en.status = 'active' and en.due_date is not null
    union all
    select m.due_date, coalesce(mp2.status, 'not_started') <> 'completed'
    from public.enrollments en
    join public.modules m on m.course_id = en.course_id and m.status = 'published' and m.deleted_at is null
    left join public.module_progress mp2 on mp2.module_id = m.id and mp2.user_id = en.user_id
    where en.user_id = p.id and en.status <> 'cancelled' and m.due_date is not null
  ) d
) od on true
where p.deleted_at is null;

grant select on public.v_user_learning_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas: admin vê todos; gestor vê a própria equipe; colaborador vê a si.
-- "(select ...)" faz o Postgres calcular a função uma vez por consulta (mais rápido).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()) or id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists lesson_progress_select on public.lesson_progress;
create policy lesson_progress_select on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists module_progress_select on public.module_progress;
create policy module_progress_select on public.module_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists course_progress_select on public.course_progress;
create policy course_progress_select on public.course_progress for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists daily_activity_select on public.daily_activity;
create policy daily_activity_select on public.daily_activity for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select on public.exam_attempts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists point_events_select on public.point_events;
create policy point_events_select on public.point_events for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists certificates_select on public.certificates;
create policy certificates_select on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or user_id = any ((select public.team_user_ids())::uuid[]));

drop policy if exists exam_answers_staff_select on public.exam_answers;
create policy exam_answers_staff_select on public.exam_answers for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.exam_attempts a
               where a.id = exam_answers.attempt_id and a.user_id = any ((select public.team_user_ids())::uuid[]))
  );
