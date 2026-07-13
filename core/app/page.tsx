import { headers } from 'next/headers';
import { NavSidebar } from '@/components/NavSidebar';
import { InsightPanel } from '@/components/InsightPanel';
import { PostCard } from '@/components/PostCard';
import { createServerClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n';

// This page is a Server Component: it reads the feed straight from Supabase
// with the request's own auth cookie, so RLS decides what's visible — no
// separate "is this post removed" check needed in the component itself.
export default async function HomePage() {
  const headerList = headers();
  const locale = (headerList.get('x-core-locale') as Locale) ?? 'ar';
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: posts } = await supabase
    .from('posts')
    .select('id, title, body, pillar, score, comment_count, created_at, is_challenge_response, author:profiles(username, display_name, avatar_url, tier)')
    .eq('is_removed', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: myVotes } = user
    ? await supabase.from('votes').select('post_id, value').eq('voter_id', user.id)
    : { data: [] as { post_id: string; value: 'up' | 'down' }[] };

  const voteByPost = new Map((myVotes ?? []).map((v) => [v.post_id, v.value]));

  const { data: activeChallenges } = await supabase
    .from('challenges')
    .select('pillar, title, prompt, closes_at')
    .is('winner_post_id', null)
    .order('opens_at', { ascending: false })
    .limit(3);

  const { data: topContributors } = await supabase
    .from('profiles')
    .select('username, reputation_score')
    .order('reputation_score', { ascending: false })
    .limit(5);

  return (
    <div className="flex min-h-screen">
      <NavSidebar locale={locale} />

      <main className="flex-1 space-y-3 p-4">
        {(posts ?? []).map((post: any) => (
          <PostCard
            key={post.id}
            locale={locale}
            post={{
              id: post.id,
              title: post.title,
              body: post.body,
              pillar: post.pillar,
              score: post.score,
              commentCount: post.comment_count,
              createdAt: new Date(post.created_at).toLocaleDateString(locale),
              myVote: voteByPost.get(post.id) ?? null,
              isChallengeResponse: post.is_challenge_response,
            }}
            author={{
              username: post.author.username,
              displayName: post.author.display_name,
              avatarUrl: post.author.avatar_url ?? '/default-avatar.png',
              tier: post.author.tier,
            }}
          />
        ))}
        {(posts ?? []).length === 0 && (
          <p className="p-8 text-center text-sm text-ink-muted">
            {locale === 'ar' ? 'ما فيه منشورات بعد. كن أول من ينشر.' : 'No posts yet — be the first.'}
          </p>
        )}
      </main>

      <InsightPanel
        locale={locale}
        challenges={(activeChallenges ?? []).map((c) => ({
          pillar: c.pillar,
          title: c.title,
          prompt: c.prompt,
          closesAt: new Date(c.closes_at).toLocaleString(locale),
        }))}
        topContributors={(topContributors ?? []).map((p) => ({ username: p.username, score: p.reputation_score }))}
      />
    </div>
  );
}
