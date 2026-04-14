'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { slugify } from '@/lib/slugify';
import { fetchPlayerMatches, calculateStats, getAchievements, MatchStats, PlayerStats, GameType } from '@/lib/playerStats';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, Swords, Trophy } from 'lucide-react';
import { RecentGames } from '@/components/player/RecentGames';
import { PlayerAchievements } from '@/components/player/PlayerAchievements';
import { WinStatsSection } from '@/components/player/WinStatsSection';
import { ThrowStatsSection } from '@/components/player/ThrowStatsSection';
import { ScoreDistribution } from '@/components/player/ScoreDistribution';
import { HighScoresSection } from '@/components/player/HighScoresSection';
import { FieldStatsSection } from '@/components/player/FieldStatsSection';
import { CheckoutStatsSection } from '@/components/player/CheckoutStatsSection';

type FilterType = 'all' | GameType;

const FILTERS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
  { key: 'all',        label: 'Alle',    icon: <Trophy className="w-3.5 h-3.5" /> },
  { key: 'tournament', label: 'Turnier', icon: <Swords className="w-3.5 h-3.5" /> },
  { key: 'casual',     label: 'Casual',  icon: <Icon icon="mdi:controller" className="w-3.5 h-3.5" /> },
  { key: 'bot',        label: 'Bot',     icon: <Bot className="w-3.5 h-3.5" /> },
];

export default function PlayerStatsPage() {
  const { id: slug } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin } = useFirebase();
  const router = useRouter();

  const [playerProfile, setPlayerProfile] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [error, setError] = useState<string | null>(null);

  // Load player profile
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const q = isAdmin
      ? query(collection(db, 'players'), where('ownerId', '==', user.uid))
      : query(collection(db, 'players'), where('authUid', '==', user.uid));

    getDocs(q)
      .then((snap) => {
        const found = snap.docs.find(d => slugify(d.data().name) === slug);
        if (found) {
          setPlayerProfile({ id: found.id, ...found.data() });
          setPlayerId(found.id);
        } else {
          router.push('/players');
        }
      })
      .catch((err) => handleFirestoreError(err, OperationType.GET, `players/${slug}`))
      .finally(() => setLoading(false));
  }, [slug, user, isAuthReady, isAdmin, router]);

  // Load match stats
  useEffect(() => {
    if (!playerId) return;
    setStatsLoading(true);
    fetchPlayerMatches(playerId)
      .then(setMatches)
      .catch((err) => {
        console.error('Stats fetch error:', err);
        if (err?.message?.includes('index')) {
          setError('Firestore-Index fehlt. Bitte den Link in der Browser-Konsole öffnen, um den Index zu erstellen.');
        }
      })
      .finally(() => setStatsLoading(false));
  }, [playerId]);

  if (loading || !playerProfile) return <div className="p-8">Loading...</div>;

  const filteredMatches = filter === 'all' ? matches : matches.filter(m => m.gameType === filter);
  const stats: PlayerStats = calculateStats(filteredMatches);
  const achievements = getAchievements(calculateStats(matches), matches);

  return (
    <div className="page-pad">
      <div className="section-gap">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {playerProfile.nickname || playerProfile.name}
            </h1>
            {playerProfile.nickname && (
              <p className="text-zinc-500 text-sm">{playerProfile.name}</p>
            )}
          </div>
        </div>

        {/* Player card */}
        <div className="flex items-center gap-6 bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
            {playerProfile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={playerProfile.avatar} alt={playerProfile.name} className="w-full h-full object-cover" />
            ) : (
              <Icon icon="mdi:account" className="w-10 h-10 text-zinc-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold">{playerProfile.nickname || playerProfile.name}</h3>
            {playerProfile.email && <p className="text-sm text-zinc-400">{playerProfile.email}</p>}
          </div>
          <div className="hidden sm:grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-black text-green-500">{playerProfile.wins || 0}</p>
              <p className="text-xs text-zinc-400">Siege</p>
            </div>
            <div>
              <p className="text-2xl font-black">{playerProfile.matchesPlayed || 0}</p>
              <p className="text-xs text-zinc-400">Spiele</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-500">{playerProfile.losses || 0}</p>
              <p className="text-xs text-zinc-400">Niederlagen</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
            ⚠️ {error}
          </div>
        )}

        {/* Letzte Spiele + Achievements */}
        {!statsLoading && matches.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <RecentGames matches={matches} />
            <PlayerAchievements achievements={achievements} />
          </div>
        )}

        {/* Filter Tabs */}
        {matches.length > 0 && (
          <div>
            <div className="flex gap-2 flex-wrap mb-6">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border
                    ${filter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'}`}
                >
                  {f.icon}{f.label}
                  <span className="text-xs opacity-60">
                    ({f.key === 'all' ? matches.length : matches.filter(m => m.gameType === f.key).length})
                  </span>
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">Keine Spiele in dieser Kategorie.</p>
            ) : (
              <div className="space-y-4">
                <WinStatsSection stats={stats} />
                <ThrowStatsSection stats={stats} />
                <ScoreDistribution matches={filteredMatches} />
                <HighScoresSection stats={stats} />
                <CheckoutStatsSection stats={stats} />
                <FieldStatsSection stats={stats} />
              </div>
            )}
          </div>
        )}

        {statsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3 text-zinc-400">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Statistiken werden geladen...</p>
            </div>
          </div>
        )}

        {!statsLoading && matches.length === 0 && !error && (
          <div className="text-center py-12 text-zinc-400">
            <Icon icon="mdi:chart-line" className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Noch keine Spieldaten für detaillierte Statistiken.</p>
          </div>
        )}
      </div>
    </div>
  );
}
