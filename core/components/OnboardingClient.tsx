'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { pillars } from '@/lib/design-tokens';

const PILLAR_ORDER = ['workshop', 'lounge', 'nomad'] as const;

const COPY = {
  ar: {
    title: 'بداية الرحلة',
    subtitle: 'اختر المجال الأقرب لك. تقدر تنشر في الثلاثة لاحقاً — هذا يحدد صفحتك الرئيسية بس.',
    cta: 'ابدأ في كور',
    items: {
      workshop: { name: 'الورشة', icon: '🔧', desc: 'برمجيات، هندسة حوسبة، إصلاح أجهزة، هندسة أنظمة.' },
      lounge: { name: 'الصالة', icon: '🎮', desc: 'عوالم الألعاب، تحليل الشخصيات، السينماتوغرافيا، جماليات التصميم.' },
      nomad: { name: 'الرحّالة', icon: '🧭', desc: 'توثيق سفر، تجارب واقعية، ملاحظة ثقافية.' },
    },
  },
  en: {
    title: 'Core Initiation',
    subtitle: 'Pick the pillar that describes you best. You can post in all three — this just sets your home feed.',
    cta: 'Enter Core',
    items: {
      workshop: { name: 'Workshop', icon: '🔧', desc: 'Software, computing architecture, hardware repair, systems engineering.' },
      lounge: { name: 'Lounge', icon: '🎮', desc: 'Gaming lore, character arcs, cinematography, design aesthetics.' },
      nomad: { name: 'Nomad', icon: '🧭', desc: 'Travel documentation, real-world experience, cultural observation.' },
    },
  },
} as const;

export function OnboardingClient({ locale }: { locale: 'ar' | 'en' }) {
  const [selected, setSelected] = useState<(typeof PILLAR_ORDER)[number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const t = COPY[locale];

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile/pillar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryPillar: selected }),
      });
      if (res.ok) router.push('/');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Logo size={56} pulse />
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink-primary">{t.title}</h1>
      <p className="mt-2 max-w-md text-center text-sm text-ink-secondary">{t.subtitle}</p>

      <div className="mt-8 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        {PILLAR_ORDER.map((slug) => {
          const item = t.items[slug];
          const accent = pillars[slug].color;
          const active = selected === slug;
          return (
            <button
              key={slug}
              onClick={() => setSelected(slug)}
              className={[
                'flex flex-col items-start gap-2 rounded-xl border bg-bg-surface p-5 text-start transition-all',
                active ? 'border-transparent ring-2' : 'border-bg-border hover:border-ink-muted',
              ].join(' ')}
              style={active ? ({ '--tw-ring-color': accent } as React.CSSProperties) : undefined}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="font-display text-lg font-semibold" style={{ color: active ? accent : undefined }}>
                {item.name}
              </span>
              <span className="text-sm text-ink-secondary">{item.desc}</span>
            </button>
          );
        })}
      </div>

      <button
        onClick={confirm}
        disabled={!selected || submitting}
        className="mt-10 rounded-lg bg-indigo-core px-6 py-2.5 font-display font-medium text-white transition-opacity disabled:opacity-40"
      >
        {t.cta}
      </button>
    </div>
  );
}
