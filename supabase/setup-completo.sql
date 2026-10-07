-- Arquivo único para colar no SQL Editor do Supabase (001 + 002 + 003 + 004).

-- ===== migrations/001_schema.sql =====
-- =============================================================================
-- Connect Skin Academy — 001_schema.sql
-- Tabelas, índices, triggers, funções de negócio e views de analytics.
-- Executar no SQL Editor do Supabase, nesta ordem: 001 → 002 → 003 → 004.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
create table public.roles (
  id          text primary key check (id in ('admin', 'manager', 'collaborator')),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

insert into public.roles (id, name, description) values
  ('admin', 'Administrador', 'Gerencia conteúdos, usuários, avaliações e configurações.'),
  ('manager', 'Gestor', 'Acompanha colaboradores, analytics e relatórios (somente leitura).'),
  ('collaborator', 'Colaborador', 'Acessa as trilhas de aprendizagem liberadas.');

-- ---------------------------------------------------------------------------
-- Configurações gerais (linha única)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id                                boolean primary key default true check (id),
  platform_name                     text not null default 'Connect Skin Academy',
  company_name                      text not null default 'Connect Skin',
  ranking_enabled                   boolean not null default false,
  ranking_criteria                  text not null default 'points'
                                      check (ranking_criteria in ('points', 'completions', 'scores', 'streak')),
  inactivity_alert_days             integer not null default 7 check (inactivity_alert_days between 1 and 90),
  default_video_completion_percent  integer not null default 90 check (default_video_completion_percent between 1 and 100),
  reminder_emails_enabled           boolean not null default true,
  updated_at                        timestamptz not null default now(),
  updated_by                        uuid
);

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  email            text not null,
  full_name        text not null default '',
  phone            text,
  job_title        text,
  department       text,
  area             text,
  company          text,
  avatar_path      text,
  role_id          text not null default 'collaborator' references public.roles (id),
  status           text not null default 'invited' check (status in ('invited', 'active', 'inactive')),
  joined_at        date not null default current_date,
  invited_at       timestamptz,
  activated_at     timestamptz,
  last_seen_at     timestamptz,
  total_points     integer not null default 0,
  current_streak   integer not null default 0,
  longest_streak   integer not null default 0,
  last_study_date  date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create unique index profiles_email_key on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role_id);
create index profiles_status_idx on public.profiles (status) where deleted_at is null;
create index profiles_last_seen_idx on public.profiles (last_seen_at);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Funções auxiliares de autorização (usadas por funções e pelas policies)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role_id
  from public.profiles
  where id = auth.uid()
    and deleted_at is null
    and status <> 'inactive';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'manager'), false);
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() is not null;
$$;

-- Impede que um usuário comum altere colunas sensíveis do próprio perfil
-- via API. Funções SECURITY DEFINER (current_user = owner) não são afetadas.
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
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create unique index groups_name_key on public.groups (lower(name)) where deleted_at is null;
create trigger groups_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Trilhas (courses)
-- ---------------------------------------------------------------------------
create table public.courses (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(title) between 2 and 160),
  subtitle            text,
  description         text,
  category            text,
  cover_path          text,
  thumbnail_path      text,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  position            integer not null default 0,
  require_sequential  boolean not null default true,
  certificate_enabled boolean not null default true,
  workload_hours      numeric(6, 1),
  due_days            integer check (due_days is null or due_days > 0),
  audience            text not null default 'all' check (audience in ('all', 'groups')),
  published_at        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index courses_status_idx on public.courses (status, position) where deleted_at is null;
create trigger courses_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.course_groups (
  course_id  uuid not null references public.courses (id) on delete cascade,
  group_id   uuid not null references public.groups (id) on delete cascade,
  primary key (course_id, group_id)
);
create index course_groups_group_idx on public.course_groups (group_id);

-- ---------------------------------------------------------------------------
-- Módulos
-- ---------------------------------------------------------------------------
create table public.modules (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid not null references public.courses (id) on delete cascade,
  title               text not null check (char_length(title) between 2 and 160),
  description         text,
  category            text,
  cover_path          text,
  thumbnail_path      text,
  featured_image_path text,
  position            integer not null default 0,
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  release_type        text not null default 'immediate'
                        check (release_type in ('immediate', 'date', 'days_after_join')),
  release_at          timestamptz,
  release_days        integer check (release_days is null or release_days >= 0),
  due_date            date,
  points              integer not null default 100 check (points >= 0),
  published_at        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (release_type <> 'date' or release_at is not null),
  check (release_type <> 'days_after_join' or release_days is not null)
);
create index modules_course_idx on public.modules (course_id, position) where deleted_at is null;
create index modules_status_idx on public.modules (status);
create trigger modules_updated_at before update on public.modules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Vídeos (abstração VideoProvider)
-- ---------------------------------------------------------------------------
create table public.videos (
  id                uuid primary key default gen_random_uuid(),
  title             text,
  provider          text not null check (provider in ('supabase', 'external', 'youtube', 'vimeo', 'cloudflare', 'mux')),
  storage_bucket    text,
  storage_path      text,
  external_url      text,
  provider_asset_id text,
  thumbnail_path    text,
  duration_seconds  numeric(10, 2) check (duration_seconds is null or duration_seconds > 0),
  mime_type         text,
  size_bytes        bigint,
  status            text not null default 'ready' check (status in ('uploading', 'processing', 'ready', 'error')),
  uploaded_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  check (storage_path is not null or external_url is not null or provider_asset_id is not null)
);
create index videos_storage_idx on public.videos (storage_bucket, storage_path);
create trigger videos_updated_at before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Aulas
-- ---------------------------------------------------------------------------
create table public.lessons (
  id                          uuid primary key default gen_random_uuid(),
  module_id                   uuid not null references public.modules (id) on delete cascade,
  title                       text not null check (char_length(title) between 2 and 160),
  description                 text,
  content_html                text,
  content_json                jsonb,
  video_id                    uuid references public.videos (id) on delete set null,
  position                    integer not null default 0,
  status                      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_required                 boolean not null default true,
  video_required              boolean not null default true,
  min_video_percent           integer not null default 90 check (min_video_percent between 1 and 100),
  activity_enabled            boolean not null default false,
  activity_title              text,
  activity_instructions       text,
  activity_requires_response  boolean not null default false,
  estimated_minutes           integer check (estimated_minutes is null or estimated_minutes > 0),
  points                      integer not null default 10 check (points >= 0),
  published_at                timestamptz,
  created_by                  uuid references public.profiles (id) on delete set null,
  updated_by                  uuid references public.profiles (id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);
create index lessons_module_idx on public.lessons (module_id, position) where deleted_at is null;
create index lessons_status_idx on public.lessons (status);
create index lessons_video_idx on public.lessons (video_id);
create trigger lessons_updated_at before update on public.lessons
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Biblioteca de materiais (reutilizável entre aulas)
-- ---------------------------------------------------------------------------
create table public.materials (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 200),
  description   text,
  kind          text not null check (kind in ('pdf', 'spreadsheet', 'document', 'presentation', 'archive', 'image', 'video', 'link', 'other')),
  bucket        text,
  storage_path  text,
  file_name     text,
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  external_url  text,
  status        text not null default 'active' check (status in ('active', 'archived')),
  tags          text[] not null default '{}',
  uploaded_by   uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  check ((bucket is not null and storage_path is not null) or external_url is not null)
);
create unique index materials_object_key on public.materials (bucket, storage_path) where storage_path is not null and deleted_at is null;
create index materials_kind_idx on public.materials (kind) where deleted_at is null;
create index materials_created_idx on public.materials (created_at desc);
create trigger materials_updated_at before update on public.materials
  for each row execute function public.set_updated_at();

create table public.lesson_materials (
  lesson_id   uuid not null references public.lessons (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (lesson_id, material_id)
);
create index lesson_materials_material_idx on public.lesson_materials (material_id);

-- ---------------------------------------------------------------------------
-- Competências
-- ---------------------------------------------------------------------------
create table public.competencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 80),
  description text,
  created_at  timestamptz not null default now()
);
create unique index competencies_name_key on public.competencies (lower(name));

create table public.module_competencies (
  module_id     uuid not null references public.modules (id) on delete cascade,
  competency_id uuid not null references public.competencies (id) on delete cascade,
  primary key (module_id, competency_id)
);
create index module_competencies_comp_idx on public.module_competencies (competency_id);

-- ---------------------------------------------------------------------------
-- Matrículas e progresso
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_id   uuid not null references public.courses (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  due_date    date,
  status      text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  source      text not null default 'auto' check (source in ('auto', 'manual', 'group')),
  unique (user_id, course_id)
);
create index enrollments_course_idx on public.enrollments (course_id, status);

create table public.lesson_progress (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references public.profiles (id) on delete cascade,
  lesson_id                   uuid not null references public.lessons (id) on delete cascade,
  module_id                   uuid not null references public.modules (id) on delete cascade,
  course_id                   uuid not null references public.courses (id) on delete cascade,
  status                      text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  view_count                  integer not null default 0,
  first_viewed_at             timestamptz not null default now(),
  last_viewed_at              timestamptz not null default now(),
  time_spent_seconds          integer not null default 0,
  last_heartbeat_at           timestamptz,
  video_position_seconds      numeric(10, 2) not null default 0,
  video_max_position_seconds  numeric(10, 2) not null default 0,
  video_duration_seconds      numeric(10, 2),
  video_percent               numeric(5, 2) not null default 0,
  video_started_at            timestamptz,
  video_last_signal_at        timestamptz,
  video_completed_at          timestamptz,
  activity_response           text,
  activity_completed_at       timestamptz,
  completed_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index lesson_progress_module_idx on public.lesson_progress (module_id, user_id);
create index lesson_progress_course_idx on public.lesson_progress (course_id, user_id);
create index lesson_progress_user_recent_idx on public.lesson_progress (user_id, last_viewed_at desc);
create index lesson_progress_status_idx on public.lesson_progress (status);

create table public.module_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  module_id          uuid not null references public.modules (id) on delete cascade,
  course_id          uuid not null references public.courses (id) on delete cascade,
  lessons_completed  integer not null default 0,
  lessons_total      integer not null default 0,
  percent            numeric(5, 2) not null default 0,
  exam_required      boolean not null default false,
  exam_passed        boolean,
  best_score         numeric(5, 2),
  status             text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  started_at         timestamptz,
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  unique (user_id, module_id)
);
create index module_progress_module_idx on public.module_progress (module_id, status);
create index module_progress_course_idx on public.module_progress (course_id, user_id);

create table public.course_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  course_id          uuid not null references public.courses (id) on delete cascade,
  modules_completed  integer not null default 0,
  modules_total      integer not null default 0,
  percent            numeric(5, 2) not null default 0,
  status             text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  started_at         timestamptz,
  completed_at       timestamptz,
  updated_at         timestamptz not null default now(),
  unique (user_id, course_id)
);
create index course_progress_course_idx on public.course_progress (course_id, status);

create table public.daily_activity (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  activity_date   date not null,
  seconds_studied integer not null default 0,
  lessons_viewed  integer not null default 0,
  primary key (user_id, activity_date)
);
create index daily_activity_date_idx on public.daily_activity (activity_date);

-- ---------------------------------------------------------------------------
-- Avaliações
-- ---------------------------------------------------------------------------
create table public.exams (
  id                  uuid primary key default gen_random_uuid(),
  module_id           uuid not null references public.modules (id) on delete cascade,
  title               text not null check (char_length(title) between 2 and 160),
  description         text,
  instructions        text,
  passing_score       integer not null default 70 check (passing_score between 0 and 100),
  question_count      integer check (question_count is null or question_count > 0),
  max_attempts        integer default 3 check (max_attempts is null or max_attempts > 0),
  time_limit_minutes  integer check (time_limit_minutes is null or time_limit_minutes > 0),
  selection_mode      text not null default 'fixed' check (selection_mode in ('fixed', 'random')),
  random_categories   text[] not null default '{}',
  random_difficulties text[] not null default '{}',
  shuffle_questions   boolean not null default true,
  shuffle_options     boolean not null default true,
  show_result         boolean not null default true,
  show_answers        text not null default 'after_submit'
                        check (show_answers in ('never', 'after_submit', 'after_pass', 'after_last_attempt')),
  show_explanations   boolean not null default true,
  is_required         boolean not null default true,
  points              integer not null default 50 check (points >= 0),
  status              text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at        timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create unique index exams_one_per_module on public.exams (module_id) where deleted_at is null;
create index exams_status_idx on public.exams (status);
create trigger exams_updated_at before update on public.exams
  for each row execute function public.set_updated_at();

create table public.questions (
  id          uuid primary key default gen_random_uuid(),
  number      bigint generated always as identity unique,
  statement   text not null check (char_length(statement) between 3 and 4000),
  type        text not null check (type in ('single_choice', 'true_false', 'multiple_choice', 'essay')),
  category    text,
  difficulty  text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  explanation text,
  points      numeric(6, 2) not null default 1 check (points > 0),
  module_id   uuid references public.modules (id) on delete set null,
  status      text not null default 'published' check (status in ('draft', 'published', 'archived')),
  created_by  uuid references public.profiles (id) on delete set null,
  updated_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index questions_category_idx on public.questions (category) where deleted_at is null;
create index questions_module_idx on public.questions (module_id);
create index questions_status_idx on public.questions (status, difficulty);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 1000),
  is_correct  boolean not null default false,
  position    integer not null default 0
);
create index question_options_question_idx on public.question_options (question_id, position);

create table public.exam_questions (
  exam_id     uuid not null references public.exams (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  position    integer not null default 0,
  primary key (exam_id, question_id)
);
create index exam_questions_question_idx on public.exam_questions (question_id);

create table public.exam_attempts (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.exams (id) on delete cascade,
  user_id            uuid not null references public.profiles (id) on delete cascade,
  attempt_number     integer not null check (attempt_number > 0),
  status             text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'expired')),
  question_ids       uuid[] not null,
  option_order       jsonb not null default '{}',
  started_at         timestamptz not null default now(),
  expires_at         timestamptz,
  submitted_at       timestamptz,
  time_spent_seconds integer,
  score_percent      numeric(5, 2),
  points_earned      numeric(8, 2),
  points_possible    numeric(8, 2),
  correct_count      integer,
  wrong_count        integer,
  passed             boolean,
  unique (exam_id, user_id, attempt_number)
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, exam_id);
create index exam_attempts_exam_idx on public.exam_attempts (exam_id, status);
create index exam_attempts_submitted_idx on public.exam_attempts (submitted_at desc);

create table public.exam_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.exam_attempts (id) on delete cascade,
  question_id         uuid not null references public.questions (id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  text_answer         text,
  is_correct          boolean,
  points_awarded      numeric(6, 2),
  answered_at         timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index exam_answers_question_idx on public.exam_answers (question_id);

-- ---------------------------------------------------------------------------
-- Gamificação
-- ---------------------------------------------------------------------------
create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  icon        text not null default '🏅',
  rule_type   text not null check (rule_type in ('first_module', 'course_completed', 'streak_days', 'lessons_completed', 'high_score', 'first_exam_passed')),
  rule_value  integer not null default 1,
  points      integer not null default 0 check (points >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_id)
);
create index user_badges_user_idx on public.user_badges (user_id);

create table public.point_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  points     integer not null,
  reason     text not null,
  ref_id     uuid,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);
create index point_events_user_idx on public.point_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  dedupe_key  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create unique index notifications_dedupe_key on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 160),
  body        text not null,
  image_path  text,
  link_url    text,
  link_label  text,
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status      text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  show_banner boolean not null default false,
  publish_at  timestamptz not null default now(),
  expires_at  timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index announcements_publish_idx on public.announcements (status, publish_at desc) where deleted_at is null;
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.email_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles (id) on delete set null,
  to_email            text not null,
  template            text not null,
  subject             text not null,
  status              text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now()
);
create index email_logs_created_idx on public.email_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Auditoria e certificados
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  summary     text,
  changes     jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.certificates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  code            text not null unique,
  recipient_name  text not null,
  course_title    text not null,
  workload_hours  numeric(6, 1),
  issued_at       timestamptz not null default now(),
  unique (user_id, course_id)
);

-- =============================================================================
-- FUNÇÕES INTERNAS (não expostas à API — EXECUTE revogado em 002_rls.sql)
-- =============================================================================

create or replace function public._audit(
  p_actor uuid, p_action text, p_entity_type text, p_entity_id text,
  p_summary text default null, p_changes jsonb default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, summary, changes)
  values (p_actor, p_action, p_entity_type, p_entity_id, p_summary, p_changes);
$$;

create or replace function public._notify(
  p_user uuid, p_type text, p_title text, p_body text, p_link text, p_dedupe text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, link, dedupe_key)
  values (p_user, p_type, p_title, p_body, p_link, p_dedupe)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function public._award_points(p_user uuid, p_points integer, p_reason text, p_ref uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if coalesce(p_points, 0) <= 0 then
    return;
  end if;
  insert into public.point_events (user_id, points, reason, ref_id)
  values (p_user, p_points, p_reason, p_ref)
  on conflict (user_id, reason, ref_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.profiles set total_points = total_points + p_points where id = p_user;
  end if;
end;
$$;

-- Atualiza último acesso e sequência de estudos (streak).
create or replace function public._touch_activity(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last date;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select last_study_date into v_last from public.profiles where id = p_user;
  update public.profiles
     set last_seen_at    = now(),
         current_streak  = case
                             when v_last = v_today then current_streak
                             when v_last = v_today - 1 then current_streak + 1
                             else 1
                           end,
         longest_streak  = greatest(longest_streak, case
                             when v_last = v_today then current_streak
                             when v_last = v_today - 1 then current_streak + 1
                             else 1
                           end),
         last_study_date = v_today
   where id = p_user;
end;
$$;

create or replace function public.user_in_course_audience(p_user uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course
      and (
        c.audience = 'all'
        or exists (
          select 1
          from public.course_groups cg
          join public.group_members gm on gm.group_id = cg.group_id
          where cg.course_id = c.id and gm.user_id = p_user
        )
      )
  );
$$;

create or replace function public.module_release_at(p_user uuid, p_module uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select case m.release_type
           when 'date' then m.release_at
           when 'days_after_join' then
             ((select p.joined_at from public.profiles p where p.id = p_user) + m.release_days)::timestamp
               at time zone 'America/Sao_Paulo'
           else null
         end
  from public.modules m
  where m.id = p_module;
$$;

-- 'unlocked' | 'locked_date' | 'locked_sequence' | 'unavailable'
create or replace function public.module_unlock_state(p_user uuid, p_module uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_course_id    uuid;
  v_position     integer;
  v_created_at   timestamptz;
  v_status       text;
  v_sequential   boolean;
  v_release      timestamptz;
  v_prev         uuid;
begin
  select m.course_id, m.position, m.created_at, m.status
    into v_course_id, v_position, v_created_at, v_status
  from public.modules m
  where m.id = p_module and m.deleted_at is null;

  if not found or v_status <> 'published' then
    return 'unavailable';
  end if;

  select c.require_sequential into v_sequential
  from public.courses c
  where c.id = v_course_id and c.deleted_at is null and c.status = 'published';

  if not found or not public.user_in_course_audience(p_user, v_course_id) then
    return 'unavailable';
  end if;

  v_release := public.module_release_at(p_user, p_module);
  if v_release is not null and v_release > now() then
    return 'locked_date';
  end if;

  if v_sequential then
    select m.id into v_prev
    from public.modules m
    where m.course_id = v_course_id
      and m.status = 'published'
      and m.deleted_at is null
      and (m.position, m.created_at) < (v_position, v_created_at)
    order by m.position desc, m.created_at desc
    limit 1;

    if v_prev is not null and not exists (
      select 1 from public.module_progress mp
      where mp.user_id = p_user and mp.module_id = v_prev and mp.status = 'completed'
    ) then
      return 'locked_sequence';
    end if;
  end if;

  return 'unlocked';
end;
$$;

create or replace function public.can_access_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff() or (
    public.is_active_user()
    and exists (
      select 1 from public.courses c
      where c.id = p_course and c.status = 'published' and c.deleted_at is null
    )
    and public.user_in_course_audience(auth.uid(), p_course)
  );
$$;

create or replace function public.can_access_module(p_module uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff()
      or (public.is_active_user() and public.module_unlock_state(auth.uid(), p_module) = 'unlocked');
$$;

create or replace function public.can_access_lesson(p_lesson uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff() or exists (
    select 1 from public.lessons l
    where l.id = p_lesson
      and l.status = 'published'
      and l.deleted_at is null
      and public.can_access_module(l.module_id)
  );
$$;

create or replace function public._ensure_lesson_progress(p_user uuid, p_lesson uuid)
returns public.lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lesson_progress;
begin
  insert into public.lesson_progress (user_id, lesson_id, module_id, course_id)
  select p_user, l.id, l.module_id, m.course_id
  from public.lessons l
  join public.modules m on m.id = l.module_id
  where l.id = p_lesson
  on conflict (user_id, lesson_id) do nothing;

  select * into v_row from public.lesson_progress where user_id = p_user and lesson_id = p_lesson;
  return v_row;
end;
$$;

-- Avalia regras de badges para o usuário.
create or replace function public._award_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b         record;
  v_ok      boolean;
  v_new     integer;
begin
  for b in select * from public.badges where active loop
    v_ok := case b.rule_type
      when 'first_module' then
        (select count(*) from public.module_progress where user_id = p_user and status = 'completed') >= greatest(b.rule_value, 1)
      when 'course_completed' then
        (select count(*) from public.course_progress where user_id = p_user and status = 'completed') >= greatest(b.rule_value, 1)
      when 'streak_days' then
        (select longest_streak from public.profiles where id = p_user) >= b.rule_value
      when 'lessons_completed' then
        (select count(*) from public.lesson_progress where user_id = p_user and status = 'completed') >= b.rule_value
      when 'high_score' then
        exists (select 1 from public.exam_attempts
                where user_id = p_user and status in ('submitted', 'expired') and score_percent >= b.rule_value)
      when 'first_exam_passed' then
        exists (select 1 from public.exam_attempts where user_id = p_user and passed)
      else false
    end;

    if v_ok then
      insert into public.user_badges (user_id, badge_id) values (p_user, b.id)
      on conflict (user_id, badge_id) do nothing;
      get diagnostics v_new = row_count;
      if v_new > 0 then
        perform public._award_points(p_user, b.points, 'badge', b.id);
        perform public._notify(p_user, 'badge', b.icon || ' Nova conquista: ' || b.name,
                               b.description, '/conquistas', 'badge:' || b.id);
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public._generate_certificate_code()
returns text
language plpgsql
as $$
declare
  v_raw text;
begin
  loop
    v_raw := upper(replace(gen_random_uuid()::text, '-', ''));
    v_raw := 'CSA-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
    exit when not exists (select 1 from public.certificates where code = v_raw);
  end loop;
  return v_raw;
end;
$$;

-- Recalcula o progresso da trilha. Retorna true se a trilha acabou de ser concluída.
create or replace function public._recalc_course(p_user uuid, p_course uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total      integer;
  v_done       integer;
  v_percent    numeric;
  v_status     text;
  v_prev       text;
  v_started    boolean;
  v_course     record;
  v_name       text;
  v_code       text;
begin
  select count(*),
         count(*) filter (where mp.status = 'completed'),
         coalesce(avg(coalesce(mp.percent, 0)), 0),
         bool_or(mp.status is not null and mp.status <> 'not_started')
    into v_total, v_done, v_percent, v_started
  from public.modules m
  left join public.module_progress mp on mp.module_id = m.id and mp.user_id = p_user
  where m.course_id = p_course and m.status = 'published' and m.deleted_at is null;

  v_status := case
    when v_total > 0 and v_done = v_total then 'completed'
    when coalesce(v_started, false) then 'in_progress'
    else 'not_started'
  end;
  if v_status = 'completed' then
    v_percent := 100;
  end if;

  select status into v_prev from public.course_progress where user_id = p_user and course_id = p_course;

  insert into public.course_progress (user_id, course_id, modules_completed, modules_total, percent, status, started_at, completed_at, updated_at)
  values (p_user, p_course, v_done, v_total, round(v_percent, 2), v_status,
          case when v_status <> 'not_started' then now() end,
          case when v_status = 'completed' then now() end, now())
  on conflict (user_id, course_id) do update
    set modules_completed = excluded.modules_completed,
        modules_total     = excluded.modules_total,
        percent           = excluded.percent,
        status            = excluded.status,
        started_at        = coalesce(public.course_progress.started_at, excluded.started_at),
        completed_at      = case when excluded.status = 'completed'
                                 then coalesce(public.course_progress.completed_at, now()) else null end,
        updated_at        = now();

  select * into v_course from public.courses where id = p_course;

  if v_status <> 'completed' and v_percent >= 80 then
    perform public._notify(p_user, 'near_completion', 'Você está quase lá! 🚀',
      'Faltam poucos passos para concluir a trilha "' || v_course.title || '".',
      '/trilhas/' || p_course, 'near_completion:' || p_course);
  end if;

  if v_status = 'completed' and coalesce(v_prev, '') <> 'completed' then
    update public.enrollments set status = 'completed' where user_id = p_user and course_id = p_course;

    if v_course.certificate_enabled then
      select full_name into v_name from public.profiles where id = p_user;
      v_code := public._generate_certificate_code();
      insert into public.certificates (user_id, course_id, code, recipient_name, course_title, workload_hours)
      values (p_user, p_course, v_code, coalesce(nullif(v_name, ''), 'Colaborador'), v_course.title, v_course.workload_hours)
      on conflict (user_id, course_id) do nothing;
    end if;

    perform public._notify(p_user, 'course_completed', '🎓 Trilha concluída!',
      'Parabéns! Você concluiu "' || v_course.title || '".' ||
      case when v_course.certificate_enabled then ' Seu certificado já está disponível.' else '' end,
      '/certificados', 'course_completed:' || p_course);
    perform public._audit(p_user, 'course.completed', 'course', p_course::text, v_course.title, null);
    return true;
  end if;

  return false;
end;
$$;

-- Recalcula o progresso do módulo e propaga para a trilha.
-- Retorna {"module_completed": bool, "course_completed": bool}
create or replace function public._recalc_module(p_user uuid, p_module uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course        uuid;
  v_title         text;
  v_points        integer;
  v_total         integer;
  v_done          integer;
  v_req_total     integer;
  v_req_done      integer;
  v_exam_id       uuid;
  v_exam_req      boolean := false;
  v_passed        boolean;
  v_best          numeric;
  v_has_attempts  boolean := false;
  v_items         integer;
  v_items_done    integer;
  v_percent       numeric;
  v_status        text;
  v_prev          text;
  v_any           boolean;
  v_course_done   boolean := false;
begin
  select m.course_id, m.title, m.points into v_course, v_title, v_points
  from public.modules m where m.id = p_module;

  select count(*),
         count(*) filter (where lp.status = 'completed'),
         count(*) filter (where l.is_required),
         count(*) filter (where l.is_required and lp.status = 'completed'),
         bool_or(lp.id is not null)
    into v_total, v_done, v_req_total, v_req_done, v_any
  from public.lessons l
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = p_user
  where l.module_id = p_module and l.status = 'published' and l.deleted_at is null;

  select e.id, e.is_required into v_exam_id, v_exam_req
  from public.exams e
  where e.module_id = p_module and e.status = 'published' and e.deleted_at is null
  limit 1;
  v_exam_req := coalesce(v_exam_req, false);

  if v_exam_id is not null then
    select coalesce(bool_or(a.passed), false), max(a.score_percent), count(*) > 0
      into v_passed, v_best, v_has_attempts
    from public.exam_attempts a
    where a.exam_id = v_exam_id and a.user_id = p_user and a.status in ('submitted', 'expired');
  end if;

  if v_req_total > 0 or v_exam_req then
    v_items      := v_req_total + case when v_exam_req then 1 else 0 end;
    v_items_done := v_req_done + case when v_exam_req and coalesce(v_passed, false) then 1 else 0 end;
  else
    v_items      := v_total;
    v_items_done := v_done;
  end if;

  v_percent := case when v_items > 0 then round(v_items_done::numeric * 100 / v_items, 2) else 0 end;

  v_status := case
    when v_items > 0 and v_items_done = v_items then 'completed'
    when coalesce(v_any, false) or v_has_attempts then 'in_progress'
    else 'not_started'
  end;

  select status into v_prev from public.module_progress where user_id = p_user and module_id = p_module;

  insert into public.module_progress (user_id, module_id, course_id, lessons_completed, lessons_total, percent,
                                      exam_required, exam_passed, best_score, status, started_at, completed_at, updated_at)
  values (p_user, p_module, v_course, v_done, v_total, v_percent, v_exam_req,
          case when v_exam_id is not null then coalesce(v_passed, false) end, v_best, v_status,
          case when v_status <> 'not_started' then now() end,
          case when v_status = 'completed' then now() end, now())
  on conflict (user_id, module_id) do update
    set lessons_completed = excluded.lessons_completed,
        lessons_total     = excluded.lessons_total,
        percent           = excluded.percent,
        exam_required     = excluded.exam_required,
        exam_passed       = excluded.exam_passed,
        best_score        = excluded.best_score,
        status            = excluded.status,
        started_at        = coalesce(public.module_progress.started_at, excluded.started_at),
        completed_at      = case when excluded.status = 'completed'
                                 then coalesce(public.module_progress.completed_at, now()) else null end,
        updated_at        = now();

  if v_status = 'completed' and coalesce(v_prev, '') <> 'completed' then
    perform public._award_points(p_user, v_points, 'module_completed', p_module);
    perform public._notify(p_user, 'module_completed', '🏆 Módulo concluído!',
      'Você concluiu o módulo "' || v_title || '".', '/modulos/' || p_module, 'module_completed:' || p_module);
    perform public._audit(p_user, 'module.completed', 'module', p_module::text, v_title, null);
  end if;

  v_course_done := public._recalc_course(p_user, v_course);
  perform public._award_badges(p_user);

  return jsonb_build_object(
    'module_completed', v_status = 'completed' and coalesce(v_prev, '') <> 'completed',
    'course_completed', v_course_done
  );
end;
$$;

-- Tenta concluir a aula se todos os requisitos estiverem cumpridos.
create or replace function public._try_complete_lesson(p_user uuid, p_lesson uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l         public.lessons;
  lp        public.lesson_progress;
  v_missing text[] := '{}';
  v_result  jsonb := '{}'::jsonb;
begin
  select * into l from public.lessons where id = p_lesson;
  lp := public._ensure_lesson_progress(p_user, p_lesson);

  if lp.status = 'completed' then
    return jsonb_build_object('completed', true, 'already', true, 'missing', '[]'::jsonb);
  end if;

  if l.video_id is not null and l.video_required and lp.video_completed_at is null then
    v_missing := array_append(v_missing, 'video');
  end if;
  if l.activity_enabled and lp.activity_completed_at is null then
    v_missing := array_append(v_missing, 'activity');
  end if;

  if cardinality(v_missing) > 0 then
    return jsonb_build_object('completed', false, 'missing', to_jsonb(v_missing));
  end if;

  update public.lesson_progress
     set status = 'completed', completed_at = now(), updated_at = now()
   where id = lp.id;

  perform public._award_points(p_user, l.points, 'lesson_completed', l.id);
  perform public._audit(p_user, 'lesson.completed', 'lesson', l.id::text, l.title, null);
  v_result := public._recalc_module(p_user, l.module_id);

  return jsonb_build_object('completed', true, 'missing', '[]'::jsonb) || v_result;
end;
$$;

-- Corrige uma tentativa. p_final_status: 'submitted' | 'expired'
create or replace function public._grade_attempt(p_attempt uuid, p_final_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a           public.exam_attempts;
  e           public.exams;
  q           record;
  v_sel       uuid[];
  v_ok        boolean;
  v_earned    numeric := 0;
  v_possible  numeric := 0;
  v_correct   integer := 0;
  v_wrong     integer := 0;
  v_score     numeric;
  v_passed    boolean;
  v_used      integer;
  v_title     text;
  v_progress  jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt for update;
  if a.status <> 'in_progress' then
    return jsonb_build_object('attempt_id', a.id, 'already_graded', true);
  end if;
  select * into e from public.exams where id = a.exam_id;

  for q in
    select qq.id, qq.points,
           coalesce((select array_agg(o.id order by o.id)
                     from public.question_options o
                     where o.question_id = qq.id and o.is_correct), '{}'::uuid[]) as correct_ids
    from public.questions qq
    where qq.id = any (a.question_ids)
  loop
    select coalesce(array_agg(distinct s order by s), '{}'::uuid[]) into v_sel
    from public.exam_answers ans, unnest(ans.selected_option_ids) s
    where ans.attempt_id = a.id and ans.question_id = q.id;

    v_ok := cardinality(v_sel) > 0 and v_sel = q.correct_ids;
    v_possible := v_possible + q.points;
    if v_ok then
      v_earned := v_earned + q.points;
      v_correct := v_correct + 1;
    else
      v_wrong := v_wrong + 1;
    end if;

    insert into public.exam_answers (attempt_id, question_id, selected_option_ids, is_correct, points_awarded)
    values (a.id, q.id, v_sel, v_ok, case when v_ok then q.points else 0 end)
    on conflict (attempt_id, question_id) do update
      set is_correct = excluded.is_correct, points_awarded = excluded.points_awarded;
  end loop;

  v_score  := case when v_possible > 0 then round(v_earned * 100 / v_possible, 2) else 0 end;
  v_passed := v_score >= e.passing_score;

  update public.exam_attempts
     set status             = p_final_status,
         submitted_at       = now(),
         time_spent_seconds = greatest(0, extract(epoch from (least(now(), coalesce(expires_at, now())) - started_at))::integer),
         score_percent      = v_score,
         points_earned      = v_earned,
         points_possible    = v_possible,
         correct_count      = v_correct,
         wrong_count        = v_wrong,
         passed             = v_passed
   where id = a.id;

  select count(*) into v_used from public.exam_attempts
  where exam_id = a.exam_id and user_id = a.user_id and status in ('submitted', 'expired');

  select title into v_title from public.modules where id = e.module_id;

  if v_passed then
    perform public._award_points(a.user_id, e.points, 'exam_passed', e.id);
    perform public._notify(a.user_id, 'exam_passed', '✅ Você foi aprovado!',
      'Nota ' || v_score || '% na prova "' || e.title || '".', '/provas/resultado/' || a.id, 'exam_passed:' || e.id);
  else
    perform public._notify(a.user_id, 'exam_failed', 'Resultado da prova "' || e.title || '"',
      'Você não atingiu a nota mínima (' || e.passing_score || '%). Tentativa ' || v_used ||
      coalesce(' de ' || e.max_attempts, '') || '.', '/provas/resultado/' || a.id, null);
  end if;

  perform public._audit(a.user_id, 'exam.submitted', 'exam_attempt', a.id::text,
    e.title || ' — ' || v_score || '%', jsonb_build_object('score', v_score, 'passed', v_passed, 'attempt', a.attempt_number));

  v_progress := public._recalc_module(a.user_id, e.module_id);

  return jsonb_build_object('attempt_id', a.id, 'score_percent', v_score, 'passed', v_passed,
                            'correct_count', v_correct, 'wrong_count', v_wrong) || v_progress;
end;
$$;

-- Matricula um usuário nas trilhas publicadas que fazem parte do seu público.
create or replace function public._enroll_user(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.enrollments (user_id, course_id, due_date, source)
  select p_user, c.id,
         case when c.due_days is not null then current_date + c.due_days end,
         case when c.audience = 'groups' then 'group' else 'auto' end
  from public.courses c
  where c.status = 'published' and c.deleted_at is null
    and public.user_in_course_audience(p_user, c.id)
  on conflict (user_id, course_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Cria o perfil quando um usuário é criado no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, invited_at)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    now()
  )
  on conflict (id) do nothing;
  perform public._enroll_user(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- FUNÇÕES PÚBLICAS (RPC) — validam auth.uid() e permissões internamente
-- =============================================================================

create or replace function public.fn_track_lesson_view(p_lesson uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  lp    public.lesson_progress;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_lesson(p_lesson) then raise exception 'Aula indisponível.'; end if;

  lp := public._ensure_lesson_progress(v_uid, p_lesson);
  update public.lesson_progress
     set view_count = view_count + 1, last_viewed_at = now(), updated_at = now()
   where id = lp.id
  returning * into lp;

  insert into public.daily_activity (user_id, activity_date, lessons_viewed)
  values (v_uid, (now() at time zone 'America/Sao_Paulo')::date, 1)
  on conflict (user_id, activity_date) do update
    set lessons_viewed = public.daily_activity.lessons_viewed + 1;

  perform public._touch_activity(v_uid);
  if lp.view_count = 1 then
    perform public._recalc_module(v_uid, lp.module_id);
  end if;

  return to_jsonb(lp);
end;
$$;

create or replace function public.fn_track_study_time(p_lesson uuid, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  lp    public.lesson_progress;
  v_sec integer;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_lesson(p_lesson) then raise exception 'Aula indisponível.'; end if;

  lp := public._ensure_lesson_progress(v_uid, p_lesson);
  v_sec := least(greatest(coalesce(p_seconds, 0), 0), 60);
  if lp.last_heartbeat_at is not null then
    v_sec := least(v_sec, ceil(extract(epoch from now() - lp.last_heartbeat_at))::integer + 5);
  end if;
  if v_sec <= 0 then return; end if;

  update public.lesson_progress
     set time_spent_seconds = time_spent_seconds + v_sec, last_heartbeat_at = now(), updated_at = now()
   where id = lp.id;

  insert into public.daily_activity (user_id, activity_date, seconds_studied)
  values (v_uid, (now() at time zone 'America/Sao_Paulo')::date, v_sec)
  on conflict (user_id, activity_date) do update
    set seconds_studied = public.daily_activity.seconds_studied + excluded.seconds_studied;

  perform public._touch_activity(v_uid);
end;
$$;

-- Sinal de progresso de vídeo. O avanço aceito é limitado ao tempo real
-- decorrido desde o último sinal (com folga para velocidade 2x).
create or replace function public.fn_track_video(p_lesson uuid, p_position numeric, p_duration numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  l           public.lessons;
  v           public.videos;
  lp          public.lesson_progress;
  v_dur       numeric;
  v_elapsed   numeric;
  v_allowed   numeric;
  v_pos       numeric;
  v_max       numeric;
  v_pct       numeric;
  v_completed boolean := false;
  v_lesson    jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_lesson(p_lesson) then raise exception 'Aula indisponível.'; end if;

  select * into l from public.lessons where id = p_lesson;
  if l.video_id is null then
    return jsonb_build_object('tracked', false);
  end if;
  select * into v from public.videos where id = l.video_id;

  lp := public._ensure_lesson_progress(v_uid, p_lesson);

  v_dur := coalesce(v.duration_seconds, lp.video_duration_seconds,
                    case when p_duration > 0 then p_duration end);
  if v_dur is null or v_dur <= 0 then
    return jsonb_build_object('tracked', false);
  end if;

  v_elapsed := least(coalesce(extract(epoch from now() - lp.video_last_signal_at), 0), 120);
  v_allowed := lp.video_max_position_seconds + v_elapsed * 2.5 + 20;
  v_pos     := greatest(0, least(coalesce(p_position, 0), v_dur));
  v_max     := greatest(lp.video_max_position_seconds, least(v_pos, v_allowed));
  v_pct     := least(100, round(v_max * 100 / v_dur, 2));
  if v_pos >= v_dur - 1 and v_max >= v_dur - 3 then
    v_pct := 100;
  end if;

  v_completed := lp.video_completed_at is null and v_pct >= l.min_video_percent;

  update public.lesson_progress
     set video_position_seconds     = v_pos,
         video_max_position_seconds = v_max,
         video_duration_seconds     = coalesce(video_duration_seconds, v_dur),
         video_percent              = greatest(video_percent, v_pct),
         video_started_at           = coalesce(video_started_at, now()),
         video_last_signal_at       = now(),
         video_completed_at         = case when v_completed then now() else video_completed_at end,
         updated_at                 = now()
   where id = lp.id;

  if v_completed then
    v_lesson := public._try_complete_lesson(v_uid, p_lesson);
  end if;

  return jsonb_build_object('tracked', true, 'percent', greatest(lp.video_percent, v_pct),
                            'video_completed', v_completed or lp.video_completed_at is not null,
                            'lesson', v_lesson);
end;
$$;

create or replace function public.fn_submit_activity(p_lesson uuid, p_response text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  l     public.lessons;
  lp    public.lesson_progress;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_lesson(p_lesson) then raise exception 'Aula indisponível.'; end if;

  select * into l from public.lessons where id = p_lesson;
  if not l.activity_enabled then raise exception 'Esta aula não possui atividade.'; end if;
  if l.activity_requires_response and char_length(trim(coalesce(p_response, ''))) < 3 then
    raise exception 'Escreva sua resposta para concluir a atividade.';
  end if;

  lp := public._ensure_lesson_progress(v_uid, p_lesson);
  update public.lesson_progress
     set activity_response = left(nullif(trim(p_response), ''), 5000),
         activity_completed_at = coalesce(activity_completed_at, now()),
         updated_at = now()
   where id = lp.id;

  perform public._audit(v_uid, 'activity.submitted', 'lesson', p_lesson::text, l.title, null);
  return public._try_complete_lesson(v_uid, p_lesson);
end;
$$;

create or replace function public.fn_complete_lesson(p_lesson uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_lesson(p_lesson) then raise exception 'Aula indisponível.'; end if;
  return public._try_complete_lesson(v_uid, p_lesson);
end;
$$;

-- Inicia (ou retoma) uma tentativa de prova.
create or replace function public.fn_start_exam(p_exam uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  e          public.exams;
  v_open     public.exam_attempts;
  v_used     integer;
  v_qids     uuid[];
  v_order    jsonb;
  v_id       uuid;
  v_stale    uuid;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;

  select * into e from public.exams where id = p_exam and deleted_at is null;
  if not found or e.status <> 'published' then raise exception 'Prova indisponível.'; end if;
  if not public.can_access_module(e.module_id) then raise exception 'Este módulo ainda não foi liberado para você.'; end if;

  -- Fecha tentativas cujo tempo acabou.
  for v_stale in
    select id from public.exam_attempts
    where exam_id = p_exam and user_id = v_uid and status = 'in_progress'
      and expires_at is not null and now() > expires_at + interval '30 seconds'
  loop
    perform public._grade_attempt(v_stale, 'expired');
  end loop;

  select * into v_open from public.exam_attempts
  where exam_id = p_exam and user_id = v_uid and status = 'in_progress'
  order by started_at desc limit 1;
  if found then
    return v_open.id;
  end if;

  if exists (select 1 from public.exam_attempts where exam_id = p_exam and user_id = v_uid and passed) then
    raise exception 'Você já foi aprovado nesta prova.';
  end if;

  select count(*) into v_used from public.exam_attempts
  where exam_id = p_exam and user_id = v_uid;
  if e.max_attempts is not null and v_used >= e.max_attempts then
    raise exception 'Você já utilizou todas as % tentativas desta prova.', e.max_attempts;
  end if;

  if e.selection_mode = 'random' then
    select array_agg(x.id order by x.ord) into v_qids
    from (
      select q.id, random() as ord
      from public.questions q
      where q.status = 'published' and q.deleted_at is null and q.type <> 'essay'
        and (not exists (select 1 from public.exam_questions eq where eq.exam_id = e.id)
             or q.id in (select eq.question_id from public.exam_questions eq where eq.exam_id = e.id))
        and (cardinality(e.random_categories) = 0 or q.category = any (e.random_categories))
        and (cardinality(e.random_difficulties) = 0 or q.difficulty = any (e.random_difficulties))
      order by ord
      limit coalesce(e.question_count, 200)
    ) x;
  else
    select array_agg(x.id order by x.ord) into v_qids
    from (
      select q.id,
             case when e.shuffle_questions then random() else eq.position::double precision end as ord
      from public.exam_questions eq
      join public.questions q on q.id = eq.question_id
      where eq.exam_id = e.id and q.status = 'published' and q.deleted_at is null and q.type <> 'essay'
      order by ord
      limit coalesce(e.question_count, 200)
    ) x;
  end if;

  if v_qids is null or cardinality(v_qids) = 0 then
    raise exception 'Esta prova ainda não possui questões publicadas.';
  end if;

  select coalesce(jsonb_object_agg(q.id, (
           select jsonb_agg(o.id order by case when e.shuffle_options then random() else o.position::double precision end)
           from public.question_options o where o.question_id = q.id)), '{}'::jsonb)
    into v_order
  from public.questions q
  where q.id = any (v_qids);

  insert into public.exam_attempts (exam_id, user_id, attempt_number, question_ids, option_order, expires_at)
  values (e.id, v_uid, v_used + 1, v_qids, v_order,
          case when e.time_limit_minutes is not null then now() + make_interval(mins => e.time_limit_minutes) end)
  returning id into v_id;

  perform public._audit(v_uid, 'exam.started', 'exam_attempt', v_id::text, e.title, jsonb_build_object('attempt', v_used + 1));
  perform public._touch_activity(v_uid);
  return v_id;
end;
$$;

-- Retorna a tentativa em andamento SEM gabarito.
create or replace function public.fn_get_attempt(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a     public.exam_attempts;
  e     public.exams;
  v_questions jsonb;
  v_answers   jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if not found or a.user_id <> v_uid then raise exception 'Tentativa não encontrada.'; end if;
  select * into e from public.exams where id = a.exam_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id,
           'statement', q.statement,
           'type', q.type,
           'options', (
             select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text) order by ord.n), '[]'::jsonb)
             from jsonb_array_elements_text(a.option_order -> q.id::text) with ordinality as ord(opt_id, n)
             join public.question_options o on o.id = ord.opt_id::uuid
           )
         ) order by qi.n), '[]'::jsonb)
    into v_questions
  from unnest(a.question_ids) with ordinality as qi(qid, n)
  join public.questions q on q.id = qi.qid;

  select coalesce(jsonb_object_agg(ans.question_id, to_jsonb(ans.selected_option_ids)), '{}'::jsonb)
    into v_answers
  from public.exam_answers ans where ans.attempt_id = a.id;

  return jsonb_build_object(
    'attempt_id', a.id, 'exam_id', e.id, 'exam_title', e.title, 'module_id', e.module_id,
    'status', a.status, 'attempt_number', a.attempt_number, 'max_attempts', e.max_attempts,
    'started_at', a.started_at, 'expires_at', a.expires_at, 'server_now', now(),
    'questions', v_questions, 'answers', v_answers
  );
end;
$$;

create or replace function public.fn_save_answer(p_attempt uuid, p_question uuid, p_option_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a     public.exam_attempts;
  v_ids uuid[];
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if not found or a.user_id <> v_uid then raise exception 'Tentativa não encontrada.'; end if;
  if a.status <> 'in_progress' then raise exception 'Esta tentativa já foi finalizada.'; end if;
  if a.expires_at is not null and now() > a.expires_at + interval '30 seconds' then
    raise exception 'O tempo da prova terminou.';
  end if;
  if not (p_question = any (a.question_ids)) then raise exception 'Questão inválida.'; end if;

  select coalesce(array_agg(distinct o.id), '{}'::uuid[]) into v_ids
  from public.question_options o
  where o.question_id = p_question and o.id = any (coalesce(p_option_ids, '{}'::uuid[]));

  insert into public.exam_answers (attempt_id, question_id, selected_option_ids, answered_at)
  values (a.id, p_question, v_ids, now())
  on conflict (attempt_id, question_id) do update
    set selected_option_ids = excluded.selected_option_ids, answered_at = now();
end;
$$;

-- Finaliza a tentativa. p_answers: {"<question_id>": ["<option_id>", ...], ...}
create or replace function public.fn_submit_exam(p_attempt uuid, p_answers jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  a        public.exam_attempts;
  v_key    text;
  v_late   boolean;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if not found or a.user_id <> v_uid then raise exception 'Tentativa não encontrada.'; end if;
  if a.status <> 'in_progress' then
    return jsonb_build_object('attempt_id', a.id, 'already_graded', true);
  end if;

  v_late := a.expires_at is not null and now() > a.expires_at + interval '30 seconds';

  if p_answers is not null and not v_late then
    for v_key in select jsonb_object_keys(p_answers) loop
      perform public.fn_save_answer(
        a.id, v_key::uuid,
        array(select jsonb_array_elements_text(p_answers -> v_key)::uuid)
      );
    end loop;
  end if;

  return public._grade_attempt(a.id, case when v_late then 'expired' else 'submitted' end);
end;
$$;

-- Resultado + revisão respeitando as configurações da prova.
create or replace function public.fn_get_attempt_result(p_attempt uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_staff   boolean := public.is_staff();
  a         public.exam_attempts;
  e         public.exams;
  v_used    integer;
  v_review  boolean;
  v_show    boolean;
  v_items   jsonb;
  v_history jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt;
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

-- Visão da trilha para o colaborador logado (módulos, bloqueios e progresso).
create or replace function public.fn_course_outline(p_course uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Não autenticado.'; end if;
  if not public.can_access_course(p_course) then raise exception 'Trilha indisponível.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'title', m.title, 'description', m.description, 'category', m.category,
           'cover_path', m.cover_path, 'thumbnail_path', m.thumbnail_path, 'position', m.position,
           'due_date', m.due_date,
           'state', public.module_unlock_state(v_uid, m.id),
           'release_at', public.module_release_at(v_uid, m.id),
           'lessons_total', (select count(*) from public.lessons l
                             where l.module_id = m.id and l.status = 'published' and l.deleted_at is null),
           'lessons_completed', coalesce(mp.lessons_completed, 0),
           'percent', coalesce(mp.percent, 0),
           'status', coalesce(mp.status, 'not_started'),
           'completed_at', mp.completed_at,
           'exam', (select jsonb_build_object(
                      'id', e.id, 'title', e.title, 'is_required', e.is_required,
                      'passing_score', e.passing_score, 'max_attempts', e.max_attempts,
                      'attempts_used', (select count(*) from public.exam_attempts a
                                        where a.exam_id = e.id and a.user_id = v_uid and a.status <> 'in_progress'),
                      'passed', coalesce((select bool_or(a.passed) from public.exam_attempts a
                                          where a.exam_id = e.id and a.user_id = v_uid), false),
                      'best_score', (select max(a.score_percent) from public.exam_attempts a
                                     where a.exam_id = e.id and a.user_id = v_uid))
                    from public.exams e
                    where e.module_id = m.id and e.status = 'published' and e.deleted_at is null
                    limit 1),
           'competencies', (select coalesce(jsonb_agg(c.name order by c.name), '[]'::jsonb)
                            from public.module_competencies mc join public.competencies c on c.id = mc.competency_id
                            where mc.module_id = m.id)
         ) order by m.position, m.created_at), '[]'::jsonb)
    into v_result
  from public.modules m
  left join public.module_progress mp on mp.module_id = m.id and mp.user_id = v_uid
  where m.course_id = p_course and m.status = 'published' and m.deleted_at is null;

  return v_result;
end;
$$;

create or replace function public.fn_module_state(p_module uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'state', public.module_unlock_state(auth.uid(), p_module),
    'release_at', public.module_release_at(auth.uid(), p_module)
  );
$$;

-- Validação pública de certificado (expõe somente dados do certificado).
create or replace function public.fn_verify_certificate(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', c.code, 'recipient_name', c.recipient_name, 'course_title', c.course_title,
    'workload_hours', c.workload_hours, 'issued_at', c.issued_at
  )
  from public.certificates c
  where c.code = upper(trim(p_code));
$$;

create or replace function public.fn_ranking(p_limit integer default 20)
returns table (
  user_id uuid, full_name text, avatar_path text, total_points integer,
  modules_completed bigint, avg_score numeric, longest_streak integer, rank_position bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.app_settings;
begin
  select * into s from public.app_settings where id;
  if not coalesce(s.ranking_enabled, false) and not public.is_staff() then
    return;
  end if;
  if not public.is_active_user() then return; end if;

  return query
  with base as (
    select p.id, p.full_name, p.avatar_path, p.total_points, p.longest_streak,
           (select count(*) from public.module_progress mp where mp.user_id = p.id and mp.status = 'completed') as mods,
           (select round(avg(best), 1) from (
              select max(a.score_percent) as best from public.exam_attempts a
              where a.user_id = p.id and a.status <> 'in_progress' group by a.exam_id) t) as score
    from public.profiles p
    where p.deleted_at is null and p.status = 'active' and p.role_id = 'collaborator'
  )
  select b.id, b.full_name, b.avatar_path, b.total_points, b.mods, b.score, b.longest_streak,
         row_number() over (order by
           case coalesce(s.ranking_criteria, 'points')
             when 'completions' then b.mods::numeric
             when 'scores' then coalesce(b.score, 0)
             when 'streak' then b.longest_streak::numeric
             else b.total_points::numeric
           end desc, b.total_points desc, b.full_name)
  from base b
  order by 8
  limit greatest(1, least(p_limit, 100));
end;
$$;

create or replace function public.fn_mark_notifications_read(p_ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
$$;

create or replace function public.fn_log_event(p_action text, p_entity_type text, p_entity_id text default null, p_summary text default null, p_changes jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  -- Usuário comum só pode registrar eventos de sessão.
  if not public.is_staff() and p_action not in ('auth.login', 'auth.logout', 'auth.password_set') then
    raise exception 'Ação de auditoria não permitida.';
  end if;
  perform public._audit(auth.uid(), p_action, p_entity_type, p_entity_id, left(p_summary, 500), p_changes);
  if p_action = 'auth.login' then
    perform public._touch_activity(auth.uid());
  end if;
end;
$$;

-- Ativa o perfil depois que o convidado define a senha.
create or replace function public.fn_activate_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set status = 'active', activated_at = coalesce(activated_at, now())
   where id = auth.uid() and status = 'invited';
end;
$$;

-- ----------------------------------------------------------------------------
-- Funções administrativas (verificam is_admin())
-- ----------------------------------------------------------------------------

create or replace function public.fn_admin_sync_enrollments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_uid   uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  for v_uid in select id from public.profiles where deleted_at is null and status <> 'inactive' loop
    v_total := v_total + public._enroll_user(v_uid);
  end loop;
  return v_total;
end;
$$;

-- Recalcula o progresso de todos os usuários de um módulo (após mudar regras).
create or replace function public.fn_admin_recalc_module(p_module uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  for v_uid in select distinct user_id from public.module_progress where module_id = p_module
               union select distinct user_id from public.lesson_progress where module_id = p_module loop
    perform public._recalc_module(v_uid, p_module);
  end loop;
end;
$$;

create or replace function public.fn_admin_reorder(p_kind text, p_parent uuid, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if p_kind = 'courses' then
    update public.courses c set position = o.n from unnest(p_ids) with ordinality o(id, n) where c.id = o.id;
  elsif p_kind = 'modules' then
    update public.modules m set position = o.n from unnest(p_ids) with ordinality o(id, n)
     where m.id = o.id and m.course_id = p_parent;
  elsif p_kind = 'lessons' then
    update public.lessons l set position = o.n from unnest(p_ids) with ordinality o(id, n)
     where l.id = o.id and l.module_id = p_parent;
  elsif p_kind = 'exam_questions' then
    update public.exam_questions eq set position = o.n from unnest(p_ids) with ordinality o(id, n)
     where eq.question_id = o.id and eq.exam_id = p_parent;
  elsif p_kind = 'lesson_materials' then
    update public.lesson_materials lm set position = o.n from unnest(p_ids) with ordinality o(id, n)
     where lm.material_id = o.id and lm.lesson_id = p_parent;
  elsif p_kind = 'question_options' then
    update public.question_options qo set position = o.n from unnest(p_ids) with ordinality o(id, n)
     where qo.id = o.id and qo.question_id = p_parent;
  else
    raise exception 'Tipo de ordenação inválido.';
  end if;
end;
$$;

create or replace function public.fn_admin_duplicate_lesson(p_lesson uuid, p_target_module uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
  v_module uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  select coalesce(p_target_module, module_id) into v_module from public.lessons where id = p_lesson;

  insert into public.lessons (module_id, title, description, content_html, content_json, video_id, position, status,
    is_required, video_required, min_video_percent, activity_enabled, activity_title, activity_instructions,
    activity_requires_response, estimated_minutes, points, created_by, updated_by)
  select v_module,
         case when p_target_module is null then left(title || ' (cópia)', 160) else title end,
         description, content_html, content_json, video_id,
         (select coalesce(max(position), 0) + 1 from public.lessons where module_id = v_module),
         'draft', is_required, video_required, min_video_percent, activity_enabled, activity_title,
         activity_instructions, activity_requires_response, estimated_minutes, points, auth.uid(), auth.uid()
  from public.lessons where id = p_lesson
  returning id into v_new;

  insert into public.lesson_materials (lesson_id, material_id, position)
  select v_new, material_id, position from public.lesson_materials where lesson_id = p_lesson;

  perform public._audit(auth.uid(), 'lesson.duplicated', 'lesson', v_new::text, null, jsonb_build_object('source', p_lesson));
  return v_new;
end;
$$;

create or replace function public.fn_admin_duplicate_exam(p_exam uuid, p_target_module uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if exists (select 1 from public.exams where module_id = p_target_module and deleted_at is null) then
    raise exception 'O módulo de destino já possui uma prova.';
  end if;

  insert into public.exams (module_id, title, description, instructions, passing_score, question_count, max_attempts,
    time_limit_minutes, selection_mode, random_categories, random_difficulties, shuffle_questions, shuffle_options,
    show_result, show_answers, show_explanations, is_required, points, status, created_by, updated_by)
  select p_target_module, title, description, instructions, passing_score, question_count, max_attempts,
    time_limit_minutes, selection_mode, random_categories, random_difficulties, shuffle_questions, shuffle_options,
    show_result, show_answers, show_explanations, is_required, points, 'draft', auth.uid(), auth.uid()
  from public.exams where id = p_exam
  returning id into v_new;

  insert into public.exam_questions (exam_id, question_id, position)
  select v_new, question_id, position from public.exam_questions where exam_id = p_exam;

  perform public._audit(auth.uid(), 'exam.duplicated', 'exam', v_new::text, null, jsonb_build_object('source', p_exam));
  return v_new;
end;
$$;

create or replace function public.fn_admin_duplicate_module(p_module uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new    uuid;
  v_lesson uuid;
  v_exam   uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;

  insert into public.modules (course_id, title, description, category, cover_path, thumbnail_path, featured_image_path,
    position, status, release_type, release_at, release_days, due_date, points, created_by, updated_by)
  select course_id, left(title || ' (cópia)', 160), description, category, cover_path, thumbnail_path, featured_image_path,
    (select coalesce(max(position), 0) + 1 from public.modules m2 where m2.course_id = m.course_id),
    'draft', release_type, release_at, release_days, due_date, points, auth.uid(), auth.uid()
  from public.modules m where id = p_module
  returning id into v_new;

  for v_lesson in select id from public.lessons where module_id = p_module and deleted_at is null order by position loop
    perform public.fn_admin_duplicate_lesson(v_lesson, v_new);
  end loop;

  insert into public.module_competencies (module_id, competency_id)
  select v_new, competency_id from public.module_competencies where module_id = p_module;

  select id into v_exam from public.exams where module_id = p_module and deleted_at is null limit 1;
  if v_exam is not null then
    perform public.fn_admin_duplicate_exam(v_exam, v_new);
  end if;

  perform public._audit(auth.uid(), 'module.duplicated', 'module', v_new::text, null, jsonb_build_object('source', p_module));
  return v_new;
end;
$$;

-- Notifica usuários sobre módulos liberados hoje (chamado pela rotina diária).
create or replace function public.fn_admin_notify_releases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_count integer := 0;
begin
  -- EXECUTE concedido apenas ao service_role (rotina diária) — ver 002_rls.sql.
  for r in
    select e.user_id, m.id as module_id, m.title
    from public.modules m
    join public.courses c on c.id = m.course_id and c.status = 'published' and c.deleted_at is null
    join public.enrollments e on e.course_id = c.id and e.status = 'active'
    where m.status = 'published' and m.deleted_at is null and m.release_type <> 'immediate'
      and public.module_release_at(e.user_id, m.id) <= now()
      and public.module_release_at(e.user_id, m.id) > now() - interval '7 days'
  loop
    perform public._notify(r.user_id, 'module_released', '📚 Novo módulo liberado',
      'O módulo "' || r.title || '" já está disponível.', '/modulos/' || r.module_id, 'module_released:' || r.module_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- =============================================================================
-- VIEWS DE ANALYTICS (security_invoker: respeitam RLS de quem consulta)
-- =============================================================================

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
  od.next_due_date
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

create or replace view public.v_module_stats
with (security_invoker = true) as
select
  m.id as module_id, m.course_id, m.title, m.position, m.status,
  (select count(*) from public.enrollments en where en.course_id = m.course_id and en.status <> 'cancelled') as enrolled,
  (select count(*) from public.module_progress mp where mp.module_id = m.id and mp.status = 'completed') as completed,
  (select count(*) from public.module_progress mp where mp.module_id = m.id and mp.status = 'in_progress') as in_progress,
  (select round(avg(mp.percent), 2) from public.enrollments en
     left join public.module_progress mp on mp.module_id = m.id and mp.user_id = en.user_id
     where en.course_id = m.course_id and en.status <> 'cancelled') as avg_percent,
  e.id as exam_id,
  ex.users_attempted, ex.users_passed, ex.total_attempts, ex.avg_best_score, ex.avg_score,
  case when ex.users_attempted > 0 then round(ex.users_passed::numeric * 100 / ex.users_attempted, 2) end as approval_rate,
  case when ex.users_attempted > 0 then round(ex.total_attempts::numeric / ex.users_attempted, 2) end as avg_attempts,
  ex.users_failed_twice
from public.modules m
left join public.exams e on e.module_id = m.id and e.deleted_at is null
left join lateral (
  select count(distinct a.user_id) as users_attempted,
         count(distinct a.user_id) filter (where a.passed) as users_passed,
         count(*) as total_attempts,
         round(avg(a.score_percent), 2) as avg_score,
         (select round(avg(best), 2) from (select max(a2.score_percent) best from public.exam_attempts a2
            where a2.exam_id = e.id and a2.status <> 'in_progress' group by a2.user_id) b) as avg_best_score,
         (select count(*) from (select a3.user_id from public.exam_attempts a3
            where a3.exam_id = e.id and a3.passed is false group by a3.user_id having count(*) >= 2) f) as users_failed_twice
  from public.exam_attempts a
  where a.exam_id = e.id and a.status <> 'in_progress'
) ex on true
where m.deleted_at is null;

create or replace view public.v_lesson_stats
with (security_invoker = true) as
select
  l.id as lesson_id, l.module_id, m.course_id, l.title, l.position, l.status, l.is_required,
  coalesce(sum(lp.view_count), 0)                                   as total_views,
  count(lp.id)                                                      as unique_viewers,
  count(lp.id) filter (where lp.status = 'completed')               as completions,
  count(lp.id) filter (where lp.status = 'in_progress'
                         and lp.last_viewed_at < now() - interval '7 days') as abandoned,
  round(avg(lp.time_spent_seconds))                                 as avg_time_seconds,
  round(avg(lp.video_percent) filter (where lp.video_started_at is not null), 2) as avg_video_percent
from public.lessons l
join public.modules m on m.id = l.module_id
left join public.lesson_progress lp on lp.lesson_id = l.id
where l.deleted_at is null
group by l.id, m.course_id;

create or replace view public.v_question_stats
with (security_invoker = true) as
select
  q.id as question_id, q.number, q.statement, q.type, q.category, q.difficulty, q.module_id,
  a.exam_id,
  count(ans.id)                                  as total_answers,
  count(ans.id) filter (where ans.is_correct)    as correct,
  count(ans.id) filter (where not ans.is_correct) as wrong,
  case when count(ans.id) > 0
       then round(count(ans.id) filter (where ans.is_correct)::numeric * 100 / count(ans.id), 2) end as pct_correct
from public.exam_answers ans
join public.exam_attempts a on a.id = ans.attempt_id and a.status <> 'in_progress'
join public.questions q on q.id = ans.question_id
group by q.id, a.exam_id;

create or replace view public.v_exam_stats
with (security_invoker = true) as
select
  e.id as exam_id, e.module_id, e.title, e.passing_score, e.status,
  count(a.id)                                       as total_attempts,
  count(distinct a.user_id)                         as users_attempted,
  count(distinct a.user_id) filter (where a.passed) as users_passed,
  round(avg(a.score_percent), 2)                    as avg_score,
  round(avg(a.time_spent_seconds))                  as avg_time_seconds
from public.exams e
left join public.exam_attempts a on a.exam_id = e.id and a.status <> 'in_progress'
where e.deleted_at is null
group by e.id;

-- ===== migrations/002_rls.sql =====
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

-- ===== migrations/003_storage.sql =====
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

-- ===== migrations/004_seed.sql =====
-- =============================================================================
-- Connect Skin Academy — 004_seed.sql
-- Dados iniciais: configurações, badges, grupos, competências e a
-- Trilha de Onboarding Connect Skin (4 blocos / 17 tópicos).
--
-- O conteúdo das aulas é um ROTEIRO baseado na estrutura oficial do
-- onboarding (blocos, tópicos e subtópicos). O administrador deve
-- complementar cada aula com texto, vídeos e materiais pelo painel.
-- As questões das provas usam apenas fatos presentes nessa estrutura.
-- =============================================================================

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------------
insert into public.badges (code, name, description, icon, rule_type, rule_value, points) values
  ('first-lesson-10', '10 aulas concluídas', 'Concluiu 10 aulas na plataforma.', '📚', 'lessons_completed', 10, 20),
  ('first-module', 'Primeiro módulo concluído', 'Concluiu o primeiro módulo de uma trilha.', '🏆', 'first_module', 1, 30),
  ('course-complete', '100% de uma trilha', 'Concluiu todos os módulos de uma trilha.', '🎯', 'course_completed', 1, 100),
  ('streak-7', '7 dias consecutivos', 'Estudou por 7 dias seguidos.', '🔥', 'streak_days', 7, 30),
  ('high-score-90', 'Nota acima de 90%', 'Obteve 90% ou mais em uma prova.', '⭐', 'high_score', 90, 30),
  ('first-exam', 'Primeira aprovação', 'Foi aprovado na primeira prova.', '✅', 'first_exam_passed', 1, 10)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Grupos e competências
-- ---------------------------------------------------------------------------
insert into public.groups (name, description) values
  ('Comercial', 'Time comercial e de campo'),
  ('Operações', 'Operação e backoffice'),
  ('Marketing', 'Trade e marketing'),
  ('Gestão', 'Lideranças e coordenação')
on conflict do nothing;

insert into public.competencies (name, description) values
  ('Conhecimento do negócio', 'Entende a operação, marcas, canais e como o resultado é gerado.'),
  ('Planejamento', 'Organiza rotina, roteiro de visitas e prioridades.'),
  ('Execução em PDV', 'Garante exposição, sortimento, estoque e combate à ruptura.'),
  ('Análise de indicadores', 'Acompanha metas, apuração e resultados.'),
  ('Domínio de ferramentas', 'Utiliza corretamente as plataformas da operação.'),
  ('Comunicação', 'Registra evidências e se comunica com clareza.'),
  ('Autonomia', 'Encontra informações e resolve demandas administrativas.')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Trilha de Onboarding
-- ---------------------------------------------------------------------------
do $$
declare
  v_course uuid := '00000000-0000-4000-8000-000000000100';
  v_m1 uuid := '00000000-0000-4000-8000-000000000101';
  v_m2 uuid := '00000000-0000-4000-8000-000000000102';
  v_m3 uuid := '00000000-0000-4000-8000-000000000103';
  v_m4 uuid := '00000000-0000-4000-8000-000000000104';
  v_e1 uuid := '00000000-0000-4000-8000-000000000201';
  v_e2 uuid := '00000000-0000-4000-8000-000000000202';
  v_e3 uuid := '00000000-0000-4000-8000-000000000203';
  v_e4 uuid := '00000000-0000-4000-8000-000000000204';
  v_note text := '<blockquote><p><strong>Roteiro da aula.</strong> Este conteúdo será complementado pela equipe com vídeos, exemplos e materiais de apoio.</p></blockquote>';
begin
  if exists (select 1 from public.courses where id = v_course) then
    return;
  end if;

  insert into public.courses (id, title, subtitle, description, category, status, position, require_sequential,
                              certificate_enabled, workload_hours, due_days, published_at)
  values (v_course, 'Onboarding Connect Skin', 'Trilha de Formação do time de campo',
          'Programa de integração do time Connect Skin by NIVEA • Eucerin: entenda o negócio, execute no campo, domine as plataformas e saiba onde encontrar suporte.',
          'Onboarding', 'published', 1, true, true, 8, 30, now());

  insert into public.modules (id, course_id, title, description, category, position, status, published_at) values
    (v_m1, v_course, 'Entenda o Negócio',
     'Quem é a Connect Skin, as marcas NIVEA e Eucerin, como geramos resultado e como funcionam as campanhas comerciais.',
     'Negócio', 1, 'published', now()),
    (v_m2, v_course, 'Execute no Campo',
     'Rotina de trabalho, execução em loja, registros e evidências, indicadores e metas.',
     'Campo', 2, 'published', now()),
    (v_m3, v_course, 'Use as Plataformas',
     'Pharmalink, Involves, Trax, Paytrack e outras ferramentas do dia a dia.',
     'Plataformas', 3, 'published', now()),
    (v_m4, v_course, 'Suporte e Materiais',
     'Processos administrativos, materiais de consulta, treinamentos e conclusão do onboarding.',
     'Suporte', 4, 'published', now());

  -- Bloco 1
  insert into public.lessons (module_id, title, description, content_html, position, status, estimated_minutes, published_at) values
    (v_m1, 'Connect Skin', 'Quem somos • Estrutura da operação • Papel do time de campo',
     '<h2>Connect Skin</h2><p>Nesta aula você conhece a empresa e o seu papel dentro dela.</p><h3>Tópicos</h3><ul><li><strong>Quem somos</strong></li><li><strong>Estrutura da operação</strong></li><li><strong>Papel do time de campo</strong></li></ul>' || v_note,
     1, 'published', 15, now()),
    (v_m1, 'Marcas e Mercado', 'NIVEA • Eucerin • Redes e Associados',
     '<h2>Marcas e Mercado</h2><p>As marcas que representamos e os canais onde atuamos.</p><h3>Tópicos</h3><ul><li><strong>NIVEA</strong></li><li><strong>Eucerin</strong></li><li><strong>Redes e Associados</strong></li></ul>' || v_note,
     2, 'published', 20, now()),
    (v_m1, 'Como Geramos Resultado', 'Faturado • MSL • Sortimento • Execução',
     '<h2>Como Geramos Resultado</h2><p>Os pilares que transformam o trabalho de campo em resultado.</p><h3>Tópicos</h3><ul><li><strong>Faturado</strong></li><li><strong>MSL</strong></li><li><strong>Sortimento</strong></li><li><strong>Execução</strong></li></ul>' || v_note,
     3, 'published', 20, now()),
    (v_m1, 'Campanhas e Planos Comerciais', 'Planos estacionais • Tabloides • Combos',
     '<h2>Campanhas e Planos Comerciais</h2><p>Como as ações comerciais chegam ao ponto de venda.</p><h3>Tópicos</h3><ul><li><strong>Planos estacionais</strong></li><li><strong>Tabloides</strong></li><li><strong>Combos</strong></li></ul>' || v_note,
     4, 'published', 15, now());

  -- Bloco 2
  insert into public.lessons (module_id, title, description, content_html, position, status, estimated_minutes, published_at) values
    (v_m2, 'Rotina de Trabalho', 'Planejamento • Visitas • Priorização',
     '<h2>Rotina de Trabalho</h2><p>Como organizar a semana para visitar as lojas certas, na hora certa.</p><h3>Tópicos</h3><ul><li><strong>Planejamento</strong></li><li><strong>Visitas</strong></li><li><strong>Priorização</strong></li></ul>' || v_note,
     1, 'published', 15, now()),
    (v_m2, 'Execução em Loja', 'Exposição • Estoque • Ruptura • Oportunidades',
     '<h2>Execução em Loja</h2><p>O que observar e corrigir em cada visita.</p><h3>Tópicos</h3><ul><li><strong>Exposição</strong></li><li><strong>Estoque</strong></li><li><strong>Ruptura</strong></li><li><strong>Oportunidades</strong></li></ul>' || v_note,
     2, 'published', 20, now()),
    (v_m2, 'Registros e Evidências', 'Check-ins • Fotos • Auditorias',
     '<h2>Registros e Evidências</h2><p>Como comprovar o trabalho realizado.</p><h3>Tópicos</h3><ul><li><strong>Check-ins</strong></li><li><strong>Fotos</strong></li><li><strong>Auditorias</strong></li></ul>' || v_note,
     3, 'published', 15, now()),
    (v_m2, 'Indicadores e Metas', 'Apuração • Resultados • Premiação • Relatórios',
     '<h2>Indicadores e Metas</h2><p>Como o desempenho é medido e reconhecido.</p><h3>Tópicos</h3><ul><li><strong>Apuração</strong></li><li><strong>Resultados</strong></li><li><strong>Premiação</strong></li><li><strong>Relatórios</strong></li></ul>' || v_note,
     4, 'published', 15, now());

  -- Bloco 3
  insert into public.lessons (module_id, title, description, content_html, position, status, estimated_minutes, published_at) values
    (v_m3, 'Pharmalink', 'Pedidos • Consultas • Informações Comerciais',
     '<h2>Pharmalink</h2><p>Plataforma de pedidos e informações comerciais.</p><h3>Tópicos</h3><ul><li><strong>Pedidos</strong></li><li><strong>Consultas</strong></li><li><strong>Informações Comerciais</strong></li></ul>' || v_note,
     1, 'published', 20, now()),
    (v_m3, 'Involves', 'Check-in • Atividades',
     '<h2>Involves</h2><p>Registro de presença e atividades no ponto de venda.</p><h3>Tópicos</h3><ul><li><strong>Check-in</strong></li><li><strong>Atividades</strong></li></ul>' || v_note,
     2, 'published', 15, now()),
    (v_m3, 'Trax', 'Leitura de Gôndola',
     '<h2>Trax</h2><p>Reconhecimento de imagem para leitura de gôndola.</p><h3>Tópicos</h3><ul><li><strong>Leitura de Gôndola</strong></li></ul>' || v_note,
     3, 'published', 15, now()),
    (v_m3, 'Paytrack', 'Despesas • Reembolsos',
     '<h2>Paytrack</h2><p>Gestão de despesas de viagem e reembolsos.</p><h3>Tópicos</h3><ul><li><strong>Despesas</strong></li><li><strong>Reembolsos</strong></li></ul>' || v_note,
     4, 'published', 15, now()),
    (v_m3, 'Outras Plataformas', 'Acode • Radar',
     '<h2>Outras Plataformas</h2><p>Ferramentas complementares da operação.</p><h3>Tópicos</h3><ul><li><strong>Acode</strong></li><li><strong>Radar</strong></li></ul>' || v_note,
     5, 'published', 10, now());

  -- Bloco 4
  insert into public.lessons (module_id, title, description, content_html, position, status, estimated_minutes, published_at) values
    (v_m4, 'Processos Administrativos', 'Acessos • Cadastros • Solicitações',
     '<h2>Processos Administrativos</h2><p>Como solicitar acessos, cadastros e demais demandas.</p><h3>Tópicos</h3><ul><li><strong>Acessos</strong></li><li><strong>Cadastros</strong></li><li><strong>Solicitações</strong></li></ul>' || v_note,
     1, 'published', 10, now()),
    (v_m4, 'Materiais de Consulta', 'POPs • Guias Rápidos • FAQs',
     '<h2>Materiais de Consulta</h2><p>Onde encontrar respostas rápidas no dia a dia.</p><h3>Tópicos</h3><ul><li><strong>POPs</strong></li><li><strong>Guias Rápidos</strong></li><li><strong>FAQs</strong></li></ul>' || v_note,
     2, 'published', 10, now()),
    (v_m4, 'Treinamentos', 'Vídeos • Apresentações • Atualizações',
     '<h2>Treinamentos</h2><p>Conteúdos de capacitação contínua.</p><h3>Tópicos</h3><ul><li><strong>Vídeos</strong></li><li><strong>Apresentações</strong></li><li><strong>Atualizações</strong></li></ul>' || v_note,
     3, 'published', 10, now());

  insert into public.lessons (module_id, title, description, content_html, position, status, estimated_minutes, published_at,
                              activity_enabled, activity_title, activity_instructions, activity_requires_response) values
    (v_m4, 'Conclusão do Onboarding', 'Checklist • Validação • Certificação',
     '<h2>Conclusão do Onboarding</h2><p>Revise o que foi aprendido e conclua sua formação.</p><h3>Tópicos</h3><ul><li><strong>Checklist</strong></li><li><strong>Validação</strong></li><li><strong>Certificação</strong></li></ul>' || v_note,
     4, 'published', 15, now(),
     true, 'Checklist do onboarding',
     'Confirme que você já: (1) acessou todas as plataformas da operação; (2) sabe onde encontrar POPs, guias e FAQs; (3) conhece seus indicadores e metas. Escreva em poucas linhas qual ponto do onboarding foi mais útil para você.',
     true);

  -- Competências por módulo
  insert into public.module_competencies (module_id, competency_id)
  select v_m1, id from public.competencies where name in ('Conhecimento do negócio', 'Análise de indicadores');
  insert into public.module_competencies (module_id, competency_id)
  select v_m2, id from public.competencies where name in ('Planejamento', 'Execução em PDV', 'Comunicação', 'Análise de indicadores');
  insert into public.module_competencies (module_id, competency_id)
  select v_m3, id from public.competencies where name in ('Domínio de ferramentas', 'Execução em PDV');
  insert into public.module_competencies (module_id, competency_id)
  select v_m4, id from public.competencies where name in ('Autonomia', 'Comunicação');

  -- Provas
  insert into public.exams (id, module_id, title, description, passing_score, max_attempts, time_limit_minutes,
                            show_answers, show_explanations, is_required, status, published_at) values
    (v_e1, v_m1, 'Prova — Entenda o Negócio', 'Verifique seu entendimento sobre a Connect Skin e como geramos resultado.', 70, 3, 15, 'after_submit', true, true, 'published', now()),
    (v_e2, v_m2, 'Prova — Execute no Campo', 'Verifique seu entendimento sobre a rotina e a execução em loja.', 70, 3, 15, 'after_submit', true, true, 'published', now()),
    (v_e3, v_m3, 'Prova — Use as Plataformas', 'Verifique se você sabe qual plataforma usar em cada situação.', 70, 3, 15, 'after_submit', true, true, 'published', now()),
    (v_e4, v_m4, 'Prova — Suporte e Materiais', 'Verifique se você sabe onde buscar suporte e materiais.', 70, 3, 15, 'after_submit', true, true, 'published', now());
end;
$$;

-- ---------------------------------------------------------------------------
-- Banco de questões (somente fatos presentes na estrutura do onboarding)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.add_question(
  p_exam uuid, p_module uuid, p_position integer, p_statement text, p_type text, p_category text,
  p_difficulty text, p_explanation text, p_options text[], p_correct integer[]
) returns void language plpgsql as $$
declare
  v_q uuid;
  i   integer;
begin
  insert into public.questions (statement, type, category, difficulty, explanation, module_id)
  values (p_statement, p_type, p_category, p_difficulty, p_explanation, p_module)
  returning id into v_q;
  for i in 1 .. array_length(p_options, 1) loop
    insert into public.question_options (question_id, text, is_correct, position)
    values (v_q, p_options[i], i = any (p_correct), i);
  end loop;
  insert into public.exam_questions (exam_id, question_id, position) values (p_exam, v_q, p_position);
end;
$$;

do $$
declare
  v_e1 uuid := '00000000-0000-4000-8000-000000000201';
  v_e2 uuid := '00000000-0000-4000-8000-000000000202';
  v_e3 uuid := '00000000-0000-4000-8000-000000000203';
  v_e4 uuid := '00000000-0000-4000-8000-000000000204';
  v_m1 uuid := '00000000-0000-4000-8000-000000000101';
  v_m2 uuid := '00000000-0000-4000-8000-000000000102';
  v_m3 uuid := '00000000-0000-4000-8000-000000000103';
  v_m4 uuid := '00000000-0000-4000-8000-000000000104';
begin
  if exists (select 1 from public.exam_questions where exam_id = v_e1) then
    return;
  end if;

  -- Módulo 1
  perform pg_temp.add_question(v_e1, v_m1, 1, 'Quais marcas compõem o portfólio trabalhado pela Connect Skin?', 'single_choice', 'Marcas e Mercado', 'easy',
    'A Connect Skin atua com as marcas NIVEA e Eucerin, conforme a aula "Marcas e Mercado".',
    array['NIVEA e Eucerin', 'Apenas NIVEA', 'Apenas Eucerin', 'Nenhuma das anteriores'], array[1]);
  perform pg_temp.add_question(v_e1, v_m1, 2, 'Quais itens fazem parte de "Como Geramos Resultado"? (marque todos que se aplicam)', 'multiple_choice', 'Resultado', 'medium',
    'Os pilares apresentados são Faturado, MSL, Sortimento e Execução. Reembolsos pertencem ao Paytrack.',
    array['Faturado', 'MSL', 'Sortimento', 'Execução', 'Reembolsos'], array[1, 2, 3, 4]);
  perform pg_temp.add_question(v_e1, v_m1, 3, 'Planos estacionais, tabloides e combos são tratados em qual tópico?', 'single_choice', 'Campanhas', 'easy',
    'Esses três itens compõem o tópico "Campanhas e Planos Comerciais".',
    array['Campanhas e Planos Comerciais', 'Execução em Loja', 'Indicadores e Metas', 'Materiais de Consulta'], array[1]);
  perform pg_temp.add_question(v_e1, v_m1, 4, 'O tópico "Connect Skin" aborda o papel do time de campo.', 'true_false', 'Connect Skin', 'easy',
    'Verdadeiro: "Connect Skin" cobre Quem somos, Estrutura da operação e Papel do time de campo.',
    array['Verdadeiro', 'Falso'], array[1]);
  perform pg_temp.add_question(v_e1, v_m1, 5, '"Redes e Associados" é um subtópico de qual aula?', 'single_choice', 'Marcas e Mercado', 'medium',
    'Redes e Associados aparece em "Marcas e Mercado", junto com NIVEA e Eucerin.',
    array['Marcas e Mercado', 'Rotina de Trabalho', 'Processos Administrativos', 'Pharmalink'], array[1]);

  -- Módulo 2
  perform pg_temp.add_question(v_e2, v_m2, 1, 'Exposição, estoque, ruptura e oportunidades são temas de:', 'single_choice', 'Execução em Loja', 'easy',
    'Esses itens formam o tópico "Execução em Loja".',
    array['Execução em Loja', 'Rotina de Trabalho', 'Registros e Evidências', 'Treinamentos'], array[1]);
  perform pg_temp.add_question(v_e2, v_m2, 2, 'Quais itens fazem parte de "Registros e Evidências"? (marque todos que se aplicam)', 'multiple_choice', 'Registros', 'medium',
    'Registros e Evidências envolve check-ins, fotos e auditorias.',
    array['Check-ins', 'Fotos', 'Auditorias', 'Tabloides'], array[1, 2, 3]);
  perform pg_temp.add_question(v_e2, v_m2, 3, 'A Rotina de Trabalho envolve planejamento, visitas e priorização.', 'true_false', 'Rotina', 'easy',
    'Verdadeiro: são exatamente os três subtópicos da Rotina de Trabalho.',
    array['Verdadeiro', 'Falso'], array[1]);
  perform pg_temp.add_question(v_e2, v_m2, 4, 'Apuração, resultados, premiação e relatórios pertencem a qual tópico?', 'single_choice', 'Indicadores', 'easy',
    'Esses itens compõem "Indicadores e Metas".',
    array['Indicadores e Metas', 'Como Geramos Resultado', 'Paytrack', 'Conclusão do Onboarding'], array[1]);
  perform pg_temp.add_question(v_e2, v_m2, 5, 'Ruptura é um tema tratado em "Execução em Loja".', 'true_false', 'Execução em Loja', 'easy',
    'Verdadeiro: ruptura é um dos quatro temas da Execução em Loja.',
    array['Verdadeiro', 'Falso'], array[1]);

  -- Módulo 3
  perform pg_temp.add_question(v_e3, v_m3, 1, 'Qual plataforma é usada para leitura de gôndola?', 'single_choice', 'Plataformas', 'easy',
    'A Trax é a plataforma de leitura de gôndola.',
    array['Trax', 'Paytrack', 'Pharmalink', 'Involves'], array[1]);
  perform pg_temp.add_question(v_e3, v_m3, 2, 'Despesas e reembolsos são registrados em qual plataforma?', 'single_choice', 'Plataformas', 'easy',
    'O Paytrack é usado para despesas e reembolsos.',
    array['Paytrack', 'Trax', 'Radar', 'Pharmalink'], array[1]);
  perform pg_temp.add_question(v_e3, v_m3, 3, 'Pedidos, consultas e informações comerciais ficam em qual plataforma?', 'single_choice', 'Plataformas', 'medium',
    'O Pharmalink concentra pedidos, consultas e informações comerciais.',
    array['Pharmalink', 'Involves', 'Acode', 'Trax'], array[1]);
  perform pg_temp.add_question(v_e3, v_m3, 4, 'Check-in e atividades são realizados no Involves.', 'true_false', 'Plataformas', 'easy',
    'Verdadeiro: o Involves é usado para check-in e atividades.',
    array['Verdadeiro', 'Falso'], array[1]);
  perform pg_temp.add_question(v_e3, v_m3, 5, 'Quais destas aparecem como "Outras" plataformas? (marque todos que se aplicam)', 'multiple_choice', 'Plataformas', 'medium',
    'Acode e Radar são as plataformas listadas em "Outras".',
    array['Acode', 'Radar', 'Trax', 'Paytrack'], array[1, 2]);

  -- Módulo 4
  perform pg_temp.add_question(v_e4, v_m4, 1, 'POPs, guias rápidos e FAQs são classificados como:', 'single_choice', 'Suporte', 'easy',
    'Esses itens são os "Materiais de Consulta".',
    array['Materiais de Consulta', 'Treinamentos', 'Processos Administrativos', 'Registros e Evidências'], array[1]);
  perform pg_temp.add_question(v_e4, v_m4, 2, 'Acessos, cadastros e solicitações são tratados em:', 'single_choice', 'Suporte', 'easy',
    'Esses itens pertencem a "Processos Administrativos".',
    array['Processos Administrativos', 'Materiais de Consulta', 'Pharmalink', 'Rotina de Trabalho'], array[1]);
  perform pg_temp.add_question(v_e4, v_m4, 3, 'A conclusão do onboarding envolve checklist, validação e certificação.', 'true_false', 'Conclusão', 'easy',
    'Verdadeiro: são os três subtópicos da Conclusão do Onboarding.',
    array['Verdadeiro', 'Falso'], array[1]);
  perform pg_temp.add_question(v_e4, v_m4, 4, 'Quais itens fazem parte de "Treinamentos"? (marque todos que se aplicam)', 'multiple_choice', 'Treinamentos', 'medium',
    'Treinamentos reúne vídeos, apresentações e atualizações.',
    array['Vídeos', 'Apresentações', 'Atualizações', 'Reembolsos'], array[1, 2, 3]);
end;
$$;

-- Comunicado de boas-vindas
insert into public.announcements (title, body, priority, status, show_banner)
select 'Bem-vindo à Connect Skin Academy 👋',
       'Sua trilha de onboarding já está disponível. Comece pelo módulo "Entenda o Negócio" e avance no seu ritmo.',
       'normal', 'published', true
where not exists (select 1 from public.announcements);
