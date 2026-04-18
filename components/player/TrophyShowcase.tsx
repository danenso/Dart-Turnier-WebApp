'use client';

import { EarnedAchievement, LEAGUE_ACHIEVEMENTS, LeagueAchievementDef } from '@/lib/achievementEngine';
import { Icon } from '@iconify/react';

// ─── Styling ─────────────────────────────────────────────────

const TIER_BG: Record<string, string> = {
  gold:    'from-yellow-500/20 to-yellow-600/5 border-yellow-500/30',
  silver:  'from-zinc-400/20 to-zinc-500/5 border-zinc-400/30',
  bronze:  'from-amber-700/20 to-amber-800/5 border-amber-700/30',
  special: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
};

const TIER_ICON_COLOR: Record<string, string> = {
  gold:    'text-yellow-500',
  silver:  'text-zinc-400',
  bronze:  'text-amber-600',
  special: 'text-purple-400',
};

// ─── Trophy Item ─────────────────────────────────────────────

function TrophyItem({ earned, def }: { earned: EarnedAchievement; def: LeagueAchievementDef }) {
  const date = earned.earnedAt
    ? new Date(earned.earnedAt).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
    : null;

  let contextLabel = '';
  if (earned.context.tournamentTitle) {
    contextLabel = earned.context.tournamentNumber
      ? `Spieltag #${earned.context.tournamentNumber}`
      : earned.context.tournamentTitle;
  } else if (earned.context.seasonName) {
    contextLabel = earned.context.seasonName;
  } else if (earned.context.placement) {
    contextLabel = `Platz ${earned.context.placement}`;
  }

  return (
    <div
      title={`${def.name}: ${def.description}${date ? ` · ${date}` : ''}`}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-gradient-to-b transition-transform hover:scale-105 ${TIER_BG[def.tier]}`}
    >
      <Icon icon={def.icon} className={`w-8 h-8 ${TIER_ICON_COLOR[def.tier]}`} />
      <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2">
        {def.name}
      </span>
      {contextLabel && (
        <span className="text-[9px] opacity-60 text-center leading-tight">{contextLabel}</span>
      )}
      {date && (
        <span className="text-[9px] opacity-40">{date}</span>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function TrophyShowcase({ achievements }: { achievements: EarnedAchievement[] }) {
  if (achievements.length === 0) return null;

  // Sort: gold/special first, then silver, then bronze, then by date (newest first)
  const tierOrder: Record<string, number> = { gold: 0, special: 0, silver: 1, bronze: 2 };
  const sorted = [...achievements]
    .map((a) => ({ earned: a, def: LEAGUE_ACHIEVEMENTS.find((d) => d.id === a.id) }))
    .filter((item): item is { earned: EarnedAchievement; def: LeagueAchievementDef } => !!item.def)
    .sort((a, b) => {
      const tierDiff = (tierOrder[a.def.tier] ?? 3) - (tierOrder[b.def.tier] ?? 3);
      if (tierDiff !== 0) return tierDiff;
      return (b.earned.earnedAt ?? '').localeCompare(a.earned.earnedAt ?? '');
    });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
      <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon icon="mdi:trophy-variant" className="w-4 h-4" />
        Trophäen-Vitrine
        <span className="ml-auto text-xs font-normal normal-case text-zinc-400">
          {sorted.length} verdient
        </span>
      </h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {sorted.map((item, i) => (
          <TrophyItem key={`${item.earned.id}-${i}`} earned={item.earned} def={item.def} />
        ))}
      </div>
    </div>
  );
}
