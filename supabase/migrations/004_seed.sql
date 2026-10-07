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
