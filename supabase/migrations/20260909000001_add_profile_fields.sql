-- Migration: add profile fields
-- Apply manually in Supabase SQL editor.

alter table public.profiles
  add column if not exists credits integer not null default 0,
  add column if not exists plan text not null default 'Старт';
