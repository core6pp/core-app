import { tiers } from '@/lib/design-tokens';

type TierKey = (typeof tiers)[number]['key'];

/**
 * Reuses the logo's squircle silhouette as the avatar frame, recolored to
 * the user's tier — so the same shape language means "Core" on the header
 * and "this person's standing" on every avatar, instead of two unrelated
 * visual systems.
 */
export function ProfileFrame({
  avatarUrl,
  tier,
  size = 48,
}: {
  avatarUrl: string;
  tier: TierKey;
  size?: number;
}) {
  const color = tiers.find((t) => t.key === tier)?.color ?? tiers[0]!.color;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
        <path
          d="M32 2C52 2 62 12 62 32C62 52 52 62 32 62C12 62 2 52 2 32C2 12 12 2 32 2Z"
          fill="none"
          stroke={color}
          strokeWidth="3"
        />
      </svg>
      <img
        src={avatarUrl}
        alt=""
        className="absolute rounded-[28%] object-cover"
        style={{ inset: size * 0.1, width: size * 0.8, height: size * 0.8 }}
      />
    </div>
  );
}
