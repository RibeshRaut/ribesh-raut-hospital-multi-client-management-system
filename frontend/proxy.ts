import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    const token = request.cookies.get('token')?.value;
    const userInfoCookie = request.cookies.get('userInfo')?.value;

    let userType: string | null = null;
    if (userInfoCookie) {
      try {
        const decoded = decodeURIComponent(userInfoCookie);
        const userInfo = JSON.parse(decoded) as { userType?: string };
        userType = userInfo.userType || null;
      } catch {
        // Ignore malformed auth cookies and continue as anonymous.
      }
    }

    const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/hospitals', '/'];
    const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith('/hospital/'));
    const isProtectedPage = ['/dashboard', '/super-admin'].some(page => pathname.startsWith(page));

    if (token && isPublicPage) {
      const destination = userType === 'website_admin' ? '/super-admin' : '/dashboard';
      return NextResponse.redirect(new URL(destination, request.url));
    }

    if (!token && isProtectedPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|_next/data|favicon.ico|public).*)',
  ],
};