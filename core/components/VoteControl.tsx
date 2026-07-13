'use client';

import { useState, useTransition } from 'react';

/**
 * Reddit-familiar layout (arrow / score / arrow, vertical), but restyled:
 * upvote = Amber (merit going up), downvote = Electric Indigo, never orange/blue.
 * We show an optimistic nudge instantly for feel, then reconcile with the real
 * value from the API response, since reputation math is server-authoritative.
 */
type VoteControlProps = {
  targetType: 'post' | 'comment';
  targetId: string;
  initialScore: number;
  initialVote: 'up' | 'down' | null;
};

export function VoteControl({ targetType, targetId, initialScore, initialVote }: VoteControlProps) {
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState<'up' | 'down' | null>(initialVote);
  const [isPending, startTransition] = useTransition();

  async function cast(value: 'up' | 'down') {
    const next = myVote === value ? null : value; // clicking the active arrow retracts the vote
    const prevScore = score;
    const prevVote = myVote;

    const delta =
      (next === 'up' ? 1 : next === 'down' ? -1 : 0) -
      (prevVote === 'up' ? 1 : prevVote === 'down' ? -1 : 0);
    setScore(prevScore + delta);
    setMyVote(next);

    startTransition(async () => {
      try {
        const res = await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, targetId, value: next }),
        });
        if (!res.ok) throw new Error('vote_failed');
        const data = await res.json();
        setScore(data.score);
      } catch {
        setScore(prevScore);
        setMyVote(prevVote);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-1 select-none" aria-label="Vote">
      <button
        onClick={() => cast('up')}
        disabled={isPending}
        aria-pressed={myVote === 'up'}
        aria-label="Upvote"
        className={[
          'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
          myVote === 'up'
            ? 'bg-amber-core/20 text-amber-core'
            : 'text-ink-muted hover:text-amber-core hover:bg-amber-core/10',
        ].join(' ')}
      >
        <ArrowUp />
      </button>

      <span
        className={[
          'font-mono text-sm tabular-nums',
          myVote === 'up' ? 'text-amber-core' : myVote === 'down' ? 'text-indigo-core' : 'text-ink-primary',
        ].join(' ')}
      >
        {formatScore(score)}
      </span>

      <button
        onClick={() => cast('down')}
        disabled={isPending}
        aria-pressed={myVote === 'down'}
        aria-label="Downvote"
        className={[
          'h-7 w-7 rounded-md flex items-center justify-center transition-colors',
          myVote === 'down'
            ? 'bg-indigo-core/20 text-indigo-core'
            : 'text-ink-muted hover:text-indigo-core hover:bg-indigo-core/10',
        ].join(' ')}
      >
        <ArrowDown />
      </button>
    </div>
  );
}

function formatScore(n: number) {
  if (Math.abs(n) < 1000) return String(n);
  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
}

function ArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 3L14 12H2L8 3Z" fill="currentColor" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 13L2 4H14L8 13Z" fill="currentColor" />
    </svg>
  );
}
