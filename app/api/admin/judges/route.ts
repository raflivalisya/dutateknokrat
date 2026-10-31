import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const roles=['Ketua Juri','Juri 2','Juri 3','Juri 4','Juri 5'];
function getAdminClient(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Isi SUPABASE_SERVICE_ROLE_KEY di environment server.');return createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})}
export async function POST(request:NextRequest){try{
 const authorization=request.headers.get('authorization');const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';if(!token)return NextResponse.json({error:'Sesi login tidak ditemukan.'},{status:401});
 const supabase=getAdminClient();const {data:authData,error:authError}=await supabase.auth.getUser(token);if(authError||!authData.user)return NextResponse.json({error:'Sesi login tidak valid.'},{status:401});
 const {data:actor}=await supabase.from('profiles').select('role').eq('id',authData.user.id).maybeSingle();if(actor?.role!=='admin')return NextResponse.json({error:'Hanya Admin yang dapat menambahkan akun juri.'},{status:403});
 const body=await request.json();const username=String(body.username||'').trim().toLowerCase();const password=String(body.password||'');const fullName=String(body.full_name||'').trim();const title=String(body.title||'');
 if(!fullName||!username||!password||!title)return NextResponse.json({error:'Nama, username, password, dan jabatan wajib diisi.'},{status:400});
 if(!/^[a-z0-9._-]{3,30}$/.test(username))return NextResponse.json({error:'Username harus 3–30 karakter: huruf kecil, angka, titik, garis bawah, atau tanda hubung.'},{status:400});
 if(password.length<8)return NextResponse.json({error:'Password minimal 8 karakter.'},{status:400});if(!roles.includes(title))return NextResponse.json({error:'Jabatan juri tidak valid.'},{status:400});
 const {count}=await supabase.from('profiles').select('id',{count:'exact',head:true}).eq('role','juri');if((count||0)>=5)return NextResponse.json({error:'Jumlah juri maksimal 5 orang.'},{status:409});
 const {data:duplicate}=await supabase.from('profiles').select('id').eq('username',username).maybeSingle();if(duplicate)return NextResponse.json({error:'Username sudah digunakan.'},{status:409});
 const {data:existingRole}=await supabase.from('profiles').select('id').eq('role','juri').eq('title',title).maybeSingle();if(existingRole)return NextResponse.json({error:'Jabatan tersebut sudah digunakan.'},{status:409});
 const email=`${username}@duta-teknokrat.invalid`;
 const {data:created,error:createError}=await supabase.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:fullName,username,role:'juri',title}});
 if(createError||!created.user)return NextResponse.json({error:createError?.message||'Akun gagal dibuat.'},{status:400});
 const {error:profileError}=await supabase.from('profiles').insert({id:created.user.id,username,full_name:fullName,role:'juri',title});
 if(profileError){await supabase.auth.admin.deleteUser(created.user.id);return NextResponse.json({error:profileError.message},{status:400});}
 return NextResponse.json({message:'Akun dan profil juri berhasil dibuat.',judge:{id:created.user.id,username,full_name:fullName,title}},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Terjadi kesalahan server.'},{status:500})}}
