/**
 * CORE — Design tokens
 * ------------------------------------------------------------------
 * Deep Space Gray is not "black with a filter" — it's a cool graphite that
 * keeps enough value separation between background/card/border to read as
 * layered, not flat. Amber marks status and merit (badges, tier, upvotes).
 * Electric Indigo marks *interaction* (icons, glow, focus, downvotes) —
 * the two never mix on the same element, so a glance tells you whether
 * something is "earned" (amber) or "actionable" (indigo).
 */

export const colors = {
  bg: {
    base: '#0A0C10',      // app shell
    surface: '#12151C',   // cards, panels
    raised: '#191D26',    // popovers, modals
    border: '#242938',
  },
  ink: {
    primary: '#E8EAF0',
    secondary: '#9AA1B2',
    muted: '#5C6178',
  },
  amber: {
    core: '#F0913D',      // badges, tier marks, upvote — warmer, closer to orange per feedback
    dim: '#9A5A1F',
    glow: 'rgba(240, 145, 61, 0.35)',
  },
  indigo: {
    core: '#5B4FE0',      // icons, links, downvote, focus rings
    dim: '#39307D',
    glow: 'rgba(91, 79, 224, 0.35)',
  },
  signal: {
    danger: '#D4574B',    // removals, strikes — deliberately NOT reused elsewhere
  },
} as const;

export const tiers = [
  { key: 'observer',        nameEn: 'Observer',        nameAr: 'مراقب',        min: 0,    color: colors.ink.muted },
  { key: 'participant',     nameEn: 'Participant',     nameAr: 'مشارك',        min: 50,   color: colors.ink.secondary },
  { key: 'consultant',      nameEn: 'Consultant',      nameAr: 'مستشار',       min: 400,  color: colors.indigo.core },
  { key: 'architect',       nameEn: 'Architect',       nameAr: 'معماري',       min: 1500, color: colors.amber.core },
  { key: 'grand_architect', nameEn: 'Grand Architect', nameAr: 'المعماري الأكبر', min: 5000, color: '#F2C879' },
] as const;

export const typography = {
  display: "'Space Grotesk', 'IBM Plex Sans Arabic', sans-serif", // headings, tier names, the logotype
  body: "'Inter', 'IBM Plex Sans Arabic', sans-serif",             // posts, comments, UI copy
  mono: "'JetBrains Mono', monospace",                             // scores, timers, ids — never localized
} as const;

export const pillars = {
  workshop: { color: colors.indigo.core, icon: 'wrench' },
  lounge:   { color: colors.amber.core,  icon: 'gamepad-2' },
  nomad:    { color: '#4FAE8C',          icon: 'compass' }, // third pillar gets its own quiet accent, not amber/indigo, so the three read as distinct
} as const;
