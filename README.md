# Sistem Penilaian Duta Teknokrat 2026

Aplikasi Next.js + Supabase berdasarkan file HTML sumber terbaru yang disertakan di `docs/source-original.html`.

## Aturan penilaian yang dipertahankan
- Maksimal 5 juri: Ketua Juri, Juri 2, Juri 3, Juri 4, Juri 5.
- Setiap juri memasukkan satu nilai Speech (0–100) untuk setiap finalis.
- Rata-rata Speech = total nilai Speech yang masuk dibagi jumlah seluruh juri terdaftar (juri yang belum mengisi dihitung 0), sama seperti logika sumber.
- Top 6 Putra dan Top 6 Putri berdasarkan rata-rata Speech maju ke QnA.
- Setiap juri memasukkan satu nilai QnA (0–100) untuk setiap finalis Top 6.
- Pemenang tiap kategori diurutkan berdasarkan total nilai QnA dari seluruh juri: Winner sampai 5th Runner Up.
- Berita Acara tersedia untuk rekap 11 besar Speech, daftar 6 besar QnA, dan pengumuman pemenang.

## 1. Menyiapkan Supabase
1. Buat project Supabase.
2. Buka **SQL Editor → New query**.
3. Jalankan `supabase/migrations/0001_initial_schema.sql` di SQL Editor.
4. Jalankan juga `supabase/migrations/0002_username_login.sql` untuk menambahkan username login. Jika profil Admin sudah dibuat pada tahap sebelumnya, migrasi ini otomatis memberi username `admin`.
5. Buka **Authentication → Users → Add user** dan buat akun admin dengan email serta password yang aman.
6. Salin UUID admin. Buka `supabase/SETUP_PROFILES.sql`, ganti `GANTI-DENGAN-UUID-AUTH-ADMIN` dan nama admin, lalu jalankan di SQL Editor.
7. Setelah profil Admin tersedia, akun juri dapat dibuat langsung dari menu **Kelola Data Juri**. Admin mengisi nama, username, password awal, dan jabatan; server membuat akun Supabase Auth sekaligus profilnya. Maksimal lima juri.

## 2. Konfigurasi aplikasi
1. Salin `.env.example` menjadi `.env.local`.
2. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` (atau publishable key) dari **Project Settings → API**.
3. Isi `SUPABASE_SERVICE_ROLE_KEY` dengan secret/service_role key dari Supabase. Key ini hanya digunakan oleh route server untuk login berbasis username dan membuat akun juri. Jangan beri awalan `NEXT_PUBLIC_`, jangan kirim ke browser, dan jangan commit `.env.local` ke GitHub.

## 3. Menjalankan lokal
```bash
npm install
npm run dev
```
Buka http://localhost:3000.

Untuk cek produksi:
```bash
npm run build
```

## 4. Deploy ke GitHub dan Vercel
1. Buat repository GitHub baru dan upload seluruh isi folder project (jangan upload `.env.local` atau `node_modules`).
2. Import repository tersebut ke Vercel.
3. Di Vercel → Settings → Environment Variables, tambahkan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` (atur untuk environment yang dipakai).
4. Deploy ulang setelah menambahkan environment variables.

## Keamanan
- Admin dan Juri memakai satu halaman login dengan username dan password. Username Admin awal adalah `admin`; password tetap password akun Auth Admin yang sudah dibuat. Juri menggunakan username yang dibuat Admin.
- Row Level Security membatasi admin untuk pengelolaan data dan juri hanya untuk nilai miliknya sendiri.
- Database memvalidasi rentang nilai 0–100, maksimal 5 profil juri, dan QnA hanya untuk Top 6 per kategori.
- Kunci penilaian tersedia di dashboard admin.
- Realtime aktif untuk data finalis dan nilai.
- Pembuatan akun juri dilakukan melalui API server; API memverifikasi access token dan memastikan pemanggil ber-role admin sebelum memakai secret key.

## Catatan sebelum dipakai pada acara
Project ini sudah disusun sesuai alur pada HTML, tetapi harus diuji pada project Supabase milik panitia: jalankan migration, buat profil admin, login admin/juri dari perangkat berbeda, uji nilai Speech dan Top 6, uji QnA, lalu cetak ketiga berita acara. Build produksi perlu diverifikasi setelah dependency berhasil dipasang di komputer/deployment environment.
