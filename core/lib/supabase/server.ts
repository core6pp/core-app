import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-only Supabase client. Uses the request's auth cookie so RLS policies
 * apply as the real signed-in user — never the service-role key, which would
 * bypass RLS entirely and defeat the point of enforcing tier/reputation
 * writes at the database layer.
 */
export function createServerClient() {
  const cookieStore = cookies();

  return createSSRClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
}

/**
 * The ONLY place the service-role key is used: the two background agents
 * (cron jobs), which must act across all users' content, not as one user.
 * This client is never imported by anything reachable from a browser request.
 */
export function createAgentClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
