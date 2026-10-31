
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const roles = ['Ketua Juri', 'Juri 2', 'Juri 3', 'Juri 4', 'Juri 5'];

function getAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Konfigurasi Supabase URL atau Anon Key belum tersedia.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum tersedia di Environment Variables.');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // 1. Ambil token sesi Admin
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';

    if (!token) {
      return NextResponse.json(
        { error: 'Sesi login tidak ditemukan. Silakan login ulang.' },
        { status: 401 }
      );
    }

    // 2. Verifikasi token menggunakan Anon Key
    const authClient = getAuthClient();
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Sesi login tidak valid atau sudah kedaluwarsa. Silakan login ulang.' },
        { status: 401 }
      );
    }

    // 3. Gunakan Service Role untuk operasi database
    const supabase = getAdminClient();

    // 4. Pastikan pengguna adalah Admin
    const { data: actor, error: actorError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (actorError) {
      return NextResponse.json(
        { error: 'Gagal memeriksa hak akses Admin: ' + actorError.message },
        { status: 500 }
      );
    }

    if (actor?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Hanya Admin yang dapat menambahkan akun juri.' },
        { status: 403 }
      );
    }

    // 5. Validasi data akun juri
    const body = await request.json();

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const fullName = String(body.full_name || '').trim();
    const title = String(body.title || '');

    if (!fullName || !username || !password || !title) {
      return NextResponse.json(
        { error: 'Nama, username, password, dan jabatan wajib diisi.' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username harus 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter.' },
        { status: 400 }
      );
    }

    if (!roles.includes(title)) {
      return NextResponse.json(
        { error: 'Jabatan juri tidak valid.' },
        { status: 400 }
      );
    }

    // 6. Maksimal lima akun juri
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'juri');

    if (countError) {
      return NextResponse.json(
        { error: 'Gagal memeriksa jumlah juri: ' + countError.message },
        { status: 500 }
      );
    }

    if ((count || 0) >= 5) {
      return NextResponse.json(
        { error: 'Jumlah juri maksimal 5 orang.' },
        { status: 409 }
      );
    }

    // 7. Periksa username
    const { data: duplicate, error: duplicateError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (duplicateError) {
      return NextResponse.json(
        { error: 'Gagal memeriksa username: ' + duplicateError.message },
        { status: 500 }
      );
    }

    if (duplicate) {
      return NextResponse.json(
        { error: 'Username sudah digunakan.' },
        { status: 409 }
      );
    }

    // 8. Periksa jabatan
    const { data: existingRole, error: roleError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'juri')
      .eq('title', title)
      .maybeSingle();

    if (roleError) {
      return NextResponse.json(
        { error: 'Gagal memeriksa jabatan: ' + roleError.message },
        { status: 500 }
      );
    }

    if (existingRole) {
      return NextResponse.json(
        { error: 'Jabatan tersebut sudah digunakan.' },
        { status: 409 }
      );
    }

    // 9. Buat akun Auth
    const email = `${username}@duta-teknokrat.invalid`;

    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
          role: 'juri',
          title,
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message || 'Akun gagal dibuat.' },
        { status: 400 }
      );
    }

    // 10. Buat profil juri
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: created.user.id,
        username,
        full_name: fullName,
        role: 'juri',
        title,
      });

    // Hapus akun Auth jika profil gagal dibuat
    if (profileError) {
      await supabase.auth.admin.deleteUser(created.user.id);

      return NextResponse.json(
        { error: 'Profil juri gagal dibuat: ' + profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        message: 'Akun dan profil juri berhasil dibuat.',
        judge: {
          id: created.user.id,
          username,
          full_name: fullName,
          title,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : 'Terjadi kesalahan server.',
      },
      { status: 500 }
    );
  }
}
