
import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/setup'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // Check if the route is public
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    // Get the session cookie
    const sessionCookie = request.cookies.get('session')?.value;

    // Allow access to public routes, regardless of session status (page.tsx will handle redirection if logged in)
    if (isPublicRoute) {
        return NextResponse.next();
    }

    // If trying to access a protected route without a session, redirect to login
    if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        // If trying to access the root, redirect to login directly
        if(pathname === '/') {
            return NextResponse.redirect(loginUrl);
        }
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};
