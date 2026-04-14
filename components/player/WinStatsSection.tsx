'use client';

import { PlayerStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

function RingChart({ value, size = 80, stroke = 8, color = '#22c55e' }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * value;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={stroke}
        className="text-zinc-200 dark:text-zinc-700" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-2xl font-bold ${color ?? 'text-zinc-900 dark:text-zinc-50'}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-400">{sub}</span>}
    </div>
  );
}

export function WinStatsSection({ stats }: { stats: PlayerStats }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="space-y-4">
      {/* Sieg-Übersicht */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4" />Sieg-Statistiken</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <RingChart value={stats.winRate} color="#22c55e" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{pct(stats.winRate)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              <StatCard label="Gespielt" value={stats.gamesPlayed} />
              <StatCard label="Siege" value={stats.wins} color="text-green-500" sub={pct(stats.winRate)} />
              <StatCard label="Niederlagen" value={stats.losses} color="text-red-500" sub={pct(stats.losses / Math.max(stats.gamesPlayed, 1))} />
              <StatCard label="Unentschieden" value={stats.draws} color="text-amber-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leg-Statistiken */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Set/Leg-Statistiken</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <RingChart value={stats.legWinRate} color="#3b82f6" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold">{pct(stats.legWinRate)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 flex-1">
              <StatCard label="Legs gespielt" value={stats.legsPlayed} />
              <StatCard label="Legs gewonnen" value={stats.legsWon} color="text-blue-500" />
              <StatCard label="Legs verloren" value={stats.legsLost} color="text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
