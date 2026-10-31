import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
function adminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Konfigurasi autentikasi server belum lengkap.');return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})}
export async function POST(request:NextRequest){
 try{
  const body=await request.json();const username=String(body.username||'').trim().toLowerCase();const password=String(body.password||'');
  if(!/^[a-z0-9._-]{3,30}$/.test(username)||!password)return NextResponse.json({error:'Username atau password tidak valid.'},{status:400});
  const admin=adminClient();const {data:profile,error:profileError}=await admin.from('profiles').select('id').eq('username',username).maybeSingle();
  if(profileError||!profile)return NextResponse.json({error:'Username atau password salah.'},{status:401});
  const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);const email=userData.user?.email;
  if(userError||!email)return NextResponse.json({error:'Akun tidak dapat digunakan. Hubungi Admin.'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!anon)throw new Error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi.');
  const auth=createClient(url,anon,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await auth.auth.signInWithPassword({email,password});
  if(error||!data.session)return NextResponse.json({error:'Username atau password salah.'},{status:401});
  return NextResponse.json({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Terjadi kesalahan server.'},{status:500})}
}
