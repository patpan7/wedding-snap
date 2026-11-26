import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const uploadAttempts = new Map<string, { count: number; resetAt: number }>();

function checkUploadRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = uploadAttempts.get(ip);
  if (!record || now > record.resetAt) {
    uploadAttempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (record.count >= 20) return false; // 20 uploads/min per IP
  record.count++;
  return true;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com wss://*.supabase.co",
  "media-src 'self' blob: https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // CSP Header
  res.headers.set('Content-Security-Policy', CSP_HEADER);

  // Security headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Upload rate limiting for /api/upload/presign
  if (req.nextUrl.pathname.startsWith('/api/upload/presign') && req.method === 'POST') {
    const ip = getClientIp(req);
    if (!checkUploadRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Πολύ πολλαpload αιτήσεις. Δοκιμάστε ξανά σε ένα λεπτό.' },
        { status: 429 }
      );
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
};