'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function SignOutButton({ locale }: { locale: 'ar' | 'en' }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button onClick={signOut} className="text-sm text-ink-muted hover:text-signal-danger">
      {locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
    </button>
  );
}
