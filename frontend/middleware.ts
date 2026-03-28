import { NextRequest, NextResponse } from 'next/server';

// This should be an environment variable
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function getPlatformSettings() {
  try {
    const res = await fetch(`${API_URL}/api/platform`);
    if (!res.ok) {
      console.error("Failed to fetch platform settings:", res.statusText);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("Error fetching platform settings:", error);
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Get the token and user info from cookies
  const token = request.cookies.get('token')?.value;
  const userInfoCookie = request.cookies.get('userInfo')?.value;
  
  let userType = null;
  if (userInfoCookie) {
    try {
      const userInfo = JSON.parse(userInfoCookie);
      userType = userInfo.userType;
    } catch (e) {
      // Cookie parse failed
    }
  }

  const settings = await getPlatformSettings();

  // During maintenance mode
  if (settings?.maintenanceMode) {
    // Allow maintenance page
    if (pathname === '/maintenance') {
      return NextResponse.next();
    }
    
    // Allow super admins to access their dashboard and settings
    if (userType === 'website_admin' && token) {
      if (pathname.startsWith('/super-admin')) {
        return NextResponse.next();
      }
    }
    
    // Allow login page for everyone
    if (pathname === '/login') {
      return NextResponse.next();
    }
    
    // Redirect everyone else to maintenance page
    if (!pathname.startsWith('/_next') && !pathname.startsWith('/public')) {
      return NextResponse.redirect(new URL('/maintenance', request.url));
    }
  }

  // If in maintenance page and mode is off, redirect to home
  if (pathname === '/maintenance' && !settings?.maintenanceMode) {
    return NextResponse.redirect(new URL('/', request.url));
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
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};
