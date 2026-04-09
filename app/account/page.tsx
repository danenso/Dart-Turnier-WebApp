"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";

export default function AccountPage() {
  const { user, isAdmin } = useFirebase();
  const [playerProfile, setPlayerProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    if (!isAdmin) {
      const q = query(collection(db, 'players'), where('authUid', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setPlayerProfile({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        }
      });
      return () => unsubscribe();
    }
  }, [user, isAdmin]);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-zinc-500">Manage your account details and view your statistics.</p>
        
        {user && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {user.displayName || playerProfile?.name || 'N/A'}</p>
              <p><span className="font-medium">Email:</span> {user.email}</p>
              <p><span className="font-medium">User ID:</span> {user.uid}</p>
              <p><span className="font-medium">Role:</span> {isAdmin ? 'Administrator' : 'Player'}</p>
            </div>
          </div>
        )}

        {playerProfile && !isAdmin && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">Your Statistics</h2>
            
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
        )}
      </div>
    </div>
  );
}
