'use client';

import { useState } from 'react';

type Gig = {
  id: string;
  title: string;
  description: string;
  budget_cents: number;
  currency: string;
  status: string;
  client: { username: string };
};

const STATUS_LABEL: Record<string, { en: string; ar: string; color: string }> = {
  open: { en: 'Open', ar: 'مفتوح', color: '#4FAE8C' },
  in_progress: { en: 'In progress', ar: 'قيد التنفيذ', color: '#5B4FE0' },
  delivered: { en: 'Delivered', ar: 'تم التسليم', color: '#E8A33D' },
  completed: { en: 'Completed', ar: 'مكتمل', color: '#9AA1B2' },
};

export function GigCard({ gig, locale, canApply }: { gig: Gig; locale: 'ar' | 'en'; canApply: boolean }) {
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState(gig.status);
  const label = STATUS_LABEL[status] ?? STATUS_LABEL.open;

  async function apply() {
    setPending(true);
    try {
      const res = await fetch(`/api/gigs/${gig.id}/apply`, { method: 'POST' });
      if (res.ok) setStatus('in_progress');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-bg-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display font-semibold text-ink-primary">{gig.title}</h3>
        {label && (
          <span
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ color: label.color, backgroundColor: `${label.color}1A` }}
          >
            {locale === 'ar' ? label.ar : label.en}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-secondary">{gig.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-sm text-amber-core">
          {(gig.budget_cents / 100).toFixed(2)} {gig.currency}
        </span>
        <span className="text-xs text-ink-muted">@{gig.client.username}</span>
      </div>
      {canApply && status === 'open' && (
        <button
          onClick={apply}
          disabled={pending}
          className="mt-3 w-full rounded-lg bg-indigo-core py-2 text-sm font-display font-medium text-white disabled:opacity-40"
        >
          {locale === 'ar' ? 'تقدّم لهذا العمل' : 'Apply'}
        </button>
      )}
    </div>
  );
}
