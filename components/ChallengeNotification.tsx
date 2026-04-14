'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, updateDoc, addDoc, doc,
  serverTimestamp, getDocs, deleteDoc,
} from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Swords, X } from 'lucide-react';

interface Challenge {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromPlayerId: string;
  toPlayerId: string;
  fromPlayerName: string;
  toPlayerName: string;
  format: string;
  status: string;
  createdAt: string;
  tournamentId?: string;
  matchId?: string;
}

export function ChallengeNotification() {
  const { user, isAdmin } = useFirebase();
  const router = useRouter();
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [accepted, setAccepted] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Listen for incoming pending challenges
    const qIn = query(
      collection(db, 'challenges'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending'),
    );
    const unsubIn = onSnapshot(qIn, (snap) => {
      setIncoming(snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge)));
    });

    // Listen for outgoing challenges that were accepted (challenger navigates to match)
    const qOut = query(
      collection(db, 'challenges'),
      where('fromUserId', '==', user.uid),
      where('status', '==', 'accepted'),
    );
    const unsubOut = onSnapshot(qOut, (snap) => {
      const withMatch = snap.docs.map(d => ({ id: d.id, ...d.data() } as Challenge))
        .find(c => c.tournamentId && c.matchId);
      if (withMatch) setAccepted(withMatch);
    });

    return () => { unsubIn(); unsubOut(); };
  }, [user]);

  const accept = async (challenge: Challenge) => {
    if (!user) return;
    setLoading(challenge.id);
    try {
      // Create tournament
      const formatLabel = challenge.format.startsWith('501') ? '501' : '301';
      const boMatch = challenge.format.match(/bo(\d+)/);
      const bo = boMatch ? boMatch[1] : '3';

      const tourRef = await addDoc(collection(db, 'tournaments'), {
        title: `${challenge.fromPlayerName} vs ${challenge.toPlayerName}`,
        status: 'single_match',
        type: 'single_match',
        ownerId: challenge.fromUserId,
        participantUids: [challenge.fromUserId, challenge.toUserId],
        createdAt: new Date().toISOString(),
        format: challenge.format,
        allowDoubleOut: true,
        allowSingleOut: false,
        allowTripleOut: false,
        allowDraw: false,
      });

      // Create match
      const matchRef = await addDoc(collection(db, 'tournaments', tourRef.id, 'matches'), {
        phase: 'final',
        playerAId: challenge.fromPlayerId,
        playerBId: challenge.toPlayerId,
        playerAName: challenge.fromPlayerName,
        playerBName: challenge.toPlayerName,
        status: 'pending',
        format: challenge.format,
        playerARest: challenge.format.startsWith('501') ? 501 : 301,
        playerBRest: challenge.format.startsWith('501') ? 501 : 301,
        playerALegs: 0,
        playerBLegs: 0,
        currentLeg: 1,
        turns: [],
      });

      // Update challenge
      await updateDoc(doc(db, 'challenges', challenge.id), {
        status: 'accepted',
        tournamentId: tourRef.id,
        matchId: matchRef.id,
      });

      router.push(`/tournament/${tourRef.id}/match/${matchRef.id}`);
    } catch (e) {
      console.error('Error accepting challenge:', e);
    } finally {
      setLoading(null);
    }
  };

  const decline = async (challenge: Challenge) => {
    setLoading(challenge.id);
    try {
      await updateDoc(doc(db, 'challenges', challenge.id), { status: 'declined' });
    } catch (e) {
      console.error('Error declining challenge:', e);
    } finally {
      setLoading(null);
    }
  };

  const dismissAccepted = async () => {
    if (!accepted) return;
    // Mark as seen so it doesn't re-show
    try {
      await updateDoc(doc(db, 'challenges', accepted.id), { status: 'completed' });
    } catch {}
    setAccepted(null);
  };

  if (!user) return null;

  return (
    <>
      {/* Incoming challenges */}
      {incoming.map(challenge => (
        <div
          key={challenge.id}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Herausforderung!</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                <span className="text-zinc-200">{challenge.fromPlayerName}</span> fordert dich zu einem {challenge.format.replace('_', ' · Best of ').replace('bo', '')} heraus
              </p>
            </div>
            <button
              onClick={() => decline(challenge)}
              className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading === challenge.id}
              onClick={() => accept(challenge)}
            >
              {loading === challenge.id ? 'Wird erstellt…' : 'Annehmen'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              disabled={loading === challenge.id}
              onClick={() => decline(challenge)}
            >
              Ablehnen
            </Button>
          </div>
        </div>
      ))}

      {/* Outgoing challenge accepted — guide challenger to match */}
      {accepted && accepted.tournamentId && accepted.matchId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm mx-4 bg-zinc-900 border border-green-500/40 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Herausforderung angenommen!</p>
              <p className="text-xs text-zinc-400 mt-0.5">
                <span className="text-zinc-200">{accepted.toPlayerName}</span> hat angenommen
              </p>
            </div>
            <button onClick={dismissAccepted} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => {
              dismissAccepted();
              router.push(`/tournament/${accepted.tournamentId}/match/${accepted.matchId}`);
            }}
          >
            Zum Match
          </Button>
        </div>
      )}
    </>
  );
}
