import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback?code=...
 * Google redirects here after the user approves sign-in. This exchanges the
 * one-time `code` for a real session (writes the auth cookies), then decides
 * where to send a brand-new vs. returning user — the `handle_new_auth_user`
 * trigger in schema.sql has already created their `profiles` row by the time
 * this route runs, but `primary_pillar` is null until they finish Core
 * Initiation, which is what we check here.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const origin = req.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from('profiles').select('primary_pillar').eq('id', user!.id).single();

  return NextResponse.redirect(`${origin}${profile?.primary_pillar ? '/' : '/onboarding'}`);
}
