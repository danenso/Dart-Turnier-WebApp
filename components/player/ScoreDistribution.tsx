'use client';

import { MatchStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const BUCKETS = [
  { label: '0–39',   min: 0,   max: 39,  color: 'bg-zinc-400' },
  { label: '40–59',  min: 40,  max: 59,  color: 'bg-blue-400' },
  { label: '60–99',  min: 60,  max: 99,  color: 'bg-indigo-500' },
  { label: '100–139',min: 100, max: 139, color: 'bg-violet-500' },
  { label: '140–179',min: 140, max: 179, color: 'bg-amber-500' },
  { label: '180',    min: 180, max: 180, color: 'bg-green-500' },
];

export function ScoreDistribution({ matches }: { matches: MatchStats[] }) {
  const allTurns = matches.flatMap(m => m.playerTurns).filter(t => !t.isBust);

  const counts = BUCKETS.map(b => ({
    ...b,
    count: allTurns.filter(t => t.totalScored >= b.min && t.totalScored <= b.max).length,
  }));

  const max = Math.max(...counts.map(c => c.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />Score-Verteilung (pro Runde)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {counts.map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-16 shrink-0">{label}</span>
              <div className="flex-1 h-6 bg-zinc-100 dark:bg-zinc-800 rounded">
                <div
                  className={`h-full rounded ${color} transition-all`}
                  style={{ width: `${(count / max) * 100}%`, minWidth: count > 0 ? 4 : 0 }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right text-zinc-500">{count}×</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-3 text-center">
          {allTurns.length} gewertete Runden (ohne Busts)
        </p>
      </CardContent>
    </Card>
  );
}
