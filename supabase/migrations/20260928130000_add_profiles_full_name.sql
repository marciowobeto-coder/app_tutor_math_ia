-- Nome completo do usuário (exibido na gestão de usuários). O `username` continua sendo o login.
-- Contas já existentes ficam com NULL até o admin preencher pela tela de edição.
alter table public.profiles
  add column if not exists full_name text;
