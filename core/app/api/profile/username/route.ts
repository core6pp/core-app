import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * POST /api/profile/username
 * body: { username: string, displayName?: string }
 *
 * The 14-day cooldown lives in the change_username() Postgres function
 * (schema.sql), keyed off profiles.username_changed_at — a column the
 * `authenticated` role has no UPDATE grant on directly. So even if someone
 * bypasses this route and calls Supabase from the client with a forged
 * request, the database itself refuses a change inside the cooldown window.
 * This route just gives the user a clean error message instead of a raw
 * Postgres error.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { username, displayName } = await req.json();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: 'invalid_username', message_en: '3-20 letters, numbers or underscores.', message_ar: 'من 3 إلى 20 حرف أو رقم أو شرطة سفلية.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc('change_username', {
    p_user_id: user.id,
    p_new_username: username,
    p_new_display_name: displayName ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data?.[0];

  if (!result.ok) {
    if (result.message === 'cooldown_active') {
      return NextResponse.json(
        {
          error: 'cooldown_active',
          next_allowed_at: result.next_allowed_at,
          message_en: `You can change your name again on ${new Date(result.next_allowed_at).toLocaleDateString('en')}.`,
          message_ar: `تقدر تغيّر اسمك مرة ثانية بتاريخ ${new Date(result.next_allowed_at).toLocaleDateString('ar')}.`,
        },
        { status: 409 },
      );
    }
    if (result.message === 'username_taken') {
      return NextResponse.json(
        { error: 'username_taken', message_en: 'That username is taken.', message_ar: 'اسم المستخدم هذا مستخدم بالفعل.' },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true, next_allowed_at: result.next_allowed_at });
}
