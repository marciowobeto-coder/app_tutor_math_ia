-- Inativação de usuários + limpeza de perfis órfãos.
--
-- 1) Coluna `active`: um usuário que já tem histórico (user_daily_activity) não pode ser
--    excluído, pra não perder os dados do relatório; em vez disso o admin o inativa. O login
--    é bloqueado de fato na edge function admin-users (ban no Supabase Auth) e o app também
--    desloga quem estiver com `active = false`.
alter table public.profiles
  add column if not exists active boolean not null default true;

-- 2) Antes, excluir um usuário apagava só o registro em auth.users; como profiles/user_roles
--    não têm FK pra auth.users, o perfil ficava órfão e continuava aparecendo na lista.
--    Remove os órfãos que ficaram pra trás (a edge function agora apaga tudo junto).
delete from public.user_roles r
where not exists (select 1 from auth.users u where u.id = r.user_id);

delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);
