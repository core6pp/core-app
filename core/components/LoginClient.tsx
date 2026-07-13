'use client';

import { useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';

const COPY = {
  ar: { title: 'كور', subtitle: 'استحقاق، لا ضجيج.', button: 'المتابعة عبر جوجل', error: 'صار خطأ، حاول مرة ثانية.' },
  en: { title: 'Core', subtitle: 'Merit, not noise.', button: 'Continue with Google', error: 'Something went wrong, try again.' },
} as const;

export function LoginClient({ locale }: { locale: 'ar' | 'en' }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = COPY[locale];

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabaseClient();

    // redirectTo must be added to Supabase's Auth > URL Configuration >
    // Redirect URLs list, or Google will bounce the user back with an error
    // instead of completing sign-in — see README's Google OAuth setup steps.
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authError) {
      setError(t.error);
      setLoading(false);
    }
    // On success the browser is redirected to Google, so there's nothing
    // else to do here — the callback route takes over afterward.
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <Logo size={56} pulse />
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink-primary">{t.title}</h1>
      <p className="mt-1 text-sm text-ink-secondary">{t.subtitle}</p>

      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="mt-10 flex items-center gap-3 rounded-lg border border-bg-border bg-bg-surface px-5 py-2.5 font-display text-sm font-medium text-ink-primary transition-colors hover:border-indigo-core disabled:opacity-50"
      >
        <GoogleIcon />
        {t.button}
      </button>

      {error && <p className="mt-3 text-xs text-signal-danger">{error}</p>}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.86 2.7-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.16.27-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z" />
    </svg>
  );
}
