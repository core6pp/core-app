import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/vote
 * body: { targetType: 'post' | 'comment', targetId: string, value: 'up' | 'down' | null }
 *
 * This is the ONLY place a vote is ever written. The client never touches
 * `votes`, `posts.score`, or `profiles.reputation_score` directly — RLS on
 * those tables would reject it anyway, but the API route is what keeps the
 * client's job to "tell us what the user clicked", nothing more.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { targetType, targetId, value } = await req.json();

  if (!['post', 'comment'].includes(targetType)) {
    return NextResponse.json({ error: 'invalid_target_type' }, { status: 400 });
  }
  if (value !== null && !['up', 'down'].includes(value)) {
    return NextResponse.json({ error: 'invalid_value' }, { status: 400 });
  }

  const column = targetType === 'post' ? 'post_id' : 'comment_id';

  if (value === null) {
    // retracting a vote
    const { error } = await supabase.from('votes').delete().eq('voter_id', user.id).eq(column, targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // upsert keeps this to exactly one vote per (voter, target) — matches the
    // unique constraints in schema.sql, so a double-click can never double-count
    const { error } = await supabase
      .from('votes')
      .upsert({ voter_id: user.id, [column]: targetId, value }, { onConflict: `voter_id,${column}` });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Triggers in Postgres already recomputed score + author reputation by now.
  // Read the fresh, server-computed score back so the client reconciles with truth.
  const table = targetType === 'post' ? 'posts' : 'comments';
  const { data: fresh, error: readError } = await supabase.from(table).select('score').eq('id', targetId).single();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  return NextResponse.json({ score: fresh.score });
}
