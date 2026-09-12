import { useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { sanitizeAvatarSrc } from '@/lib/safe-url';

function initials(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserAvatar({
  name,
  avatarUrl,
  label,
  className,
}: {
  name?: string;
  avatarUrl?: string | null;
  label: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const safeAvatar = sanitizeAvatarSrc(avatarUrl);
  const showPhoto = Boolean(safeAvatar) && !broken;

  return (
    <Link
      to="/settings"
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[color:var(--brand-well)] text-xs font-bold text-[color:var(--brand-hover)] ring-1 ring-[color:var(--border-default)]',
        className,
      )}
      title={name}
      aria-label={label}
    >
      {showPhoto ? (
        <img
          src={safeAvatar!}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </Link>
  );
}
