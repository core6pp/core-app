import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const VALID = ['workshop', 'lounge', 'nomad'];

/**
 * Sets primary_pillar once, at Core Initiation. Unlike username/tier, this
 * column has no cooldown or special grant restriction — a user can revisit
 * onboarding and change their home feed anytime without touching identity
 * or reputation, so it's a plain RLS-protected self-update.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { primaryPillar } = await req.json();
  if (!VALID.includes(primaryPillar)) {
    return NextResponse.json({ error: 'invalid_pillar' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update({ primary_pillar: primaryPillar }).eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
