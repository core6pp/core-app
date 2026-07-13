import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { LoginClient } from '@/components/LoginClient';
import type { Locale } from '@/lib/i18n';

export default async function LoginPage() {
  const locale = (headers().get('x-core-locale') as Locale) ?? 'ar';
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/'); // already signed in — don't show the login screen again

  return <LoginClient locale={locale} />;
}
