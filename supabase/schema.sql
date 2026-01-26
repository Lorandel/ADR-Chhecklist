-- supabase/schema.sql
-- Rulează acest fișier în Supabase Dashboard → SQL Editor
-- Creează tabela pentru ADR Checklists History (retenție 60 zile prin expires_at)

-- 0) (Necesare pentru gen_random_uuid)
create extension if not exists "pgcrypto";

-- 1) Tabela principală
create table if not exists public.adr_checklists (
  id uuid primary key default gen_random_uuid(),

  -- 'reduced' sau 'full'
  checklist_type text not null check (checklist_type in ('reduced', 'full')),

  -- hash determinist pentru dedupe (UNIQUE)
  checklist_hash text not null unique,

  -- path-ul fișierului în Supabase Storage, ex: reduced/<hash>.zip
  file_path text not null,

  -- timestamps
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  -- status pentru cazul "send via email"
  email_sent boolean not null default false,

  -- metadata opțional (ex: nume fișier, extra info)
  meta jsonb not null default '{}'::jsonb
);

-- 2) Indexuri utile
create index if not exists adr_checklists_created_at_idx
  on public.adr_checklists (created_at desc);

create index if not exists adr_checklists_expires_at_idx
  on public.adr_checklists (expires_at);

create index if not exists adr_checklists_type_idx
  on public.adr_checklists (checklist_type);

-- 3) RLS ON (recomandat)
alter table public.adr_checklists enable row level security;

-- IMPORTANT:
-- Nu definim politici RLS aici intenționat.
-- Asta blochează accesul direct din client (anon).
-- Accesul se face prin API routes server-side (cu service role), unde tu controlezi guest/admin.
