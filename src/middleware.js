import { NextResponse } from 'next/server';

export function middleware(request) {
  const authCookie = request.cookies.get('admin_auth');
  const path = request.nextUrl.pathname;

  // Protect API routes except auth
  if (path.startsWith('/api/') && path !== '/api/auth') {
    if (authCookie?.value !== 'success') {
      return NextResponse.json({ error: 'Ոչ լիազորված մուտք' }, { status: 401 });
    }
  }

  // Protect root page
  if (path === '/') {
    if (authCookie?.value !== 'success') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Redirect away from login if already authenticated
  if (path === '/login') {
    if (authCookie?.value === 'success') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/api/:path*'],
};
