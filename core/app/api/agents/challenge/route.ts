import { NextRequest, NextResponse } from 'next/server';
import { createAgentClient } from '@/lib/supabase/server';

const PROMPT_BANK: Record<string, string[]> = {
  workshop: [
    'Diagnose and fix a memory leak in a long-running Node.js service — walk through your tooling, not just the fix.',
    'Design a hardware repair triage checklist for a laptop that powers on but shows no display.',
  ],
  lounge: [
    "Argue for or against: this season's antagonist arc earned its ending.",
    'Break down one shot from a recent release that would fail in a lesser film — what makes the blocking work.',
  ],
  nomad: [
    'Document a 48-hour stop in a city you would never plan a full trip around — what made it worth the layover.',
    'Describe a cultural custom you misunderstood on first contact, and what changed your read on it.',
  ],
};

/**
 * The 14-Hour Challenge Agent.
 * Trigger: external scheduler, shared-secret protected, same pattern as the
 * Moderator Agent. Closes the previous round for each pillar (picks a winner
 * by score, awards the +15 reputation bonus already wired into the schema's
 * scoring convention) and opens a new one.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = createAgentClient();
  const pillars = ['workshop', 'lounge', 'nomad'] as const;
  const created: string[] = [];

  for (const pillar of pillars) {
    // Close the outgoing round: highest-scoring response wins.
    const { data: expiring } = await supabase
      .from('challenges')
      .select('id')
      .eq('pillar', pillar)
      .lt('closes_at', new Date().toISOString())
      .is('winner_post_id', null)
      .order('closes_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (expiring) {
      const { data: topPost } = await supabase
        .from('posts')
        .select('id, author_id')
        .eq('challenge_id', expiring.id)
        .eq('is_challenge_response', true)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (topPost) {
        await supabase.from('challenges').update({ winner_post_id: topPost.id }).eq('id', expiring.id);
        await supabase.rpc('apply_reputation_delta', { p_user_id: topPost.author_id, p_delta: 15 });
      }
    }

    // Open the next round for this pillar.
    const bank = PROMPT_BANK[pillar];
    if (!bank || bank.length === 0) {
      continue; // no prompts configured for this pillar — skip rather than crash
    }
    const prompt = bank[Math.floor(Math.random() * bank.length)];
    const opensAt = new Date();
    const closesAt = new Date(opensAt.getTime() + 14 * 60 * 60 * 1000);

    await supabase.from('challenges').insert({
      pillar,
      title: pillar && pillar.length > 0 ? `${pillar.charAt(0).toUpperCase()}${pillar.slice(1)} Challenge` : 'Challenge',
      prompt,
      opens_at: opensAt.toISOString(),
      closes_at: closesAt.toISOString(),
    });
    created.push(pillar);
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), opened_for: created });
}
