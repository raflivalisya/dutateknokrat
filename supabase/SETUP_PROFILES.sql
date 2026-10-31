-- Jalankan setelah membuat user di Authentication > Users.
-- Ganti UUID dan nama sesuai akun admin Anda.
insert into public.profiles (id, username, full_name, role, title)
values ('GANTI-DENGAN-UUID-AUTH-ADMIN', 'admin', 'Administrator Duta Teknokrat', 'admin', 'Panitia')
on conflict (id) do update set username=excluded.username, full_name=excluded.full_name, role=excluded.role, title=excluded.title;
