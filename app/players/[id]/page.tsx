'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { slugify } from '@/lib/slugify';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PlayerStatsPage() {
  const { id: slug } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin } = useFirebase();
  const router = useRouter();
  const [playerProfile, setPlayerProfile] = useState<any>(null);

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
        } else {
          router.push('/players');
        }
      })
      .catch((error) => handleFirestoreError(error, OperationType.GET, `players/${slug}`));
  }, [slug, user, isAuthReady, isAdmin, router]);

  if (!isAuthReady || !playerProfile) return <div className="p-8">Loading...</div>;

  return (
    <div className="page-pad">
      <div className="section-gap">
        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
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

        <div className="space-y-6">
          <div className="flex items-center gap-6 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
            <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-4 border-white dark:border-zinc-900 shadow-sm shrink-0">
              {playerProfile.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={playerProfile.avatar} alt={playerProfile.name} className="w-full h-full object-cover" />
              ) : (
                <Icon icon="mdi:account" className="w-12 h-12 text-zinc-400" />
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold">
                {playerProfile.nickname || playerProfile.name}
              </h3>
              {playerProfile.nickname && (
                <p className="text-zinc-500">{playerProfile.name}</p>
              )}
              {playerProfile.email && (
                <p className="text-sm text-zinc-400 mt-1">{playerProfile.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Spiele</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{playerProfile.matchesPlayed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Siege</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{playerProfile.wins || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Unentschieden</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{playerProfile.draws || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Niederlagen</CardTitle>
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
