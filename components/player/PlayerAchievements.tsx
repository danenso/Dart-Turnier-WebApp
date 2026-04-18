'use client';

import { useState } from 'react';
import { Achievement, EarnedAchievement, LEAGUE_ACHIEVEMENTS } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@iconify/react';
import { Medal } from 'lucide-react';

// ─── Styling ─────────────────────────────────────────────────

const TIER_STYLE: Record<string, string> = {
  bronze:  'border-amber-700/40 bg-amber-900/10 text-amber-600',
  silver:  'border-zinc-400/40 bg-zinc-400/10 text-zinc-400',
  gold:    'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  diamond: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-400',
  special: 'border-purple-400/40 bg-purple-500/10 text-purple-400',
};

const LOCKED_STYLE =
  'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/30 text-zinc-300 dark:text-zinc-600';

// ─── Game-stats tile ────────────────────────────────────────

function GameAchievementTile({ a }: { a: Achievement }) {
  return (
    <div
      title={`${a.name}: ${a.description}`}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
        ${a.unlocked ? (TIER_STYLE[a.tier ?? 'bronze']) : LOCKED_STYLE}`}
    >
      <Icon icon={a.icon} className="w-7 h-7" />
      <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
        {a.name}
      </span>
    </div>
  );
}

// ─── League achievement tile ─────────────────────────────────

function LeagueAchievementTile({ a }: { a: EarnedAchievement }) {
  const def = LEAGUE_ACHIEVEMENTS.find((d) => d.id === a.id);
  if (!def) return null;

  const date = a.earnedAt
    ? new Date(a.earnedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  let contextLabel = '';
  if (a.context.tournamentNumber) contextLabel = `Spieltag #${a.context.tournamentNumber}`;
  else if (a.context.placement) contextLabel = `Platz ${a.context.placement}`;
  else if (a.context.rank) contextLabel = `Rang ${a.context.rank}`;

  return (
    <div
      title={`${def.name}: ${def.description}${date ? ` (${date})` : ''}`}
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${TIER_STYLE[def.tier]}`}
    >
      <Icon icon={def.icon} className="w-7 h-7" />
      <span className="text-[10px] font-medium text-center leading-tight line-clamp-2">
        {def.name}
      </span>
      {contextLabel && (
        <span className="text-[9px] opacity-60 text-center leading-tight">{contextLabel}</span>
      )}
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all border
        ${active
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
          : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
        }`}
    >
      {children}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────

interface Props {
  achievements: Achievement[];
  leagueAchievements?: EarnedAchievement[];
}

export function PlayerAchievements({ achievements, leagueAchievements = [] }: Props) {
  const [tab, setTab] = useState<'all' | 'game' | 'league'>('all');

  const unlockedGame = achievements.filter((a) => a.unlocked);
  const lockedGame   = achievements.filter((a) => !a.unlocked);

  const totalAll = achievements.length + leagueAchievements.length;
  const totalUnlocked = unlockedGame.length + leagueAchievements.length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Medal className="w-4 h-4" />
          Achievements
          <span className="ml-auto text-sm font-normal text-zinc-400">
            {totalUnlocked}/{totalAll}
          </span>
        </CardTitle>

        {/* Tabs */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            Alle
          </TabBtn>
          <TabBtn active={tab === 'game'} onClick={() => setTab('game')}>
            Game Stats ({unlockedGame.length}/{achievements.length})
          </TabBtn>
          {leagueAchievements.length > 0 && (
            <TabBtn active={tab === 'league'} onClick={() => setTab('league')}>
              Liga ({leagueAchievements.length})
            </TabBtn>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {/* All Tab */}
          {tab === 'all' && (
            <>
              {leagueAchievements.map((a, i) => (
                <LeagueAchievementTile key={`league-${a.id}-${i}`} a={a} />
              ))}
              {[...unlockedGame, ...lockedGame].map((a) => (
                <GameAchievementTile key={a.id} a={a} />
              ))}
            </>
          )}

          {/* Game Stats Tab */}
          {tab === 'game' && (
            <>
              {[...unlockedGame, ...lockedGame].map((a) => (
                <GameAchievementTile key={a.id} a={a} />
              ))}
            </>
          )}

          {/* League Tab */}
          {tab === 'league' && (
            <>
              {leagueAchievements.length === 0 ? (
                <p className="col-span-full text-sm text-zinc-400 text-center py-4">
                  Noch keine Liga-Achievements.
                </p>
              ) : (
                leagueAchievements.map((a, i) => (
                  <LeagueAchievementTile key={`${a.id}-${i}`} a={a} />
                ))
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
