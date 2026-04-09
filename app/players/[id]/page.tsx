'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { doc, onSnapshot } from 'firebase/firestore';
import { User, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function PlayerStatsPage() {
  const { id } = useParams() as { id: string };
  const { user, isAuthReady } = useFirebase();
  const router = useRouter();
  const [playerProfile, setPlayerProfile] = useState<any>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'players', id), (docSnap) => {
      if (docSnap.exists()) {
        setPlayerProfile({ id: docSnap.id, ...docSnap.data() });
      } else {
        router.push('/players');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `players/${id}`));

    return () => unsubscribe();
  }, [id, user, isAuthReady, router]);

  if (!isAuthReady || !playerProfile) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Player Statistics</h1>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center gap-6 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-4 border-white dark:border-zinc-900 shadow-sm">
              {playerProfile.avatar ? (
                <img src={playerProfile.avatar} alt={playerProfile.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-zinc-400" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold">{playerProfile.name}</h3>
              {playerProfile.nickname && <p className="text-lg text-zinc-500">"{playerProfile.nickname}"</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Matches Played</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{playerProfile.matchesPlayed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Wins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{playerProfile.wins || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Draws</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{playerProfile.draws || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Losses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{playerProfile.losses || 0}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
