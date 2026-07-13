/**
 * The Core mark: a hollow squircle ring (Electric Indigo) with a smaller
 * solid squircle "core" (Amber) centered inside it — the two brand colors
 * never touching except here, which is the point. It doubles as:
 *   - the app logo (static)
 *   - the vote-count halo when a post crosses a score threshold (pulse=true)
 *   - a loading indicator (spin=true)
 * This is the ONE animated signature element in the product — everywhere
 * else motion is restrained on purpose.
 */
type LogoProps = {
  size?: number;
  pulse?: boolean;
  spin?: boolean;
  className?: string;
};

export function Logo({ size = 40, pulse = false, spin = false, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={[spin ? 'animate-spin' : '', className].join(' ')}
      aria-label="Core"
      role="img"
    >
      {/* outer hollow squircle — Electric Indigo */}
      <path
        d="M32 4C50 4 60 14 60 32C60 50 50 60 32 60C14 60 4 50 4 32C4 14 14 4 32 4Z"
        fill="none"
        stroke="#5B4FE0"
        strokeWidth="5"
      />
      {/* inner solid squircle "core" — Amber, pulses to signal rising merit */}
      <path
        d="M32 22C39 22 42 25 42 32C42 39 39 42 32 42C25 42 22 39 22 32C22 25 25 22 32 22Z"
        fill="#E8A33D"
        className={pulse ? 'animate-core-pulse' : ''}
      />
    </svg>
  );
}
