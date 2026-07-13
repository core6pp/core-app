# Core — Foundation + UI + Marketplace + Auth

All four phases are now real, working code: database/reputation
foundation, onboarding/dashboard/profile UI, the Workshop marketplace, and
Google sign-in via Supabase Auth. The only thing left is optional (a live
payment provider) — see "What's still open" below, and the deployment
walkthrough after it.

## What's actually in this drop

| Path | What it does |
|---|---|
| `lib/supabase/schema.sql` | Full DB: profiles, pillars, posts/comments, votes, weighted reputation + tier triggers, 14-day username cooldown, RBAC, reports, challenges, marketplace gigs + commission ledger, RLS on every table |
| `lib/design-tokens.ts` | Deep Space Gray / Amber / Electric Indigo palette, type scale, per-pillar accent colors |
| `tailwind.config.ts` | Wires the tokens in, adds RTL logical-property support, the one signature animation (`core-pulse`) |
| `components/Logo.tsx` | The "Core" mark — hollow squircle ring (indigo) around a smaller solid squircle (amber). Same component doubles as a loading spinner and a score-milestone pulse |
| `components/VoteControl.tsx` | Reddit-familiar up/down arrow layout, restyled amber/indigo, optimistic UI reconciled against server truth |
| `app/api/vote/route.ts` | The only place a vote is ever written — client sends intent, DB triggers do the math |
| `app/api/profile/username/route.ts` | Username change, cooldown enforced *in Postgres*, not just here |
| `app/api/agents/moderator/route.ts` | 10-hour agent: flags <50-word/no-engagement posts, triages reports, escalates to Tier 4/5 humans |
| `app/api/agents/challenge/route.ts` | 14-hour agent: closes the previous round per pillar, awards the winner, opens the next |
| `vercel.json` | Cron schedule for both agents |
| `messages/en.json`, `messages/ar.json` | UI strings for onboarding, tiers, profile, moderation |
| `middleware.ts` | Resolves locale + sets `dir="rtl"/"ltr"` before any page renders |
| `app/onboarding/page.tsx` + `components/OnboardingClient.tsx` | The Core Initiation screen — three pillar cards, bilingual |
| `app/page.tsx` | The 3-column dashboard (Nav / Feed / Insight Panel), reads the real feed via RLS |
| `app/profile/page.tsx` + `components/UsernameForm.tsx` | Profile page with the 14-day username-change cooldown wired to the API |
| `components/PostCard.tsx`, `NavSidebar.tsx`, `InsightPanel.tsx`, `ProfileFrame.tsx`, `TierBadge.tsx` | The Reddit-familiar feed layout restyled in Core's palette, tier-colored avatar frames reusing the logo's squircle shape |
| `public/manifest.json`, `public/sw.js`, `public/offline.html` | PWA shell — installable, cache-first for static assets, network-first-with-fallback for API reads, offline page for a fully dead connection |
| `lib/supabase/schema.sql` (gigs section) | `accept_gig` / `mark_gig_delivered` / `complete_gig` — the only three ways a gig's status can change, so `open → in_progress → delivered → completed` can't be skipped or forged from the client |
| `lib/payments/stripe.ts` | Payment provider isolated behind one file. Nothing is faked: `complete_gig` records the commission split immediately (source of truth for what's owed), but the actual transfer throws `stripe_connect_not_yet_implemented` until you add `STRIPE_SECRET_KEY` and finish this file |
| `app/api/gigs/*`, `app/marketplace/page.tsx`, `components/GigCard.tsx` | Post a gig, browse open gigs, apply (freelancers only, enforced server-side), deliver, and the client confirming completion |
| `lib/supabase/schema.sql` (`handle_new_auth_user` trigger) | Auto-creates a `profiles` row the moment Supabase Auth writes a new `auth.users` record — Google name/photo become the provisional username/avatar |
| `app/login/page.tsx` + `components/LoginClient.tsx` | Single "Continue with Google" screen |
| `app/auth/callback/route.ts` | Exchanges Google's auth code for a session, then routes new users to Core Initiation and returning users to the dashboard |
| `lib/supabase/client.ts` | Browser-only Supabase client, used solely for `signInWithOAuth`/`signOut` |
| `middleware.ts` | Now also refreshes the Supabase session on every request, so a Server Component never sees a stale/expired login |

## Why the reputation system works the way it does

Straight upvote-minus-downvote is easy to brigade with throwaway accounts.
So `vote_weight()` in the schema counts a vote from an **Observer**-tier
account (brand new, 0 reputation) at half weight — it still counts, new
voices aren't silenced, but it takes more of them to swing a score than one
established account. Tiers themselves are recomputed automatically every
time reputation changes (`apply_reputation_delta`), so there's no separate
"promote user" step to forget.

Moderation power (removing content, resolving reports) is restricted to
Architect and Grand Architect via `can_moderate()` — enforced by RLS on the
`reports` table, not just hidden in the UI. A Tier 2 user calling the API
directly still gets rejected by Postgres.

## Running it locally (once you're ready)

```bash
npm install
npx supabase init
npx supabase db push          # applies lib/supabase/schema.sql
cp .env.example .env.local     # fill in Supabase URL/anon key, AGENT_SHARED_SECRET
npm run dev
```

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (agents only, never exposed to the client),
`AGENT_SHARED_SECRET` (protects the two cron routes).

## Scaling to ~1,000 users

At this size you don't need anything exotic — the schema already does the
heavy lifting:

- **Indexes** on `posts(pillar, created_at)` and `posts(score)` keep the
  feed and "top" sort fast without a search service.
- **Vercel Cron's free tier is once-a-day**, not every 10/14 hours — for
  the real interval, either upgrade to Vercel Pro, or trigger the two
  routes from Supabase's own `pg_cron` (already enabled in the schema)
  calling `net.http_post` against your deployed URL. I'd default to
  `pg_cron` so the schedule lives next to the data it operates on.
- **Supabase's free/small paid tier** comfortably handles 1,000 users'
  worth of posts/votes; you won't hit read-replica territory until much
  higher traffic.
- The score/reputation triggers run per-vote, which is fine at this
  volume; if a single post ever gets thousands of votes at once, that's
  the point to move recomputation to a queued job instead of an inline
  trigger — not a concern yet.

## What's still open (next phase)

1. **Payment provider**: `lib/payments/stripe.ts` intentionally stops at a
   thrown error. Wiring up Stripe Connect (create connected accounts for
   freelancers, capture the client's charge, transfer gross-minus-commission)
   is the one piece of real external integration left, and it only touches
   that one file plus the `stripe_account_id` column already on `profiles`.
2. **Moderator classifier**: `scoreReportSeverity()` in the 10-hour agent is
   a placeholder heuristic — swap in a real model call once you have
   labeled examples of what "actioned" vs "clear" looked like historically.

Everything else — DB, reputation/tiers, RTL bilingual UI, onboarding,
dashboard, profile + username cooldown, both background agents, the
marketplace state machine, and Google sign-in — is real, working code in
this drop.

## Deploying — full walkthrough (works entirely from a phone browser)

You'll do this in three free accounts: **Supabase** (database + auth),
**Google Cloud** (OAuth credentials), and **Vercel** (hosting). No terminal
needed — every step below is a website form.

### 1. Supabase — database + auth

1. Go to supabase.com → sign up → **New project**. Pick any name/password/region.
2. Once it's ready, open **SQL Editor** (left sidebar) → **New query**.
3. Open `lib/supabase/schema.sql` from this zip, copy all of it, paste it
   into the SQL editor, and press **Run**. This creates every table, trigger,
   and security rule in one shot.
4. Go to **Authentication → Providers → Google**, toggle it on. You'll need
   a Client ID/Secret from Google — that's step 2 below; come back and paste
   them in here once you have them.
5. Still in Authentication, open **URL Configuration** and add your future
   Vercel URL (e.g. `https://core-yourname.vercel.app`) plus
   `https://core-yourname.vercel.app/auth/callback` to **Redirect URLs**
   (you'll get the exact URL after step 3 — you can come back and add it).
6. Go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key — you'll paste these into Vercel in step 3.

### 2. Google Cloud — OAuth credentials

1. Go to console.cloud.google.com → create a project (any name).
2. Go to **APIs & Services → OAuth consent screen** → set it up as
   "External", fill the required fields (app name, your email), save.
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth
   client ID** → Application type: **Web application**.
4. Under **Authorized redirect URIs**, add the callback URL Supabase shows
   you on its Google provider settings page (looks like
   `https://<your-project-ref>.supabase.co/auth/v1/callback`).
5. Copy the generated **Client ID** and **Client Secret** → paste both into
   Supabase's Google provider settings from step 1.4 → Save.

### 3. Vercel — hosting

1. Upload this project to a GitHub repo (GitHub's mobile site lets you
   create a repo and use "Add file → Upload files" to drag the extracted
   folder in — no git command line needed).
2. Go to vercel.com → sign up with GitHub → **Add New → Project** → pick
   the repo you just created → **Import**.
3. Before deploying, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → the Project URL from step 1.6
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → the anon key from step 1.6
   - `SUPABASE_SERVICE_ROLE_KEY` → from the same API settings page (the
     `service_role` key, further down — keep this one secret, it's server-only)
   - `AGENT_SHARED_SECRET` → make up any long random string
4. Click **Deploy**. Vercel gives you a live URL when it finishes.
5. Go back to Supabase's **URL Configuration** (step 1.5) and Google Cloud's
   **Authorized redirect URIs** (step 2.4) and make sure they both have your
   *actual* Vercel URL now, not a placeholder — this is the step people most
   often forget, and it's why "Sign in with Google" would otherwise bounce
   back with an error.

Open the Vercel URL on your phone's browser, sign in with Google, and
you're in Core Initiation. From there you can tap **Add to Home Screen**
in the browser menu to make it behave like an installed app (that's the
PWA manifest/service worker doing its job).

The two background agents (moderator, challenges) won't run on a
schedule yet — Vercel Cron's free tier only fires once a day. Either
upgrade to Vercel Pro for finer-grained cron, or trigger
`/api/agents/moderator` and `/api/agents/challenge` on a schedule via
Supabase's `pg_cron` (already enabled by the schema) calling `net.http_post`
against your deployed URL with the `x-agent-secret` header set to your
`AGENT_SHARED_SECRET`.
