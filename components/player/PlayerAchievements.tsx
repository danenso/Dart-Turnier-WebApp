'use client';

import { Achievement } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@iconify/react';
import { Medal } from 'lucide-react';

const TIER_STYLE: Record<string, string> = {
  bronze: 'border-amber-700/40 bg-amber-900/10 text-amber-600',
  silver: 'border-zinc-400/40 bg-zinc-400/10 text-zinc-400',
  gold: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  diamond: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-400',
};

const LOCKED_STYLE = 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/30 text-zinc-300 dark:text-zinc-600';

export function PlayerAchievements({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Medal className="w-4 h-4" />
          Achievements
          <span className="ml-auto text-sm font-normal text-zinc-400">{unlocked.length}/{achievements.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {[...unlocked, ...locked].map((a) => (
            <div
              key={a.id}
              title={`${a.name}: ${a.description}`}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                ${a.unlocked ? (TIER_STYLE[a.tier ?? 'bronze']) : LOCKED_STYLE}`}
            >
              <Icon icon={a.icon} className="w-7 h-7" />
              <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
                {a.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
