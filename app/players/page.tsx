'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { SongPlayer } from '@/components/SongPlayer';
import { Edit2, User, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PlayersPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = isAdmin 
      ? query(collection(db, 'players'), where('ownerId', '==', user.uid))
      : query(collection(db, 'players'), where('authUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `players`));

    return () => unsubscribe();
  }, [user, isAuthReady, isAdmin]);

  if (!isAuthReady) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        <p className="text-zinc-500">Manage players, view statistics, and edit profiles.</p>
        
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {players.map(player => (
              <div key={player.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                      {player.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.avatar}
                          alt={player.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <User className="w-6 h-6 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg leading-tight">{player.name}</h3>
                      {player.nickname && <p className="text-sm text-zinc-500">&quot;{player.nickname}&quot;</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/players/${player.id}`}>
                      <Button variant="ghost" size="icon" title="View Statistics">
                        <BarChart2 className="w-5 h-5 text-zinc-600" />
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Link href={`/players/${player.id}/edit`}>
                        <Button variant="ghost" size="icon" title="Edit Player">
                          <Edit2 className="w-5 h-5 text-zinc-600" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {player.songUrl && (
                  <div className="mt-3">
                    <SongPlayer
                      playerId={player.id}
                      songUrl={player.songUrl}
                      songTitle={player.songTitle || 'Unbekannter Titel'}
                      songArtist={player.songArtist || ''}
                    />
                  </div>
                )}
              </div>
            ))}
            
            {players.length === 0 && (
              <div className="p-12 text-center text-zinc-500">
                No players found. Create a tournament and add players to see them here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
