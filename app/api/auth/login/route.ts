
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Konfigurasi Supabase server belum lengkap.');
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
    const body = await request.json();

    // Mendukung identifier, username, atau email
    const identifier = String(
      body.identifier || body.username || body.email || ''
    )
      .trim()
      .toLowerCase();

    const password = String(body.password || '');

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('Konfigurasi Supabase belum lengkap.');
    }

    let email = identifier;

    // Jika bukan email, cari email berdasarkan username Juri/Admin
    if (!identifier.includes('@')) {
      const admin = getAdminClient();

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('id')
        .ilike('username', identifier)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json(
          { error: 'Username atau password salah.' },
          { status: 401 }
        );
      }

      const { data: userData, error: userError } =
        await admin.auth.admin.getUserById(profile.id);

      if (userError || !userData.user?.email) {
        return NextResponse.json(
          { error: 'Akun tidak ditemukan. Hubungi Admin.' },
          { status: 401 }
        );
      }

      email = userData.user.email;
    }

    // Login menggunakan Supabase Auth
    const auth = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: 'Email/username atau password salah.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan pada server.',
      },
      { status: 500 }
    );
  }
}
