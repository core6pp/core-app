/**
 * Payment provider abstraction — isolated on purpose so wiring up Stripe
 * Connect (or swapping to a local gateway like Mada/Tabby later) touches
 * only this file, never the gig lifecycle logic in the API routes.
 *
 * Nothing here runs yet: STRIPE_SECRET_KEY is unset, so `isConfigured()`
 * returns false and the gig routes record commission math without
 * attempting a real charge/transfer. That's deliberate — you said decide
 * the provider later, so the marketplace state machine (open → in_progress
 * → delivered → completed) works and is testable today, independent of
 * whether money actually moves yet.
 */

export function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Once you add STRIPE_SECRET_KEY, this is the one function the `complete`
 * route calls. Stripe Connect's standard flow for a "platform takes a cut"
 * marketplace is: charge the client to the platform account, then create a
 * Transfer to the freelancer's connected account for (gross - commission).
 * Left unimplemented (not stubbed with fake success) so a real integration
 * attempt fails loudly instead of silently pretending to have paid someone.
 */
export async function payoutFreelancer(_args: {
  freelancerStripeAccountId: string;
  grossCents: number;
  commissionCents: number;
  currency: string;
}): Promise<{ providerRef: string }> {
  if (!isConfigured()) {
    throw new Error('payment_provider_not_configured');
  }
  throw new Error('stripe_connect_not_yet_implemented');
}
