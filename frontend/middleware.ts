import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Get the token and user info from cookies
    const token = request.cookies.get('token')?.value;
    const userInfoCookie = request.cookies.get('userInfo')?.value;

    let userType: string | null = null;
    if (userInfoCookie) {
      try {
        const decoded = decodeURIComponent(userInfoCookie);
        const userInfo = JSON.parse(decoded) as { userType?: string };
        userType = userInfo.userType || null;
      } catch {
        // Cookie parse failed
      }
    }

    // Define public pages that should redirect if authenticated
    const publicPages = ['/login', '/register', '/forgot-password', '/reset-password', '/hospitals', '/'];
    const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith('/hospital/'));

    // Define protected pages
    const protectedPages = ['/dashboard', '/super-admin'];
    const isProtectedPage = protectedPages.some(page => pathname.startsWith(page));

    // If user is authenticated and on a public page, redirect to dashboard
    if (token && isPublicPage) {
      if (userType === 'website_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      } else {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }

    // If user is not authenticated and on a protected page, redirect to login
    if (!token && isProtectedPage) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|_api).*)',
  ],
};
