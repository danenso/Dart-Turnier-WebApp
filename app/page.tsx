'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function Home() {
  const { user, isAuthReady, signIn } = useFirebase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'tournaments'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const t = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by createdAt descending locally
      t.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setTournaments(t);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const createTournament = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        title: `Tournament ${new Date().toLocaleDateString()}`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        ownerId: user.uid
      });
      router.push(`/tournament/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tournaments');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-zinc-900 text-white rounded-full flex items-center justify-center mb-4">
              <Target size={24} />
            </div>
            <CardTitle className="text-2xl font-bold">Dart Tournament Manager</CardTitle>
            <CardDescription>Sign in to organize and manage your dart events.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={signIn} size="lg" className="w-full">Sign in with Google</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Tournaments</h1>
            <p className="text-zinc-500">Manage your dart events and track results.</p>
          </div>
          <Button onClick={createTournament} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'New Tournament'}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-zinc-400 transition-colors" onClick={() => router.push(`/tournament/${t.id}`)}>
              <CardHeader>
                <CardTitle className="text-lg">{t.title}</CardTitle>
                <CardDescription>
                  {new Date(t.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-zinc-100 text-zinc-900">
                  {t.status.toUpperCase()}
                </div>
              </CardContent>
            </Card>
          ))}
          {tournaments.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
              <p className="text-zinc-500">No tournaments yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
