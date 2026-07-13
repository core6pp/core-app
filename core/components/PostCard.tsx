import Link from 'next/link';
import { VoteControl } from './VoteControl';
import { ProfileFrame } from './ProfileFrame';
import { TierBadge } from './TierBadge';
import { PostMenu } from './PostMenu';
import { pillars } from '@/lib/design-tokens';

type PostCardProps = {
  post: {
    id: string;
    title: string;
    body: string;
    pillar: 'workshop' | 'lounge' | 'nomad';
    score: number;
    commentCount: number;
    createdAt: string;
    myVote: 'up' | 'down' | null;
    isChallengeResponse: boolean;
  };
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string;
    tier: 'observer' | 'participant' | 'consultant' | 'architect' | 'grand_architect';
  };
  locale: 'ar' | 'en';
};

/**
 * The layout is deliberately Reddit-familiar — vote rail on the leading
 * edge, title/meta/body stacked beside it — because that scan pattern is
 * what the brief asked to keep. What's not Reddit: no karma-farming meme
 * chrome, no orange. Pillar tag + tier badge carry all the "who/where" info
 * a Reddit post buries in flair.
 */
export function PostCard({ post, author, locale }: PostCardProps) {
  const pillarMeta = pillars[post.pillar];
  const isRtl = locale === 'ar';

  return (
    <article className="flex gap-3 rounded-xl border border-bg-border bg-bg-surface p-4">
      <VoteControl targetType="post" targetId={post.id} initialScore={post.score} initialVote={post.myVote} />

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span
              className="rounded-md px-1.5 py-0.5 font-display font-medium"
              style={{ color: pillarMeta.color, backgroundColor: `${pillarMeta.color}1A` }}
            >
              {post.pillar}
            </span>
            {post.isChallengeResponse && (
              <span className="rounded-md bg-amber-core/10 px-1.5 py-0.5 font-display text-amber-core">
                {isRtl ? 'رد تحدي' : 'Challenge entry'}
              </span>
            )}
            <span>·</span>
            <ProfileFrame avatarUrl={author.avatarUrl} tier={author.tier} size={20} />
            <Link href={`/u/${author.username}`} className="hover:text-ink-primary">
              {author.displayName ?? author.username}
            </Link>
            <TierBadge tier={author.tier} locale={locale} />
          </div>

          <PostMenu
            postId={post.id}
            postUrl={typeof window !== 'undefined' ? `${window.location.origin}/posts/${post.id}` : `/posts/${post.id}`}
            postText={`${post.title}\n\n${post.body}`}
            locale={locale}
          />
        </div>

        <Link href={`/posts/${post.id}`}>
          <h3 className="font-display text-base font-semibold leading-snug text-ink-primary hover:underline">
            {post.title}
          </h3>
        </Link>

        <p className="mt-1 line-clamp-3 text-sm text-ink-secondary">{post.body}</p>

        <div className="mt-2 flex items-center gap-4 text-xs text-ink-muted">
          <Link href={`/posts/${post.id}#comments`} className="hover:text-ink-primary">
            {post.commentCount} {isRtl ? 'تعليق' : 'comments'}
          </Link>
          <span>{post.createdAt}</span>
        </div>
      </div>
    </article>
  );
}
