-- ═══════════════════════════════════════════════════════════
-- CONÉXIA — Setup Completo Supabase
-- Cole TUDO no SQL Editor → RUN
-- ═══════════════════════════════════════════════════════════

create table if not exists public.users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text, email text, role text, segment text, state text,
  objective text, onboarding_completed boolean default false,
  assessment_completed boolean default false,
  profile_key text, profile_name text, overall_score numeric,
  is_mentor boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  question_id text not null, dimension text not null,
  answer integer not null, calculated_score integer not null,
  reverse boolean default false, created_at timestamptz default now()
);

create table if not exists public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  intencao_estrategica numeric, escuta_relacional numeric,
  presenca_mercado numeric, reciprocidade_ativa numeric,
  ritual_consistencia numeric, confianca_autentica numeric,
  overall_score numeric, profile_key text, profile_name text,
  report_json jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null, company text, role text, email text, phone text,
  category text default 'potencial', proximity integer default 3,
  influence integer default 3, trust integer default 3,
  ideal_frequency_days integer default 30, how_met text,
  personal_notes text, professional_notes text,
  interests text, challenges text,
  next_action text, next_action_date date,
  last_interaction_at timestamptz, health_score numeric default 0,
  status text default 'active',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  type text, description text, sentiment text,
  tags text[] default '{}',
  value_generated boolean default false,
  asked_for_something boolean default false,
  next_action text, next_action_date date,
  created_at timestamptz default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  type text, title text, message text,
  severity text default 'medium', status text default 'open',
  due_date date, created_at timestamptz default now(), resolved_at timestamptz
);

-- RLS
alter table public.users_profile enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_results enable row level security;
alter table public.contacts enable row level security;
alter table public.interactions enable row level security;
alter table public.alerts enable row level security;

create policy "up_own" on public.users_profile for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "up_mentor" on public.users_profile for select using (exists(select 1 from public.users_profile where id=auth.uid() and is_mentor=true));
create policy "ar_own" on public.assessment_responses for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "ares_own" on public.assessment_results for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "ares_mentor" on public.assessment_results for select using (exists(select 1 from public.users_profile where id=auth.uid() and is_mentor=true));
create policy "c_own" on public.contacts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "c_mentor" on public.contacts for select using (exists(select 1 from public.users_profile where id=auth.uid() and is_mentor=true));
create policy "i_own" on public.interactions for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "i_mentor" on public.interactions for select using (exists(select 1 from public.users_profile where id=auth.uid() and is_mentor=true));
create policy "al_own" on public.alerts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Triggers
create or replace function public.set_updated_at() returns trigger as $$
begin NEW.updated_at=now(); return NEW; end; $$ language plpgsql;

create trigger trg_up before update on public.users_profile for each row execute function public.set_updated_at();
create trigger trg_ar before update on public.assessment_results for each row execute function public.set_updated_at();
create trigger trg_ct before update on public.contacts for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.users_profile(id,first_name,email)
  values(NEW.id,coalesce(NEW.raw_user_meta_data->>'name',split_part(NEW.email,'@',1)),NEW.email);
  return NEW;
end; $$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.update_contact_on_interaction() returns trigger as $$
begin
  update public.contacts set last_interaction_at=NEW.created_at, health_score=100, status='active',
    next_action=NEW.next_action, next_action_date=NEW.next_action_date
  where id=NEW.contact_id;
  return NEW;
end; $$ language plpgsql security definer;

create trigger on_interaction_created after insert on public.interactions for each row execute function public.update_contact_on_interaction();
