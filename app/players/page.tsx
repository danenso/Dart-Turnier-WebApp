'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { secondaryAuth } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Edit2, User } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PlayersPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const [players, setPlayers] = useState<any[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    if (!isAuthReady || !user) return;

    // If admin, they can see all players they own.
    // If not admin, they can only see themselves? Wait, players are created by the admin.
    // Let's assume this page is mostly for the admin to manage players.
    const q = isAdmin 
      ? query(collection(db, 'players'), where('ownerId', '==', user.uid))
      : query(collection(db, 'players'), where('authUid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `players`));

    return () => unsubscribe();
  }, [user, isAuthReady, isAdmin]);

  const openEditDialog = (player: any) => {
    setEditingPlayer(player);
    setName(player.name || '');
    setNickname(player.nickname || '');
    setEmail(player.email || '');
    setPassword(''); // Don't show password
    setAvatar(player.avatar || '');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPlayer) return;

    try {
      let authUid = editingPlayer.authUid;

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

      await updateDoc(doc(db, 'players', editingPlayer.id), updates);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error updating player:", error);
      alert("Failed to update player. " + (error as Error).message);
    }
  };

  if (!isAuthReady) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Players</h1>
        <p className="text-zinc-500">Manage players, set up their login credentials, and edit profiles.</p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {players.map(player => (
            <Card key={player.id} className="overflow-hidden">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
                <div className="w-24 h-24 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-sm">
                  {player.avatar ? (
                    <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-zinc-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{player.name}</h3>
                  {player.nickname && <p className="text-sm text-zinc-500">"{player.nickname}"</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(player)} className="w-full">
                  <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                </Button>
              </CardContent>
            </Card>
          ))}
          {players.length === 0 && (
            <div className="col-span-full p-12 border-2 border-dashed rounded-lg border-zinc-200 text-center text-zinc-500">
              No players found. Create a tournament and add players to see them here.
            </div>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Player Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                <>
                  <div className="pt-4 border-t border-zinc-200">
                    <h4 className="font-medium mb-4">Login Credentials</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!editingPlayer?.authUid} />
                      </div>
                      {!editingPlayer?.authUid && (
                        <div className="space-y-2">
                          <Label>Password (for initial setup)</Label>
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                        </div>
                      )}
                      {editingPlayer?.authUid && (
                        <p className="text-sm text-green-600">✓ Login configured</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
