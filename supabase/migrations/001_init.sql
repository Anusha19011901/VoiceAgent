-- Google OAuth token storage
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_google_tokens_updated_at on public.google_tokens;
create trigger trg_google_tokens_updated_at
before update on public.google_tokens
for each row execute function public.set_updated_at();

alter table public.google_tokens enable row level security;

-- user can select and update only their own row
create policy "google_tokens_select_own"
on public.google_tokens
for select
using (auth.uid() = user_id);

create policy "google_tokens_update_own"
on public.google_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "google_tokens_insert_own"
on public.google_tokens
for insert
with check (auth.uid() = user_id);

-- Note: service role bypasses RLS and is used by secure server routes for upsert/refresh workflows.
