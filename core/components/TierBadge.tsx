import { tiers } from '@/lib/design-tokens';

type TierKey = (typeof tiers)[number]['key'];

export function TierBadge({ tier, locale }: { tier: TierKey; locale: 'ar' | 'en' }) {
  const t = tiers.find((x) => x.key === tier) ?? tiers[0]!;
  const label = locale === 'ar' ? t.nameAr : t.nameEn;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-display font-medium"
      style={{ borderColor: t.color, color: t.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
      {label}
    </span>
  );
}
