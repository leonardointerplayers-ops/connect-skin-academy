// Valida as migrações em um Postgres embutido (PGlite) com stubs mínimos do
// Supabase (schemas auth/storage e roles) e executa um cenário ponta a ponta
// com RLS ativo: colaborador estuda, faz provas, conclui a trilha e recebe
// certificado. Uso: npm run db:validate
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migrations = ["001_schema.sql", "002_rls.sql", "003_storage.sql", "004_seed.sql"];

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}',
  raw_app_meta_data jsonb default '{}',
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint,
  allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;
`;

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  }
}

const db = new PGlite();

async function as(userId, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const all = async (sql, params) => (await db.query(sql, params)).rows;

async function main() {
  console.log("→ Stubs do Supabase");
  await db.exec(SUPABASE_STUBS);

  for (const file of migrations) {
    const sql = readFileSync(join(root, "supabase", "migrations", file), "utf8");
    try {
      await db.exec(sql);
      console.log(`→ ${file} OK`);
    } catch (err) {
      console.error(`✗ ${file} FALHOU: ${err.message}`);
      process.exit(1);
    }
  }

  console.log("\n→ Cenário ponta a ponta");
  const admin = (await one(`insert into auth.users (email, raw_user_meta_data) values ('admin@empresa.com', '{"full_name":"Ana Admin"}') returning id`)).id;
  const collab = (await one(`insert into auth.users (email, raw_user_meta_data) values ('joao@empresa.com', '{"full_name":"João da Silva"}') returning id`)).id;
  const other = (await one(`insert into auth.users (email) values ('maria@empresa.com') returning id`)).id;
  await db.query(`update public.profiles set role_id = 'admin', status = 'active' where id = $1`, [admin]);
  await db.query(`update public.profiles set status = 'active' where id in ($1, $2)`, [collab, other]);

  check("trigger criou 3 perfis", (await one(`select count(*)::int c from public.profiles`)).c === 3);
  check("matrícula automática na trilha publicada", (await one(`select count(*)::int c from public.enrollments`)).c === 3);

  await as(collab, async () => {
    check("colaborador vê 1 trilha", (await all(`select id from public.courses`)).length === 1);
    check("colaborador vê 4 módulos", (await all(`select id from public.modules`)).length === 4);
    const lessons = await all(`select id, module_id from public.lessons`);
    check("colaborador vê só as 4 aulas do módulo 1 (sequencial)", lessons.length === 4, lessons.length);
    check("colaborador NÃO lê banco de questões", (await all(`select id from public.questions`)).length === 0);
    check("colaborador NÃO lê gabarito", (await all(`select id from public.question_options`)).length === 0);
    check("colaborador NÃO vê outros perfis", (await all(`select id from public.profiles`)).length === 1);
    const outline = (await one(`select public.fn_course_outline('00000000-0000-4000-8000-000000000100') o`)).o;
    check("outline: módulo 1 liberado, módulo 2 bloqueado", outline[0].state === "unlocked" && outline[1].state === "locked_sequence", outline.map((m) => m.state));

    let denied = false;
    try {
      await db.query(`select public.fn_admin_sync_enrollments()`);
    } catch {
      denied = true;
    }
    check("colaborador não executa função administrativa", denied);

    const upd = await db.query(`update public.lesson_progress set status = 'completed' where user_id = $1`, [collab]);
    check("colaborador não altera progresso diretamente", (upd.affectedRows ?? 0) === 0);
  });

  const m1Lessons = await all(`select id from public.lessons where module_id = '00000000-0000-4000-8000-000000000101' order by position`);
  await as(collab, async () => {
    for (const l of m1Lessons) {
      await db.query(`select public.fn_track_lesson_view($1)`, [l.id]);
      await db.query(`select public.fn_track_study_time($1, 45)`, [l.id]);
      const r = (await one(`select public.fn_complete_lesson($1) r`, [l.id])).r;
      if (!r.completed) check("concluir aula", false, r);
    }
    const mp = await one(`select percent::float p, status from public.module_progress where module_id = '00000000-0000-4000-8000-000000000101'`);
    check("módulo 1 em 80% (4 aulas + prova pendente)", mp.p === 80 && mp.status === "in_progress", mp);
  });

  async function passExam(examId, wrongFirst = false) {
    const correct = await all(
      `select q.id qid, array_agg(o.id) filter (where o.is_correct) ok, array_agg(o.id) filter (where not o.is_correct) bad
       from public.exam_questions eq join public.questions q on q.id = eq.question_id
       join public.question_options o on o.question_id = q.id where eq.exam_id = $1 group by q.id`,
      [examId],
    );
    return as(collab, async () => {
      const attemptId = (await one(`select public.fn_start_exam($1) id`, [examId])).id;
      const attempt = (await one(`select public.fn_get_attempt($1) a`, [attemptId])).a;
      const leaks = JSON.stringify(attempt).includes("is_correct");
      const answers = {};
      for (const c of correct) answers[c.qid] = wrongFirst ? c.bad.slice(0, 1) : c.ok;
      const result = (await one(`select public.fn_submit_exam($1, $2::jsonb) r`, [attemptId, JSON.stringify(answers)])).r;
      const review = (await one(`select public.fn_get_attempt_result($1) r`, [attemptId])).r;
      return { attempt, leaks, result, review };
    });
  }

  const e1 = "00000000-0000-4000-8000-000000000201";
  const fail = await passExam(e1, true);
  check("prova não expõe gabarito durante a tentativa", !fail.leaks);
  check("tentativa errada reprova (0%)", fail.result.passed === false && Number(fail.result.score_percent) === 0, fail.result);
  check("resultado mostra tentativa 1 de 3", fail.review.attempts_used === 1 && fail.review.max_attempts === 3, fail.review);
  const pass = await passExam(e1);
  check("segunda tentativa aprova com 100%", pass.result.passed === true && Number(pass.result.score_percent) === 100, pass.result);
  check("módulo 1 concluído pela prova", pass.result.module_completed === true, pass.result);
  check("histórico preserva as 2 tentativas", pass.review.history.length === 2);
  check("revisão traz explicações", pass.review.questions.every((q) => q.explanation));

  await as(collab, async () => {
    const lessons = await all(`select id from public.lessons`);
    check("módulo 2 liberado após concluir módulo 1 (8 aulas visíveis)", lessons.length === 8, lessons.length);
  });

  for (const [mod, exam] of [
    ["102", "202"],
    ["103", "203"],
    ["104", "204"],
  ]) {
    const ls = await all(`select id, activity_enabled from public.lessons where module_id = '00000000-0000-4000-8000-000000000${mod}' order by position`);
    await as(collab, async () => {
      for (const l of ls) {
        await db.query(`select public.fn_track_lesson_view($1)`, [l.id]);
        if (l.activity_enabled) {
          const blocked = (await one(`select public.fn_complete_lesson($1) r`, [l.id])).r;
          check("aula com atividade exige a atividade", blocked.completed === false && blocked.missing.includes("activity"), blocked);
          await db.query(`select public.fn_submit_activity($1, 'Todas as plataformas foram acessadas.')`, [l.id]);
        } else {
          await db.query(`select public.fn_complete_lesson($1)`, [l.id]);
        }
      }
    });
    const r = await passExam(`00000000-0000-4000-8000-000000000${exam}`);
    if (!r.result.passed) check(`prova ${exam}`, false, r.result);
    if (mod === "104") check("trilha concluída na última prova", r.result.course_completed === true, r.result);
  }

  const cert = await one(`select code from public.certificates where user_id = $1`, [collab]);
  check("certificado emitido", !!cert?.code);
  if (cert) {
    await db.exec(`set role anon;`);
    const v = (await one(`select public.fn_verify_certificate($1) v`, [cert.code.toLowerCase()])).v;
    await db.exec(`reset role;`);
    check("validação pública do certificado (anon)", v?.recipient_name === "João da Silva", v);
  }

  const badges = await all(`select b.code from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = $1`, [collab]);
  check("badges concedidos (módulo, trilha, nota, 10 aulas, 1ª aprovação)", badges.length >= 5, badges.map((b) => b.code));
  const pts = await one(`select total_points from public.profiles where id = $1`, [collab]);
  check("pontos acumulados", pts.total_points > 0, pts);
  const notif = await one(`select count(*)::int c from public.notifications where user_id = $1`, [collab]);
  check("notificações geradas", notif.c > 0, notif);

  await as(admin, async () => {
    const summary = await all(`select * from public.v_user_learning_summary order by full_name`);
    const joao = summary.find((s) => s.email === "joao@empresa.com");
    check("analytics: João 100% e 4 módulos", Number(joao.overall_percent) === 100 && Number(joao.modules_completed) === 4, joao);
    const mod = await all(`select * from public.v_module_stats order by position`);
    check("analytics: v_module_stats com aprovação", mod[0].users_attempted == 1 && Number(mod[0].approval_rate) === 100, mod[0]);
    const q = await all(`select * from public.v_question_stats where exam_id = $1`, [e1]);
    check("analytics: v_question_stats com acertos/erros", q.length === 5 && q.every((x) => Number(x.total_answers) === 2), q.length);
    const lessonStats = await all(`select * from public.v_lesson_stats`);
    check("analytics: v_lesson_stats", lessonStats.length === 17);
    const dup = (await one(`select public.fn_admin_duplicate_module('00000000-0000-4000-8000-000000000101') id`)).id;
    const dupLessons = await one(`select count(*)::int c from public.lessons where module_id = $1`, [dup]);
    check("admin duplica módulo com aulas e prova", dupLessons.c === 4);
  });

  await as(other, async () => {
    check("Maria não vê o progresso do João", (await all(`select id from public.lesson_progress`)).length === 0);
    check("Maria não vê tentativas do João", (await all(`select id from public.exam_attempts`)).length === 0);
    let blocked = false;
    try {
      await db.query(`select public.fn_get_attempt_result($1)`, [pass.result.attempt_id]);
    } catch {
      blocked = true;
    }
    check("Maria não lê resultado do João", blocked);
    await db.query(`update public.profiles set role_id = 'admin', total_points = 9999 where id = $1`, [other]);
  });
  const videoLesson = m1Lessons[0].id;
  await db.query(
    `with v as (insert into public.videos (provider, external_url, duration_seconds) values ('external', 'https://example.com/v.mp4', 100) returning id)
     update public.lessons set video_id = (select id from v) where id = $1`,
    [videoLesson],
  );
  await as(other, async () => {
    const jump = (await one(`select public.fn_track_video($1, 95, 100) r`, [videoLesson])).r;
    check("vídeo: pular para o fim não conta como assistido", Number(jump.percent) <= 20 && !jump.video_completed, jump);
    const blocked = (await one(`select public.fn_complete_lesson($1) r`, [videoLesson])).r;
    check("vídeo obrigatório bloqueia conclusão da aula", blocked.completed === false && blocked.missing.includes("video"), blocked);
  });

  // --- Prova dinâmica: sorteia N questões do conjunto ---
  const e2 = "00000000-0000-4000-8000-000000000202";
  await db.query(`update public.exams set selection_mode = 'random', question_count = 3 where id = $1`, [e2]);
  const lessonsM2 = await all(`select id from public.lessons where module_id = '00000000-0000-4000-8000-000000000102'`);
  void lessonsM2;
  // Maria precisa ter o módulo 2 liberado: libera sequência desligando-a.
  await db.query(`update public.courses set require_sequential = false`);
  await as(other, async () => {
    const attemptId = (await one(`select public.fn_start_exam($1) id`, [e2])).id;
    const a = (await one(`select public.fn_get_attempt($1) a`, [attemptId])).a;
    check("prova dinâmica sorteia exatamente 3 questões", a.questions.length === 3, a.questions.length);
    // Tempo esgotado: força expiração e verifica envio automático como 'expired'
    await db.exec(`reset role;`);
    await db.query(`update public.exam_attempts set expires_at = now() - interval '5 minutes' where id = $1`, [attemptId]);
    await db.exec(`select set_config('request.jwt.claim.sub', '${other}', false); set role authenticated;`);
    const r = (await one(`select public.fn_submit_exam($1, '{}'::jsonb) r`, [attemptId])).r;
    const st = (await one(`select status from public.exam_attempts where id = $1`, [attemptId])).status;
    check("tentativa com tempo esgotado é registrada como 'expired'", st === "expired" && r.passed === false, { st, r });
  });

  // --- Liberação programada por data ---
  await db.query(`update public.modules set release_type = 'date', release_at = now() + interval '3 days' where id = '00000000-0000-4000-8000-000000000104'`);
  await as(other, async () => {
    const outline = (await one(`select public.fn_course_outline('00000000-0000-4000-8000-000000000100') o`)).o;
    check("módulo com data futura fica 'locked_date'", outline[3].state === "locked_date", outline[3].state);
  });
  await db.query(`update public.modules set release_type = 'immediate', release_at = null where id = '00000000-0000-4000-8000-000000000104'`);

  // --- Público por grupo ---
  await db.query(`update public.courses set audience = 'groups'`);
  await db.query(`insert into public.course_groups (course_id, group_id) select '00000000-0000-4000-8000-000000000100', id from public.groups where name = 'Gestão'`);
  await as(other, async () => {
    check("trilha restrita a grupo some para quem não é do grupo", (await all(`select id from public.courses`)).length === 0);
  });
  await db.query(`insert into public.group_members (group_id, user_id) select id, $1 from public.groups where name = 'Gestão'`, [other]);
  await as(other, async () => {
    check("membro do grupo passa a ver a trilha", (await all(`select id from public.courses`)).length === 1);
  });
  await db.query(`update public.courses set audience = 'all'`);

  // --- Gestor: lê analytics, não edita conteúdo ---
  const manager = (await one(`insert into auth.users (email, raw_user_meta_data) values ('gestor@empresa.com', '{"full_name":"Gustavo Gestor"}') returning id`)).id;
  await db.query(`update public.profiles set role_id = 'manager', status = 'active' where id = $1`, [manager]);
  await as(manager, async () => {
    check("gestor lê o resumo de todos os colaboradores", (await all(`select user_id from public.v_user_learning_summary`)).length === 4);
    const upd = await db.query(`update public.courses set title = 'hack' returning id`);
    check("gestor NÃO edita trilhas", (upd.rows ?? []).length === 0);
    let blocked = false;
    try {
      await db.query(`select public.fn_admin_sync_enrollments()`);
    } catch {
      blocked = true;
    }
    check("gestor NÃO executa funções administrativas", blocked);
  });

  // --- Storage: acesso a arquivos privados segue a aula ---
  const matId = (await one(
    `insert into public.materials (title, kind, bucket, storage_path) values ('POP', 'pdf', 'lesson-materials', 'materials/x/pop.pdf') returning id`,
  )).id;
  await db.query(`insert into public.lesson_materials (lesson_id, material_id) values ($1, $2)`, [m1Lessons[1].id, matId]);
  await as(collab, async () => {
    check("colaborador acessa arquivo de aula liberada", (await one(`select public.can_read_storage_object('lesson-materials', 'materials/x/pop.pdf') ok`)).ok === true);
    check("colaborador NÃO acessa arquivo solto", (await one(`select public.can_read_storage_object('lesson-materials', 'materials/x/outro.pdf') ok`)).ok === false);
  });
  await db.query(`update public.lessons set status = 'draft' where id = $1`, [m1Lessons[1].id]);
  await as(collab, async () => {
    check("arquivo de aula em rascunho fica inacessível", (await one(`select public.can_read_storage_object('lesson-materials', 'materials/x/pop.pdf') ok`)).ok === false);
  });

  const maria = await one(`select role_id, total_points from public.profiles where id = $1`, [other]);
  check("colaborador não se promove a admin nem altera pontos", maria.role_id === "collaborator" && maria.total_points === 0, maria);

  console.log(failures === 0 ? "\n✅ Todas as verificações passaram." : `\n❌ ${failures} verificação(ões) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
