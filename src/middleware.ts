import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ============================================================
// Public paths — accessible without authentication
// ============================================================
// /api/auth/*  — NextAuth endpoints (login, logout, session)
// /api/setup   — One-time admin setup (only works when no admin exists)
// /api/debug   — Diagnostic endpoint (safe — masks sensitive values)
const PUBLIC_PATHS = ['/api/auth', '/api/setup', '/api/debug'];

export async function middleware(req: Request) {
  const { pathname } = new URL(req.url);
  // Only protect API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Check NextAuth session token
  // The secret MUST match the one used in src/lib/auth.ts for the JWT to be valid.
  // If NEXTAUTH_SECRET is unset on Vercel, this falls back to a dev secret —
  // tokens signed with the production secret won't validate, causing 401s.
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // Don't hard-fail in dev, but in production this is a critical misconfiguration
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL: NEXTAUTH_SECRET is not set — all API requests will return 401');
      return NextResponse.json(
        { error: 'خطأ في إعداد الخادم — يرجى التواصل مع المسؤول' },
        { status: 500 }
      );
    }
  }

  // Keep cookie name in sync with src/lib/auth.ts. On HTTPS, next-auth/jwt
  // defaults to `__Secure-next-auth.session-token`; a mismatch causes 401s
  // even when /api/auth/session returns a valid user.
  const isProd = process.env.NODE_ENV === 'production';
  const token = await getToken({
    req: req as any,
    secret: secret || 'dev-secret-change-me-in-production-please-yes',
    secureCookie: isProd,
    cookieName: isProd
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
  });
  if (!token) {
    return NextResponse.json(
      { error: 'غير مُصرّح — يرجى تسجيل الدخول' },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
