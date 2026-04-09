'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db, secondaryAuth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PlayerEditPage() {
  const { id } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin } = useFirebase();
  const router = useRouter();

  const [player, setPlayer] = useState<any>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    if (!isAdmin) {
      router.push('/players');
      return;
    }

    const fetchPlayer = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'players', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlayer({ id: docSnap.id, ...data });
          setName(data.name || '');
          setNickname(data.nickname || '');
          setEmail(data.email || '');
          setAvatar(data.avatar || '');
        } else {
          router.push('/players');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `players/${id}`);
      }
    };

    fetchPlayer();
  }, [id, user, isAuthReady, isAdmin, router]);

  const handleSave = async () => {
    if (!player) return;
    setIsSaving(true);

    try {
      let authUid = player.authUid;

      // If email and password are provided and no authUid exists, create a user
      if (email && password && !authUid && isAdmin) {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        authUid = userCredential.user.uid;
      }

      const updates: any = {
        name,
        nickname,
        avatar,
      };

      if (email) updates.email = email;
      if (authUid) updates.authUid = authUid;

      await updateDoc(doc(db, 'players', player.id), updates);
      router.push('/players');
    } catch (error) {
      console.error("Error updating player:", error);
      alert("Failed to update player. " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthReady || !player) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/players">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Edit Player</h1>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. The Power" />
            </div>
            <div className="space-y-2">
              <Label>Avatar URL (Base64 or Image Link)</Label>
              <Input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." />
            </div>
            
            {isAdmin && (
              <div className="pt-6 mt-6 border-t border-zinc-200">
                <h4 className="font-medium mb-4">Login Credentials</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!player?.authUid} />
                  </div>
                  {!player?.authUid && (
                    <div className="space-y-2">
                      <Label>Password (for initial setup)</Label>
                      <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  )}
                  {player?.authUid && (
                    <p className="text-sm text-green-600">✓ Login configured</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Link href="/players">
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
