-- DUTA TEKNOKRAT 2026 — database mengikuti file HTML sumber terbaru.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','juri')),
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.finalists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  study_program text not null,
  gender text not null check (gender in ('putra','putri')),
  created_at timestamptz not null default now()
);
create index if not exists finalists_gender_created_idx on public.finalists(gender, created_at, name);

-- Satu nilai Speech (0–100) dari setiap juri untuk setiap finalis.
create table if not exists public.speech_scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.profiles(id) on delete cascade,
  finalist_id uuid not null references public.finalists(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  unique(judge_id, finalist_id)
);
-- Satu nilai QnA (0–100) dari setiap juri untuk setiap finalis Top 6.
create table if not exists public.qna_scores (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references public.profiles(id) on delete cascade,
  finalist_id uuid not null references public.finalists(id) on delete cascade,
  score numeric(5,2) not null check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  unique(judge_id, finalist_id)
);
-- Kompatibilitas jika schema rancangan sebelumnya sudah pernah dijalankan.
-- Kolom lama (tiga kriteria) diringkas menjadi satu nilai sesuai HTML terbaru.
alter table public.finalists add column if not exists created_at timestamptz not null default now();
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.finalists'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%gender%' loop
    execute format('alter table public.finalists drop constraint %I',c.conname);
  end loop;
end $$;
update public.finalists set gender=lower(gender) where gender is not null;
alter table public.finalists alter column gender set not null;
alter table public.finalists drop constraint if exists finalists_gender_check;
alter table public.finalists add constraint finalists_gender_check check (gender in ('putra','putri'));
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='finalists' and column_name='number') then
    alter table public.finalists alter column number drop not null;
  end if;
end $$;

alter table public.speech_scores add column if not exists score numeric(5,2);
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='speech_scores' and column_name='speech_material') then
    execute 'update public.speech_scores set score=round((coalesce(speech_material,0)+coalesce(delivery,0)+coalesce(public_speaking,0))/3,2) where score is null';
  else
    update public.speech_scores set score=0 where score is null;
  end if;
end $$;
alter table public.speech_scores alter column score set not null;
alter table public.speech_scores drop constraint if exists speech_scores_score_range;
alter table public.speech_scores add constraint speech_scores_score_range check (score between 0 and 100);

alter table public.qna_scores add column if not exists score numeric(5,2);
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='qna_scores' and column_name='answer_quality') then
    execute 'update public.qna_scores set score=round((coalesce(answer_quality,0)+coalesce(thinking_speed,0)+coalesce(body_language,0))/3,2) where score is null';
  else
    update public.qna_scores set score=0 where score is null;
  end if;
end $$;
alter table public.qna_scores alter column score set not null;
alter table public.qna_scores drop constraint if exists qna_scores_score_range;
alter table public.qna_scores add constraint qna_scores_score_range check (score between 0 and 100);

create table if not exists public.event_settings (
  id integer primary key default 1 check (id=1),
  event_name text not null default 'Duta Teknokrat 2026',
  scoring_locked boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.event_settings(id) values(1) on conflict do nothing;
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Maksimal lima akun juri dan jabatan juri tidak boleh ganda.
create or replace function public.enforce_judge_limit() returns trigger
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  if new.role='juri' then
    perform pg_advisory_xact_lock(20261031);
    select count(*) into n from public.profiles where role='juri' and id<>new.id;
    if n>=5 then raise exception 'Jumlah juri maksimal 5 orang'; end if;
    if exists(select 1 from public.profiles where role='juri' and title=new.title and id<>new.id) then
      raise exception 'Jabatan juri tersebut sudah digunakan';
    end if;
    if new.title not in ('Ketua Juri','Juri 2','Juri 3','Juri 4','Juri 5') then
      raise exception 'Jabatan juri tidak sesuai daftar';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists judge_limit_guard on public.profiles;
create trigger judge_limit_guard before insert or update of role,title on public.profiles
for each row execute function public.enforce_judge_limit();

create or replace function public.current_role() returns text
language sql stable security definer set search_path=public as $$
  select role from public.profiles where id=auth.uid();
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(public.current_role()='admin',false);
$$;

-- Hitung peringkat Speech dengan penyebut jumlah seluruh juri aktif,
-- sehingga juri yang belum mengisi nilai dihitung sebagai 0 sesuai file sumber.
create or replace function public.is_top_six_speech(p_finalist uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare g text; pos bigint;
begin
  select gender into g from public.finalists where id=p_finalist;
  if g is null then return false; end if;
  with judge_count as (select greatest(count(*),1) n from public.profiles where role='juri'),
  ranked as (
    select f.id,
      coalesce(sum(ss.score),0)/(select n from judge_count) as avg_score,
      row_number() over(order by coalesce(sum(ss.score),0)/(select n from judge_count) desc, f.created_at asc, f.name asc) as rn
    from public.finalists f
    left join public.speech_scores ss on ss.finalist_id=f.id
    where f.gender=g
    group by f.id,f.created_at,f.name
  ) select rn into pos from ranked where id=p_finalist;
  return coalesce(pos<=6,false);
end;
$$;
create or replace function public.guard_qna_top_six() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_top_six_speech(new.finalist_id) then
    raise exception 'Penilaian QnA hanya diperbolehkan untuk Top 6 Speech pada kategori masing-masing';
  end if;
  return new;
end;
$$;
drop trigger if exists qna_top_three_guard on public.qna_scores;
drop trigger if exists qna_top_six_guard on public.qna_scores;
create trigger qna_top_six_guard before insert or update of finalist_id on public.qna_scores
for each row execute function public.guard_qna_top_six();

alter table public.profiles enable row level security;
alter table public.finalists enable row level security;
alter table public.speech_scores enable row level security;
alter table public.qna_scores enable row level security;
alter table public.event_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Bersihkan nama policy dari versi schema lama agar tidak ada policy permissive yang membypass aturan baru.
drop policy if exists "profiles readable by authenticated users" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "finalists readable by authenticated users" on public.finalists;
drop policy if exists "admins manage finalists" on public.finalists;
drop policy if exists "scores readable by authenticated users" on public.speech_scores;
drop policy if exists "judge manages own speech score" on public.speech_scores;
drop policy if exists "judge updates own speech score" on public.speech_scores;
drop policy if exists "admins manage speech scores" on public.speech_scores;
drop policy if exists "qna scores readable by authenticated users" on public.qna_scores;
drop policy if exists "judge manages own qna score" on public.qna_scores;
drop policy if exists "judge updates own qna score" on public.qna_scores;
drop policy if exists "admins manage qna scores" on public.qna_scores;
drop policy if exists "settings readable by authenticated users" on public.event_settings;
drop policy if exists "admins manage settings" on public.event_settings;
drop policy if exists "audit readable by admins" on public.audit_logs;
drop policy if exists "authenticated can write own audit" on public.audit_logs;

drop policy if exists "profiles select authenticated" on public.profiles;
create policy "profiles select authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "admin manage profiles" on public.profiles;
create policy "admin manage profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "finalists select authenticated" on public.finalists;
create policy "finalists select authenticated" on public.finalists for select to authenticated using (true);
drop policy if exists "admin manage finalists" on public.finalists;
create policy "admin manage finalists" on public.finalists for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "speech select authenticated" on public.speech_scores;
create policy "speech select authenticated" on public.speech_scores for select to authenticated using (true);
drop policy if exists "judge insert own speech" on public.speech_scores;
create policy "judge insert own speech" on public.speech_scores for insert to authenticated with check (judge_id=auth.uid() and public.current_role()='juri' and not (select scoring_locked from public.event_settings where id=1));
drop policy if exists "judge update own speech" on public.speech_scores;
create policy "judge update own speech" on public.speech_scores for update to authenticated using (judge_id=auth.uid() and public.current_role()='juri' and not (select scoring_locked from public.event_settings where id=1)) with check (judge_id=auth.uid());
drop policy if exists "admin manage speech" on public.speech_scores;
create policy "admin manage speech" on public.speech_scores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "qna select authenticated" on public.qna_scores;
create policy "qna select authenticated" on public.qna_scores for select to authenticated using (true);
drop policy if exists "judge insert own qna" on public.qna_scores;
create policy "judge insert own qna" on public.qna_scores for insert to authenticated with check (judge_id=auth.uid() and public.current_role()='juri' and not (select scoring_locked from public.event_settings where id=1) and public.is_top_six_speech(finalist_id));
drop policy if exists "judge update own qna" on public.qna_scores;
create policy "judge update own qna" on public.qna_scores for update to authenticated using (judge_id=auth.uid() and public.current_role()='juri' and not (select scoring_locked from public.event_settings where id=1)) with check (judge_id=auth.uid() and public.is_top_six_speech(finalist_id));
drop policy if exists "admin manage qna" on public.qna_scores;
create policy "admin manage qna" on public.qna_scores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings select authenticated" on public.event_settings;
create policy "settings select authenticated" on public.event_settings for select to authenticated using (true);
drop policy if exists "admin manage settings" on public.event_settings;
create policy "admin manage settings" on public.event_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_admin());
drop policy if exists "audit actor insert" on public.audit_logs;
create policy "audit actor insert" on public.audit_logs for insert to authenticated with check (actor_id=auth.uid());

-- Aktifkan Realtime untuk pembaruan tabel penilaian lintas perangkat.
do $$ begin
  alter publication supabase_realtime add table public.finalists;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.speech_scores;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.qna_scores;
exception when duplicate_object then null; when undefined_object then null; end $$;
