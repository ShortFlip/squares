'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { playerColor, getInitials } from '@/lib/utils/player-color';

const SIZE_CLASSES = {
  xs:  'w-6  h-6  text-[10px]',
  sm:  'w-8  h-8  text-xs',
  md:  'w-10 h-10 text-sm',
  lg:  'w-14 h-14 text-base',
  xl:  'w-20 h-20 text-xl',
} as const;

interface PlayerAvatarProps {
  playerId: string;
  displayName: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  /** Override the derived initials — the game screen uses a single letter. */
  initials?: string;
  className?: string;
}

export function PlayerAvatar({
  playerId,
  displayName,
  avatarUrl,
  size = 'md',
  initials,
  className,
}: PlayerAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <div className={cn('rounded-full overflow-hidden shrink-0', sizeClass, className)}>
        <Image
          src={avatarUrl}
          alt={displayName}
          width={80}
          height={80}
          className="w-full h-full object-cover"
          unoptimized // Supabase Storage URLs are external; skip Next.js optimization
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shrink-0',
        sizeClass,
        className,
      )}
      style={{ background: playerColor(playerId) }}
    >
      {initials ?? getInitials(displayName)}
    </div>
  );
}
