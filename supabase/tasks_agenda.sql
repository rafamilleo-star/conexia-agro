-- Agenda pessoal de tarefas (CONÉXIA)
create table if not exists public.tasks_agenda (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  prazo date,
  status text not null default 'pendente' check (status in ('pendente','em_andamento','feita')),
  origem text not null default 'app' check (origem in ('app','whatsapp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_agenda_user_prazo_idx on public.tasks_agenda (user_id, prazo);

alter table public.tasks_agenda enable row level security;

drop policy if exists "ta_own" on public.tasks_agenda;
create policy "ta_own" on public.tasks_agenda
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
