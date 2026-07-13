import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/gigs/:id/apply
 * Only accounts with is_freelancer = true can be assigned — enforced here
 * rather than relying on the client to only show the button to eligible
 * users, since hiding a button is not access control.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('is_freelancer').eq('id', user.id).single();

  if (!profile?.is_freelancer) {
    return NextResponse.json({ error: 'not_a_freelancer' }, { status: 403 });
  }

  const { error } = await supabase.rpc('accept_gig', { p_gig_id: params.id, p_freelancer_id: user.id });

  if (error) {
    const status = error.message === 'gig_not_open' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
