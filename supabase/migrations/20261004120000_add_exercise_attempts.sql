-- Histórico de exercícios resolvidos por aluno.
--
-- Até aqui o progresso (pontos, exercícios por tema, acertos/erros, sequência, medalhas) vivia
-- só na memória do app e zerava a cada recarregamento. Cada linha desta tabela é um exercício
-- concluído (ou abandonado depois de uma tentativa errada); o app reconstrói o progresso a
-- partir dela ao fazer login.
create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  topic_id text not null,
  exercise_id text not null,
  completed boolean not null,
  correct boolean not null,
  steps_correct integer not null default 0,
  steps_total integer not null default 0,
  errors integer not null default 0,
  hints_used integer not null default 0,
  duration_seconds numeric not null default 0,
  points integer not null default 0,
  error_types text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index exercise_attempts_user_created_idx on public.exercise_attempts (user_id, created_at);

grant select on public.exercise_attempts to authenticated;
grant all on public.exercise_attempts to service_role;

alter table public.exercise_attempts enable row level security;

create policy "Users can view own attempts" on public.exercise_attempts
for select to authenticated using (auth.uid() = user_id);

create policy "Admins can view all attempts" on public.exercise_attempts
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Grava a tentativa e, na mesma transação, soma na atividade do dia (questions_done /
-- questions_correct), usada pelo relatório do admin.
create or replace function public.record_exercise(
  _topic_id text,
  _exercise_id text,
  _completed boolean,
  _correct boolean,
  _steps_correct integer,
  _steps_total integer,
  _errors integer,
  _hints_used integer,
  _duration_seconds numeric,
  _points integer,
  _error_types text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.exercise_attempts (
    user_id, topic_id, exercise_id, completed, correct, steps_correct, steps_total,
    errors, hints_used, duration_seconds, points, error_types
  ) values (
    auth.uid(), _topic_id, _exercise_id, _completed, _correct, _steps_correct, _steps_total,
    _errors, _hints_used, _duration_seconds, _points, coalesce(_error_types, '{}')
  );

  insert into public.user_daily_activity (user_id, questions_done, questions_correct)
  values (auth.uid(), 1, case when _correct then 1 else 0 end)
  on conflict (user_id, activity_date)
  do update set
    questions_done = public.user_daily_activity.questions_done + 1,
    questions_correct = public.user_daily_activity.questions_correct + (case when _correct then 1 else 0 end),
    updated_at = now();
end;
$$;

revoke all on function public.record_exercise(text, text, boolean, boolean, integer, integer, integer, integer, numeric, integer, text[]) from public;
grant execute on function public.record_exercise(text, text, boolean, boolean, integer, integer, integer, integer, numeric, integer, text[]) to authenticated;
