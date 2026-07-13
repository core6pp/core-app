import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { isConfigured, payoutFreelancer } from '@/lib/payments/stripe';

/**
 * POST /api/gigs/:id/complete
 * Client confirms delivery. `complete_gig()` in Postgres records the
 * commission split immediately, regardless of whether a payment provider
 * is wired up yet — the commission ledger is the source of truth for
 * "what was owed", separate from "was it actually transferred", which is
 * what `provider_ref` staying null signals until Stripe (or whichever
 * provider you pick) is connected.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let providerRef: string | null = null;

  if (isConfigured()) {
    const { data: gig } = await supabase
      .from('gigs')
      .select('budget_cents, commission_bps, currency, freelancer:profiles(stripe_account_id)')
      .eq('id', params.id)
      .single();

    if (gig) {
      const commissionCents = Math.round((gig.budget_cents * gig.commission_bps) / 10000);
      try {
        const result = await payoutFreelancer({
          freelancerStripeAccountId: (gig as any).freelancer?.stripe_account_id,
          grossCents: gig.budget_cents,
          commissionCents,
          currency: gig.currency,
        });
        providerRef = result.providerRef;
      } catch (e: any) {
        return NextResponse.json({ error: 'payout_failed', detail: e.message }, { status: 502 });
      }
    }
  }

  const { error } = await supabase.rpc('complete_gig', {
    p_gig_id: params.id,
    p_client_id: user.id,
    p_provider_ref: providerRef,
  });

  if (error) {
    const status = error.message === 'not_ready_to_complete' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true, paid: isConfigured() });
}
