'use client';

import { useState, useRef, useEffect } from 'react';

type PostMenuProps = {
  postId: string;
  postUrl: string;
  postText: string;
  locale: 'ar' | 'en';
  onSave?: () => void;
  onHide?: () => void;
  onReport?: () => void;
  onBlockAuthor?: () => void;
};

const COPY = {
  ar: {
    share: 'مشاركة',
    follow: 'متابعة المنشور',
    save: 'حفظ',
    saved: 'محفوظ',
    block: 'حظر الحساب',
    report: 'إبلاغ',
    hide: 'إخفاء',
    copy: 'نسخ النص',
    copied: 'تم النسخ',
  },
  en: {
    share: 'Share',
    follow: 'Follow post',
    save: 'Save',
    saved: 'Saved',
    block: 'Block account',
    report: 'Report',
    hide: 'Hide',
    copy: 'Copy text',
    copied: 'Copied',
  },
} as const;

/**
 * Deliberately mirrors Reddit's own post-options sheet (Share / Follow /
 * Save / Block / Report / Hide / Copy text) since that's a well-worn,
 * familiar pattern for this exact list of actions — reinventing it would
 * only make the app harder to use, not more original. Colors and iconography
 * still follow Core's own tokens, not Reddit's.
 */
export function PostMenu({ postId, postUrl, postText, locale, onSave, onHide, onReport, onBlockAuthor }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = COPY[locale];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: postUrl });
      } catch {
        /* user cancelled — no-op */
      }
    } else {
      await navigator.clipboard.writeText(postUrl);
    }
    setOpen(false);
  }

  async function handleCopyText() {
    await navigator.clipboard.writeText(postText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={locale === 'ar' ? 'خيارات المنشور' : 'Post options'}
        className="h-7 w-7 rounded-md flex items-center justify-center text-ink-muted hover:bg-bg-raised hover:text-ink-primary transition-colors"
      >
        <DotsIcon />
      </button>

      {open && (
        <div
          className="absolute end-0 z-20 mt-1 w-56 rounded-lg border border-bg-border bg-bg-raised py-1 shadow-lg"
          role="menu"
        >
          <MenuItem icon={<ShareIcon />} label={t.share} onClick={handleShare} />
          <MenuItem
            icon={<BellIcon />}
            label={t.follow}
            active={following}
            onClick={() => {
              setFollowing((v) => !v);
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<BookmarkIcon filled={saved} />}
            label={saved ? t.saved : t.save}
            active={saved}
            onClick={() => {
              setSaved((v) => !v);
              onSave?.();
              setOpen(false);
            }}
          />
          <div className="my-1 h-px bg-bg-border" />
          <MenuItem
            icon={<CopyIcon />}
            label={copied ? t.copied : t.copy}
            onClick={handleCopyText}
          />
          <MenuItem
            icon={<EyeOffIcon />}
            label={t.hide}
            onClick={() => {
              onHide?.();
              setOpen(false);
            }}
          />
          <div className="my-1 h-px bg-bg-border" />
          <MenuItem
            icon={<BlockIcon />}
            label={t.block}
            danger
            onClick={() => {
              onBlockAuthor?.();
              setOpen(false);
            }}
          />
          <MenuItem
            icon={<FlagIcon />}
            label={t.report}
            danger
            onClick={() => {
              onReport?.();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  active,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 px-3 py-2 text-sm text-start transition-colors hover:bg-bg-surface',
        danger ? 'text-signal-danger' : active ? 'text-amber-core' : 'text-ink-primary',
      ].join(' ')}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

/* Minimal inline icon set — no external icon package dependency for a handful of glyphs */
function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="4" r="1.6" />
      <circle cx="10" cy="10" r="1.6" />
      <circle cx="10" cy="16" r="1.6" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="15" cy="4.5" r="2" />
      <circle cx="5" cy="10" r="2" />
      <circle cx="15" cy="15.5" r="2" />
      <path d="M6.7 8.9L13.3 5.6M6.7 11.1L13.3 14.4" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 8a5 5 0 0110 0c0 3.5 1.2 4.5 1.2 4.5H3.8S5 11.5 5 8z" />
      <path d="M8.3 15.5a1.7 1.7 0 003.4 0" />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
      <path d="M5 3.5h10v13l-5-3.2-5 3.2v-13z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="7" y="7" width="9" height="9" rx="1.5" />
      <path d="M4 13V4.5A1.5 1.5 0 015.5 3H13" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 3l14 14M8.6 8.6a2 2 0 002.8 2.8M6 6.3C4 7.6 2.5 10 2.5 10s3 5.5 7.5 5.5c1.3 0 2.5-.4 3.6-1M12 4.7c3.7.6 5.9 5.3 5.9 5.3s-.6 1.1-1.7 2.3" />
    </svg>
  );
}
function BlockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" />
      <path d="M5.5 5.5l9 9" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 3v14M5 3.5h9l-2.5 3.5L14 10.5H5" />
    </svg>
  );
}
