'use client';

import { PlayerStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Grid2x2 } from 'lucide-react';

function FieldBar({ num, rate, isHot }: { num: number | string; rate: number; isHot: boolean }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-6 text-right shrink-0 ${isHot ? 'text-primary font-bold' : 'text-zinc-500'}`}>
        {num}
      </span>
      <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHot ? 'bg-primary' : 'bg-zinc-400 dark:bg-zinc-600'}`}
          style={{ width: `${Math.min(pct * 5, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

export function FieldStatsSection({ stats }: { stats: PlayerStats }) {
  const maxRate = Math.max(...Object.values(stats.fieldRates), 0.001);
  const bustPct = Math.round(stats.bustRate * 100);

  const sortedFields = Array.from({ length: 20 }, (_, i) => i + 1)
    .map(n => ({ num: n, rate: stats.fieldRates[n] ?? 0 }))
    .sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Grid2x2 className="w-4 h-4" />Feld-Statistiken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
            <div>
              <p className="text-xs text-zinc-500">Bust-Rate</p>
              <p className={`text-2xl font-bold ${bustPct > 10 ? 'text-red-500' : 'text-green-500'}`}>{bustPct}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Bull-Rate</p>
              <p className="text-2xl font-bold text-amber-500">{Math.round((stats.fieldRates[25] ?? 0) * 100)}%</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Lieblingsfeld</p>
              <p className="text-2xl font-bold text-primary">
                {sortedFields[0]?.rate > 0 ? sortedFields[0].num : '—'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <FieldBar
                key={n}
                num={n}
                rate={stats.fieldRates[n] ?? 0}
                isHot={(stats.fieldRates[n] ?? 0) === maxRate}
              />
            ))}
            <FieldBar num="Bull" rate={stats.fieldRates[25] ?? 0} isHot={false} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
