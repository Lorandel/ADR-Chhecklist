-- supabase/schema.sql
-- Create table used by the ADR Checklists History feature.

create extension if not exists pgcrypto;

create table if not exists public.adr_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_type text not null check (checklist_type in ('reduced', 'full')),
  checklist_hash text not null unique,
  file_path text not null,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null,
  email_sent boolean default false,
  meta jsonb
);

-- Optional: index for faster cleanup queries
create index if not exists adr_checklists_expires_at_idx on public.adr_checklists (expires_at);
