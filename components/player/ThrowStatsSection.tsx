'use client';

import { PlayerStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crosshair } from 'lucide-react';

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-primary' : 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </span>
    </div>
  );
}

function DartBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="font-medium">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(pct * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function ThrowStatsSection({ stats }: { stats: PlayerStats }) {
  const maxDart = Math.max(stats.dart1Avg, stats.dart2Avg, stats.dart3Avg, 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crosshair className="w-4 h-4" />Wurf-Statistiken
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Darts geworfen" value={stats.dartsThrown.toLocaleString()} />
          <Row label="3-Dart-Average" value={stats.avg3.toFixed(1)} highlight />
          <Row label="First-9-Average" value={stats.first9Avg.toFixed(1)} highlight />
          <Row label="Höchste Runde" value={stats.highestRound} />
          <Row label="Bester Leg (Darts)" value={stats.bestLegDarts > 0 ? `${stats.bestLegDarts} Darts` : '—'} />
          <Row label="Gesamt erzielte Punkte" value={stats.totalScored.toLocaleString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dart 1 / 2 / 3 Average</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DartBar label="Dart 1" value={stats.dart1Avg} max={60} />
          <DartBar label="Dart 2" value={stats.dart2Avg} max={60} />
          <DartBar label="Dart 3" value={stats.dart3Avg} max={60} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Trefferrate</CardTitle>
        </CardHeader>
        <CardContent>
          {[
            { label: '20-Rate', value: stats.rate20 },
            { label: '20/19-Rate', value: stats.rate20or19 },
            { label: 'Triple-Rate', value: stats.rateTriple },
            { label: '60+ Rundenrate', value: stats.rateTurn60 },
            { label: '57+ Rundenrate', value: stats.rateTurn57 },
          ].map(({ label, value }) => (
            <div key={label} className="py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-zinc-500">{label}</span>
                <span className="font-semibold">{Math.round(value * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(value * 100, 100)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
