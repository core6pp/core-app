import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const SUPPORTED = ['ar', 'en'] as const;
const DEFAULT_LOCALE = 'ar';

/**
 * Two jobs, both need to happen before any Server Component reads
 * cookies/headers for this request:
 *
 * 1. Locale resolution (cookie > Accept-Language > default), written as a
 *    REQUEST header (not just a response header) so `headers()` inside
 *    Server Components — which reads the incoming request, not what
 *    middleware sends back — actually sees `x-core-locale`/`x-core-dir`.
 * 2. Supabase session refresh: `getUser()` here re-issues the auth cookie
 *    if the access token is close to expiring, so a Server Component never
 *    sees a stale/expired session and wrongly redirects a signed-in user
 *    back to /login.
 */
export async function middleware(req: NextRequest) {
  const cookieLocale = req.cookies.get('core_locale')?.value;
  const headerLocale = req.headers.get('accept-language')?.slice(0, 2);

  const locale = SUPPORTED.includes(cookieLocale as any)
    ? cookieLocale!
    : SUPPORTED.includes(headerLocale as any)
      ? headerLocale!
      : DEFAULT_LOCALE;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-core-locale', locale);
  requestHeaders.set('x-core-dir', locale === 'ar' ? 'rtl' : 'ltr');

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Touching getUser() is what actually triggers the refresh-if-needed logic.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|icons).*)',
};
