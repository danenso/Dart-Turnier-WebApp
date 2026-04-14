'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { useAppIcon } from '@/components/ThemeCustomizerProvider';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { SongPlayer } from '@/components/SongPlayer';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PlayersPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const getIcon = useAppIcon();
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = isAdmin
      ? query(collection(db, 'players'), where('ownerId', '==', user.uid))
      : query(collection(db, 'players'), where('authUid', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'de'));
        setPlayers(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'players'),
    );

    return () => unsubscribe();
  }, [user, isAuthReady, isAdmin]);

  if (!isAuthReady) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Spieler</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {players.length} {players.length === 1 ? 'Spieler' : 'Spieler'} registriert
            </p>
          </div>
        </div>

        {/* Grid */}
        {players.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map(player => (
              <div
                key={player.id}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 shrink-0">
                    {player.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <Icon icon={getIcon('account')} className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg leading-tight truncate">{player.name}</h3>
                    {player.nickname && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                        „{player.nickname}"
                      </p>
                    )}
                    {player.email && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{player.email}</p>
                    )}
                  </div>
                </div>

                {/* Song */}
                {player.songUrl && (
                  <div className="-mx-1">
                    <SongPlayer
                      playerId={player.id}
                      songUrl={player.songUrl}
                      songTitle={player.songTitle || 'Unbekannter Titel'}
                      songArtist={player.songArtist || ''}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <Link href={`/players/${player.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Icon icon={getIcon('standings')} className="w-4 h-4" />
                      Statistiken
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link href={`/players/${player.id}/edit`}>
                      <Button variant="ghost" size="icon" title="Spieler bearbeiten">
                        <Icon icon="mdi:pencil" className="w-4 h-4 text-zinc-500" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <Icon icon={getIcon('players')} className="w-14 h-14 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 font-medium">Noch keine Spieler vorhanden</p>
            <p className="text-zinc-400 text-sm mt-1">
              Erstelle ein Turnier und füge Spieler hinzu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
