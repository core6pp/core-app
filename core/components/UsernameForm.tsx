'use client';

import { useState } from 'react';

type Props = {
  locale: 'ar' | 'en';
  currentUsername: string;
  nextAllowedAt: string; // ISO timestamp from profiles.username_changed_at + 14d, computed server-side
};

/**
 * The cooldown check here is purely a UX convenience (disabling the button,
 * showing a countdown) — the real enforcement is the change_username()
 * Postgres function. If this component's clock is wrong or someone bypasses
 * the disabled state, the API call still fails safely with `cooldown_active`.
 */
export function UsernameForm({ locale, currentUsername, nextAllowedAt }: Props) {
  const [value, setValue] = useState(currentUsername);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const locked = new Date(nextAllowedAt) > new Date();
  const t =
    locale === 'ar'
      ? {
          label: 'اسم المستخدم',
          save: 'حفظ',
          locked: `تقدر تغيّره بعد ${new Date(nextAllowedAt).toLocaleDateString('ar')}`,
          note: 'يمكن تغييره مرة كل 14 يوم فقط.',
        }
      : {
          label: 'Username',
          save: 'Save',
          locked: `You can change this again after ${new Date(nextAllowedAt).toLocaleDateString('en')}`,
          note: 'Can be changed once every 14 days.',
        };

  async function submit() {
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(locale === 'ar' ? data.message_ar : data.message_en);
        setStatus('error');
        return;
      }
      setStatus('idle');
    } catch {
      setError(locale === 'ar' ? 'صار خطأ، حاول مرة ثانية.' : 'Something went wrong, try again.');
      setStatus('error');
    }
  }

  return (
    <div className="max-w-sm space-y-2">
      <label className="block font-display text-sm font-medium text-ink-primary">{t.label}</label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={locked || status === 'saving'}
        className="w-full rounded-lg border border-bg-border bg-bg-surface px-3 py-2 text-sm text-ink-primary disabled:opacity-50"
      />
      <p className="text-xs text-ink-muted">{locked ? t.locked : t.note}</p>
      {error && <p className="text-xs text-signal-danger">{error}</p>}
      <button
        onClick={submit}
        disabled={locked || status === 'saving' || value === currentUsername}
        className="rounded-lg bg-indigo-core px-4 py-2 text-sm font-display font-medium text-white disabled:opacity-40"
      >
        {t.save}
      </button>
    </div>
  );
}
