import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role } = await request.json();

    // 1. Buat user di Supabase Auth tanpa mengganggu session admin
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // 2. Insert data profil
    if (userData.user) {
      const { error: profileError } = await supabaseAdmin.from('profiles').insert([
        {
          id: userData.user.id,
          full_name: fullName,
          role: role || 'karyawan',
        },
      ]);

      if (profileError) throw profileError;
    }

    return NextResponse.json({ message: 'Berhasil membuat akun guru/karyawan' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}