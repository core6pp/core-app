import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-only client. Used exclusively to kick off `signInWithOAuth` and
 * `signOut` from Client Components — never to read/write app data (posts,
 * votes, profiles), which all go through the server routes so RLS + the
 * server-side Supabase client in lib/supabase/server.ts stay the single path
 * for anything that matters.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
