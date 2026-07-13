import { headers } from 'next/headers';
import { NavSidebar } from '@/components/NavSidebar';
import { GigCard } from '@/components/GigCard';
import { createServerClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n';

export default async function MarketplacePage() {
  const locale = (headers().get('x-core-locale') as Locale) ?? 'ar';
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: gigs } = await supabase
    .from('gigs')
    .select('id, title, description, budget_cents, currency, status, client:profiles!gigs_client_id_fkey(username)')
    .order('created_at', { ascending: false });

  const { data: profile } = user
    ? await supabase.from('profiles').select('is_freelancer').eq('id', user.id).single()
    : { data: null };

  return (
    <div className="flex min-h-screen">
      <NavSidebar locale={locale} activePillar="workshop" />
      <main className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-primary">
            {locale === 'ar' ? 'سوق الورشة للعمل الحر' : 'Workshop Marketplace'}
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {locale === 'ar'
              ? 'كور يأخذ عمولة 10% من قيمة كل عمل عند التسليم — بدون رسوم مقدمة.'
              : "Core takes a 10% commission on delivery — no upfront fees."}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(gigs ?? []).map((gig: any) => (
            <GigCard key={gig.id} gig={gig} locale={locale} canApply={Boolean(profile?.is_freelancer)} />
          ))}
        </div>

        {(gigs ?? []).length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">
            {locale === 'ar' ? 'ما فيه أعمال متاحة حالياً.' : 'No gigs posted yet.'}
          </p>
        )}
      </main>
    </div>
  );
}
