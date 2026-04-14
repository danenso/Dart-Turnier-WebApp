'use client';

import { MatchStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  bot: 'Bot',
  casual: 'Casual',
  tournament: 'Turnier',
};

const TYPE_COLOR: Record<string, string> = {
  bot: 'text-purple-500 bg-purple-500/10',
  casual: 'text-blue-500 bg-blue-500/10',
  tournament: 'text-amber-500 bg-amber-500/10',
};

export function RecentGames({ matches }: { matches: MatchStats[] }) {
  const recent = matches.slice(0, 20);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="w-4 h-4" />
          Letzte {recent.length} Spiele
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Visual W/L strip */}
        <div className="flex gap-1 flex-wrap mb-4">
          {recent.map((m, i) => (
            <div
              key={m.matchId}
              title={`${m.result === 'win' ? 'Sieg' : m.result === 'loss' ? 'Niederlage' : 'Unentschieden'} vs ${m.opponentName}`}
              className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold
                ${m.result === 'win' ? 'bg-green-500 text-white' : m.result === 'loss' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}
            >
              {m.result === 'win' ? 'S' : m.result === 'loss' ? 'N' : 'U'}
            </div>
          ))}
        </div>

        {/* Match list */}
        <div className="space-y-1.5">
          {recent.map((m) => (
            <div
              key={m.matchId}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[m.gameType]}`}>
                  {TYPE_LABEL[m.gameType]}
                </span>
                <span className="truncate text-zinc-700 dark:text-zinc-300">vs {m.opponentName}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-zinc-400 text-xs">{m.legsWon}:{m.legsLost}</span>
                <span className={`font-bold text-xs w-5 text-center
                  ${m.result === 'win' ? 'text-green-500' : m.result === 'loss' ? 'text-red-500' : 'text-amber-500'}`}>
                  {m.result === 'win' ? 'S' : m.result === 'loss' ? 'N' : 'U'}
                </span>
              </div>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-4">Noch keine Spiele.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
