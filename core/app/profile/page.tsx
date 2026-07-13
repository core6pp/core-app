import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { NavSidebar } from '@/components/NavSidebar';
import { ProfileFrame } from '@/components/ProfileFrame';
import { TierBadge } from '@/components/TierBadge';
import { UsernameForm } from '@/components/UsernameForm';
import { SignOutButton } from '@/components/SignOutButton';
import type { Locale } from '@/lib/i18n';

export default async function ProfilePage() {
  const locale = (headers().get('x-core-locale') as Locale) ?? 'ar';
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, tier, reputation_score, username_changed_at, is_freelancer')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/onboarding');

  const nextAllowedAt = new Date(new Date(profile.username_changed_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="flex min-h-screen">
      <NavSidebar locale={locale} />
      <main className="flex-1 space-y-6 p-6">
        <div className="flex items-center gap-4">
          <ProfileFrame avatarUrl={profile.avatar_url ?? '/default-avatar.png'} tier={profile.tier} size={72} />
          <div>
            <h1 className="font-display text-xl font-semibold text-ink-primary">
              {profile.display_name ?? profile.username}
            </h1>
            <p className="text-sm text-ink-secondary">@{profile.username}</p>
            <div className="mt-2 flex items-center gap-2">
              <TierBadge tier={profile.tier} locale={locale} />
              <span className="font-mono text-xs text-ink-muted">{profile.reputation_score} pts</span>
            </div>
          </div>
        </div>

        <div className="border-t border-bg-border pt-6">
          <UsernameForm locale={locale} currentUsername={profile.username} nextAllowedAt={nextAllowedAt} />
        </div>

        <SignOutButton locale={locale} />
      </main>
    </div>
  );
}
