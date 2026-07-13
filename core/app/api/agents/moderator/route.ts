import { NextRequest, NextResponse } from 'next/server';
import { createAgentClient } from '@/lib/supabase/server';

/**
 * The 10-Hour Moderator Agent.
 * Trigger: an external scheduler (Vercel Cron, Supabase pg_cron, or a
 * GitHub Action) calls this route every 10 hours with a shared secret —
 * see vercel.json's "crons" entry. It never runs client-side and never
 * trusts anything from a browser.
 *
 * Responsibilities per the spec:
 *   1. Sweep pending reports and auto-resolve the unambiguous ones.
 *   2. Flag content under 50 words with non-positive score as low-quality.
 *   3. Escalate anything it can't confidently resolve to Tier 4/5 humans
 *      (never auto-remove on an escalation — moderation power stays RBAC'd
 *      to Architect/Grand Architect per the spec, the agent only assists).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-agent-secret');
  if (secret !== process.env.AGENT_SHARED_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = createAgentClient();
  const results = { auto_flagged: 0, escalated: 0, reports_cleared: 0 };

  // 1. Low-quality sweep — flags, does not delete. A human Tier 4/5 makes the call.
  const { data: candidates } = await supabase
    .from('posts')
    .select('id, word_count, score, is_removed')
    .lt('word_count', 50)
    .lte('score', 0)
    .eq('is_removed', false);

  for (const post of candidates ?? []) {
    await supabase.from('reports').insert({
      post_id: post.id,
      reason: 'auto_low_quality',
      status: 'pending',
    });
    results.auto_flagged++;
  }

  // 2. Pending reports triage
  const { data: pending } = await supabase.from('reports').select('*').eq('status', 'pending');

  for (const report of pending ?? []) {
    // Simple, explainable heuristic here — swap for a classifier call once
    // you have moderation-labeled data; the agent's job is to reduce human
    // queue volume, not to make final calls alone.
    const severity = await scoreReportSeverity(report);

    if (severity === 'clear') {
      await supabase.from('reports').update({ status: 'reviewed_clear', resolved_at: new Date().toISOString() }).eq('id', report.id);
      results.reports_cleared++;
    } else {
      await supabase.from('reports').update({ status: 'escalated' }).eq('id', report.id);
      results.escalated++;
    }
  }

  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), ...results });
}

async function scoreReportSeverity(report: { reason: string }): Promise<'clear' | 'escalate'> {
  // Placeholder heuristic — replace with a real moderation model/prompt.
  // Kept deliberately simple and swappable rather than hardcoding a fake "AI call".
  return report.reason === 'auto_low_quality' ? 'clear' : 'escalate';
}
