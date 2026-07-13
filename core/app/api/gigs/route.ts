import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

const DEFAULT_COMMISSION_BPS = 1000; // 10% — the platform's cut as middleman, per the spec

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('gigs')
    .select('id, title, description, budget_cents, currency, status, created_at, client:profiles!gigs_client_id_fkey(username)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gigs: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { title, description, budgetCents, currency } = await req.json();

  if (!title || !description || !Number.isInteger(budgetCents) || budgetCents <= 0) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('gigs')
    .insert({
      client_id: user.id,
      title,
      description,
      budget_cents: budgetCents,
      currency: currency ?? 'USD',
      commission_bps: DEFAULT_COMMISSION_BPS,
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ gigId: data.id }, { status: 201 });
}
