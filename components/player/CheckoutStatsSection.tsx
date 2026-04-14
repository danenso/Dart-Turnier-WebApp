'use client';

import { PlayerStats } from '@/lib/playerStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function CheckoutStatsSection({ stats }: { stats: PlayerStats }) {
  const pct = Math.round(stats.checkoutRate * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />Checkout-Statistiken
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Checkout Rate Visual */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
          <div className="relative w-16 h-16 shrink-0">
            <svg width="64" height="64" className="-rotate-90">
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="8"
                className="text-zinc-200 dark:text-zinc-700" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#22c55e" strokeWidth="8"
                strokeDasharray={`${(pct / 100) * 163} 163`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold">{pct}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-zinc-500">Checkout-Rate</p>
            <p className="text-xs text-zinc-400 mt-1">
              {stats.checkoutsHit} von {stats.checkoutAttempts} Versuchen
            </p>
          </div>
        </div>

        <StatRow label="Höchster Checkout" value={stats.highestCheckout > 0 ? `${stats.highestCheckout}` : '—'} />
        <StatRow label="Bester Checkout (Darts)" value={stats.bestCheckoutDarts > 0 ? `${stats.bestCheckoutDarts} Darts` : '—'} />
        <StatRow label="Checkout-Versuche" value={stats.checkoutAttempts} />
        <StatRow label="Erfolgreiche Checkouts" value={stats.checkoutsHit} />
      </CardContent>
    </Card>
  );
}
