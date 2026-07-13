import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { OnboardingClient } from '@/components/OnboardingClient';
import type { Locale } from '@/lib/i18n';

export default async function OnboardingPage() {
  const locale = (headers().get('x-core-locale') as Locale) ?? 'ar';
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <OnboardingClient locale={locale} />;
}
