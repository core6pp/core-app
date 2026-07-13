import { Logo } from './Logo';

type Challenge = {
  pillar: 'workshop' | 'lounge' | 'nomad';
  title: string;
  prompt: string;
  closesAt: string;
};

type TopContributor = {
  username: string;
  score: number;
};

/**
 * The Insight Panel is where the 14-hour Challenge Agent's output actually
 * surfaces to users — it's not a generic "trending" widget, it's the direct
 * UI for the spec's background agent.
 */
export function InsightPanel({
  challenges,
  topContributors,
  locale,
}: {
  challenges: Challenge[];
  topContributors: TopContributor[];
  locale: 'ar' | 'en';
}) {
  const isRtl = locale === 'ar';

  return (
    <aside className="w-72 shrink-0 space-y-4 border-s border-bg-border bg-bg-base p-4">
      <section className="rounded-xl border border-bg-border bg-bg-surface p-4">
        <div className="mb-2 flex items-center gap-2">
          <Logo size={18} pulse />
          <h4 className="font-display text-sm font-semibold text-ink-primary">
            {isRtl ? 'التحديات الحالية' : 'Active challenges'}
          </h4>
        </div>
        <ul className="space-y-3">
          {challenges.map((c) => (
            <li key={c.pillar} className="text-sm">
              <p className="font-display font-medium text-ink-primary">{c.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{c.prompt}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-muted">
                {isRtl ? 'ينتهي' : 'closes'} {c.closesAt}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-bg-border bg-bg-surface p-4">
        <h4 className="mb-2 font-display text-sm font-semibold text-ink-primary">
          {isRtl ? 'الأعلى استحقاقاً' : 'Top merit this week'}
        </h4>
        <ol className="space-y-1.5">
          {topContributors.map((c, i) => (
            <li key={c.username} className="flex items-center justify-between text-sm">
              <span className="text-ink-secondary">
                <span className="me-2 font-mono text-ink-muted">{i + 1}</span>
                {c.username}
              </span>
              <span className="font-mono text-amber-core">{c.score}</span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
