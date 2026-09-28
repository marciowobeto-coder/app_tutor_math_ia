-- Configurações gerais do app (chave/valor).
--
-- Hoje usada só pra escolher qual provedor de IA a função ai-tutor deve chamar
-- ('anthropic' ou 'groq'). A função lê esse valor do banco a cada chamada (não fica
-- em cache/variável de ambiente), então trocar aqui reflete IMEDIATAMENTE pra todo
-- mundo que estiver usando o app, sem precisar reimplantar nada.
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

alter table public.app_settings enable row level security;

create policy "Authenticated can view settings"
on public.app_settings for select to authenticated
using (true);

create policy "Admins can update settings"
on public.app_settings for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create trigger update_app_settings_updated_at
before update on public.app_settings
for each row execute function public.update_updated_at_column();

insert into public.app_settings (key, value) values ('ai_provider', 'anthropic')
on conflict (key) do nothing;
