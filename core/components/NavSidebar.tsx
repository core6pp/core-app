import Link from 'next/link';
import { Logo } from './Logo';
import { pillars } from '@/lib/design-tokens';

const PILLAR_ORDER = ['workshop', 'lounge', 'nomad'] as const;

export function NavSidebar({ locale, activePillar }: { locale: 'ar' | 'en'; activePillar?: string }) {
  const labels =
    locale === 'ar'
      ? { workshop: 'الورشة', lounge: 'الصالة', nomad: 'الرحّالة', home: 'الرئيسية', profile: 'حسابي', marketplace: 'سوق العمل الحر' }
      : { workshop: 'Workshop', lounge: 'Lounge', nomad: 'Nomad', home: 'Home', profile: 'Profile', marketplace: 'Marketplace' };

  return (
    <nav className="flex h-full w-56 flex-col gap-1 border-e border-bg-border bg-bg-base p-3">
      <Link href="/" className="mb-4 flex items-center gap-2 px-1">
        <Logo size={28} />
        <span className="font-display text-lg font-semibold text-ink-primary">
          {locale === 'ar' ? 'كور' : 'Core'}
        </span>
      </Link>

      <NavLink href="/" active={!activePillar}>
        {labels.home}
      </NavLink>

      <div className="my-2 h-px bg-bg-border" />

      {PILLAR_ORDER.map((slug) => (
        <NavLink key={slug} href={`/p/${slug}`} active={activePillar === slug} accent={pillars[slug].color}>
          {labels[slug]}
        </NavLink>
      ))}

      <div className="my-2 h-px bg-bg-border" />

      <NavLink href="/marketplace" active={activePillar === 'marketplace'}>
        {labels.marketplace}
      </NavLink>

      <NavLink href="/profile">{labels.profile}</NavLink>
    </nav>
  );
}

function NavLink({
  href,
  active,
  accent,
  children,
}: {
  href: string;
  active?: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-bg-raised text-ink-primary' : 'text-ink-secondary hover:bg-bg-raised hover:text-ink-primary',
      ].join(' ')}
      style={active && accent ? { boxShadow: `inset 2px 0 0 ${accent}` } : undefined}
    >
      {children}
    </Link>
  );
}
