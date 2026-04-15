import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'password123';

    if (username === adminUser && password === adminPass) {
      const response = NextResponse.json({ success: true });
      response.cookies.set('admin_auth', 'success', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      return response;
    }

    return NextResponse.json({ error: 'Սխալ մուտքանուն կամ գաղտնաբառ' }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: 'Սերվերի սխալ' }, { status: 500 });
  }
}
