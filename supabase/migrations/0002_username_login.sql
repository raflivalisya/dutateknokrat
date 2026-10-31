-- Username login untuk Admin dan Juri. Jalankan setelah 0001_initial_schema.sql.
alter table public.profiles add column if not exists username text;
-- Username default bagi akun lama. Admin mendapat username admin; juri diberi username unik berdasar jabatan dan potongan UUID.
update public.profiles set username='admin' where role='admin' and username is null;
update public.profiles set username=regexp_replace(lower(coalesce(title,'juri')),'[^a-z0-9]+','','g') || '-' || left(replace(id::text,'-',''),6)
where role='juri' and username is null;
create unique index if not exists profiles_username_lower_uidx on public.profiles(lower(username));
alter table public.profiles alter column username set not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='profiles_username_format_check' and conrelid='public.profiles'::regclass) then
  alter table public.profiles add constraint profiles_username_format_check check (username ~ '^[a-z0-9._-]{3,30}$');
 end if;
end $$;
-- Setelah migrasi, login Admin lama menggunakan username: admin dan password Auth yang sudah dimiliki.
