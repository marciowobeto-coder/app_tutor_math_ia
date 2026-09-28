-- Blocos (séries) que cada aluno pode acessar no app.
--
-- Contas já existentes recebem, automaticamente (via DEFAULT), acesso a todos os 9 blocos —
-- ou seja, o comportamento de hoje (tudo liberado) não muda para ninguém que já tem conta.
-- A partir de agora, um administrador pode restringir isso ao criar ou editar um aluno.
-- Administradores sempre têm acesso a tudo, independentemente do valor desta coluna (a
-- checagem de admin é feita à parte, por role, tanto no app quanto na edge function).
alter table public.profiles
  add column if not exists allowed_school_years text[] not null
    default array['1fund','2fund','3fund','4fund','5fund','6fund','7fund','8fund','9fund']::text[];

alter table public.profiles
  add constraint profiles_allowed_school_years_valid
    check (allowed_school_years <@ array['1fund','2fund','3fund','4fund','5fund','6fund','7fund','8fund','9fund']::text[]);
