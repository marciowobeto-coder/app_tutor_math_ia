CREATE TABLE public.user_daily_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  activity_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  logins integer NOT NULL DEFAULT 0,
  questions_done integer NOT NULL DEFAULT 0,
  questions_correct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_date)
);

GRANT SELECT, INSERT, UPDATE ON public.user_daily_activity TO authenticated;
GRANT ALL ON public.user_daily_activity TO service_role;

ALTER TABLE public.user_daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON public.user_daily_activity
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.user_daily_activity
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own activity" ON public.user_daily_activity
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity" ON public.user_daily_activity
FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_daily_activity_updated_at
BEFORE UPDATE ON public.user_daily_activity
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.record_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.user_daily_activity (user_id, logins)
  values (auth.uid(), 1)
  on conflict (user_id, activity_date)
  do update set logins = public.user_daily_activity.logins + 1, updated_at = now();
end;
$$;

CREATE OR REPLACE FUNCTION public.record_question(_correct boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.user_daily_activity (user_id, questions_done, questions_correct)
  values (auth.uid(), 1, case when _correct then 1 else 0 end)
  on conflict (user_id, activity_date)
  do update set
    questions_done = public.user_daily_activity.questions_done + 1,
    questions_correct = public.user_daily_activity.questions_correct + (case when _correct then 1 else 0 end),
    updated_at = now();
end;
$$;

REVOKE ALL ON FUNCTION public.record_login() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_question(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_login() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_question(boolean) TO authenticated;