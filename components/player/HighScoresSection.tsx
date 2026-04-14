'use client';

import { PlayerStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';

function HighCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 ${color}`}>
      <span className="text-3xl font-black">{value}</span>
      <span className="text-xs font-medium mt-1 text-center leading-tight">{label}</span>
    </div>
  );
}

export function HighScoresSection({ stats }: { stats: PlayerStats }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4" />High Scores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <HighCard
            value={stats.count60plus}
            label="60+"
            color="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
          />
          <HighCard
            value={stats.count100plus}
            label="100+"
            color="border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
          />
          <HighCard
            value={stats.count140plus}
            label="140+"
            color="border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
          />
          <HighCard
            value={stats.count180}
            label="180 🎯"
            color={`${stats.count180 > 0
              ? 'border-green-400 dark:border-green-600 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
              : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}
          />
        </div>
        {stats.count180 > 0 && (
          <p className="text-center text-xs text-green-500 mt-3 font-medium">
            🎯 {stats.count180}× Maximum Score!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
