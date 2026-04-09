'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { collection, doc, onSnapshot, query, addDoc, deleteDoc, updateDoc, setDoc, where } from 'firebase/firestore';
import { ArrowLeft, Trash2, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function TournamentPage() {
  const { id } = useParams() as { id: string };
  const { user, isAuthReady } = useFirebase();
  const router = useRouter();
  
  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [globalPlayers, setGlobalPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthReady || !user || !id) return;

    const tUnsub = onSnapshot(doc(db, 'tournaments', id), (docSnap) => {
      if (docSnap.exists()) {
        setTournament({ id: docSnap.id, ...docSnap.data() });
      } else {
        router.push('/');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `tournaments/${id}`));

    const pUnsub = onSnapshot(collection(db, 'tournaments', id, 'players'), (snapshot) => {
      const p = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(p);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `tournaments/${id}/players`));

    const mUnsub = onSnapshot(collection(db, 'tournaments', id, 'matches'), (snapshot) => {
      const m = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMatches(m);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `tournaments/${id}/matches`));

    const q = query(collection(db, 'players'), where('ownerId', '==', user.uid));
    const gUnsub = onSnapshot(q, (snapshot) => {
      setGlobalPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `players`));

    return () => {
      tUnsub();
      pUnsub();
      mUnsub();
      gUnsub();
    };
  }, [id, user, isAuthReady, router]);

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !user) return;
    try {
      let globalPlayerId = '';
      const existing = globalPlayers.find(p => p.name.toLowerCase() === newPlayerName.trim().toLowerCase());
      
      if (existing) {
        globalPlayerId = existing.id;
      } else {
        const newGlobalPlayerRef = await addDoc(collection(db, 'players'), {
          name: newPlayerName.trim(),
          ownerId: user.uid,
          createdAt: new Date().toISOString()
        });
        globalPlayerId = newGlobalPlayerRef.id;
      }

      await setDoc(doc(db, 'tournaments', id, 'players', globalPlayerId), {
        name: newPlayerName.trim(),
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0
      });
      setNewPlayerName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tournaments/${id}/players`);
    }
  };

  const removePlayer = async (playerId: string) => {
    try {
      await deleteDoc(doc(db, 'tournaments', id, 'players', playerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tournaments/${id}/players/${playerId}`);
    }
  };

  const generateBracket = async () => {
    // Sort all players
    const sortedPlayers = [...players].sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
    
    if (sortedPlayers.length < 8) {
      alert('Need at least 8 players for a bracket.');
      return;
    }

    // Check for tie at 8th place
    const eighth = sortedPlayers[7];
    const ninth = sortedPlayers[8];
    
    let needsTiebreak = false;
    if (ninth && eighth.points === ninth.points && eighth.wins === ninth.wins && eighth.losses === ninth.losses) {
      needsTiebreak = true;
    }

    try {
      if (needsTiebreak) {
        // Find all players tied with the 8th player
        const tiedPlayers = sortedPlayers.filter(p => p.points === eighth.points && p.wins === eighth.wins && p.losses === eighth.losses);
        
        await addDoc(collection(db, 'tournaments', id, 'tiebreaks'), {
          targetNumber: Math.floor(Math.random() * 20) + 1,
          playerIds: tiedPlayers.map(p => p.id),
          playerNames: tiedPlayers.map(p => p.name),
          scores: {},
          currentRound: 1,
          status: 'pending'
        });

        await updateDoc(doc(db, 'tournaments', id), {
          status: 'tiebreaks'
        });
      } else {
        // Generate Bracket Matches (Quarter Finals)
        const top8 = sortedPlayers.slice(0, 8);
        // 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5
        const matchups = [
          [top8[0], top8[7]],
          [top8[1], top8[6]],
          [top8[2], top8[5]],
          [top8[3], top8[4]]
        ];

        for (const [pA, pB] of matchups) {
          await addDoc(collection(db, 'tournaments', id, 'matches'), {
            phase: 'quarter',
            playerAId: pA.id,
            playerBId: pB.id,
            playerAName: pA.name,
            playerBName: pB.name,
            playerALegs: 0,
            playerBLegs: 0,
            currentLeg: 1,
            playerAStartsLeg: true,
            currentTurnId: '',
            playerARest: 301,
            playerBRest: 301,
            answerThrowActive: false,
            status: 'pending',
            format: '301_bo3'
          });
        }

        await updateDoc(doc(db, 'tournaments', id), {
          status: 'bracket'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };

  const generateNextRound = async (currentPhase: string) => {
    const currentMatches = matches.filter(m => m.phase === currentPhase);
    if (currentMatches.some(m => m.status !== 'completed')) {
      alert('Not all matches in this round are completed.');
      return;
    }

    try {
      if (currentPhase === 'quarter') {
        // Generate Semi Finals
        // QF1 winner vs QF2 winner, QF3 winner vs QF4 winner
        // Assuming matches are sorted by creation time
        const m1 = currentMatches[0];
        const m2 = currentMatches[1];
        const m3 = currentMatches[2];
        const m4 = currentMatches[3];

        const sfMatchups = [
          [m1.winnerId === m1.playerAId ? {id: m1.playerAId, name: m1.playerAName} : {id: m1.playerBId, name: m1.playerBName},
           m2.winnerId === m2.playerAId ? {id: m2.playerAId, name: m2.playerAName} : {id: m2.playerBId, name: m2.playerBName}],
          [m3.winnerId === m3.playerAId ? {id: m3.playerAId, name: m3.playerAName} : {id: m3.playerBId, name: m3.playerBName},
           m4.winnerId === m4.playerAId ? {id: m4.playerAId, name: m4.playerAName} : {id: m4.playerBId, name: m4.playerBName}]
        ];

        for (const [pA, pB] of sfMatchups) {
          await addDoc(collection(db, 'tournaments', id, 'matches'), {
            phase: 'semi',
            playerAId: pA.id,
            playerBId: pB.id,
            playerAName: pA.name,
            playerBName: pB.name,
            playerALegs: 0,
            playerBLegs: 0,
            currentLeg: 1,
            playerAStartsLeg: true,
            currentTurnId: '',
            playerARest: 301,
            playerBRest: 301,
            answerThrowActive: false,
            status: 'pending',
            format: '301_bo3'
          });
        }
      } else if (currentPhase === 'semi') {
        // Generate Final
        const m1 = currentMatches[0];
        const m2 = currentMatches[1];

        const pA = m1.winnerId === m1.playerAId ? {id: m1.playerAId, name: m1.playerAName} : {id: m1.playerBId, name: m1.playerBName};
        const pB = m2.winnerId === m2.playerAId ? {id: m2.playerAId, name: m2.playerAName} : {id: m2.playerBId, name: m2.playerBName};

        await addDoc(collection(db, 'tournaments', id, 'matches'), {
          phase: 'final',
          playerAId: pA.id,
          playerBId: pB.id,
          playerAName: pA.name,
          playerBName: pB.name,
          playerALegs: 0,
          playerBLegs: 0,
          currentLeg: 1,
          playerAStartsLeg: true,
          currentTurnId: '',
          playerARest: 501,
          playerBRest: 501,
          answerThrowActive: false,
          status: 'pending',
          format: '501_bo3'
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };
  const startDraw = async () => {
    if (players.length < 3) {
      alert('Need at least 3 players to start.');
      return;
    }
    
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const numGroups = players.length >= 8 ? 2 : 1;
    
    try {
      const groupA = [];
      const groupB = [];

      // Assign groups
      for (let i = 0; i < shuffled.length; i++) {
        const groupId = numGroups === 1 ? 'A' : (i % 2 === 0 ? 'A' : 'B');
        if (groupId === 'A') groupA.push(shuffled[i]);
        else groupB.push(shuffled[i]);

        await updateDoc(doc(db, 'tournaments', id, 'players', shuffled[i].id), {
          groupId
        });
      }

      // Generate Round Robin matches for a group
      const generateMatches = async (groupPlayers: any[]) => {
        for (let i = 0; i < groupPlayers.length; i++) {
          for (let j = i + 1; j < groupPlayers.length; j++) {
            await addDoc(collection(db, 'tournaments', id, 'matches'), {
              phase: 'group',
              playerAId: groupPlayers[i].id,
              playerBId: groupPlayers[j].id,
              playerAName: groupPlayers[i].name,
              playerBName: groupPlayers[j].name,
              playerALegs: 0,
              playerBLegs: 0,
              currentLeg: 1,
              playerAStartsLeg: true,
              currentTurnId: '',
              playerARest: 301,
              playerBRest: 301,
              answerThrowActive: false,
              status: 'pending',
              format: '301_bo1'
            });
          }
        }
      };

      await generateMatches(groupA);
      if (numGroups === 2) {
        await generateMatches(groupB);
      }
      
      // Update tournament status
      await updateDoc(doc(db, 'tournaments', id), {
        status: 'groups'
      });
      
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };

  if (!tournament) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="-ml-4 mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tournament.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-900">
              {tournament.status.toUpperCase()}
            </span>
            <span className="text-sm text-zinc-500 flex items-center gap-1">
              <Users className="h-4 w-4" /> {players.length} Players
            </span>
          </div>
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="groups" disabled={tournament.status === 'draft'}>Groups</TabsTrigger>
            <TabsTrigger value="matches" disabled={tournament.status === 'draft'}>Matches</TabsTrigger>
            <TabsTrigger value="tiebreaks" disabled={tournament.status !== 'tiebreaks'}>Tiebreaks</TabsTrigger>
            <TabsTrigger value="bracket" disabled={['draft', 'groups', 'tiebreaks'].includes(tournament.status)}>Finals</TabsTrigger>
            <TabsTrigger value="results" disabled={tournament.status !== 'completed'}>Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="participants" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 h-fit">
                <CardHeader>
                  <CardTitle>Add Player</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={addPlayer} className="space-y-4">
                    <Input 
                      placeholder="Player name" 
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      disabled={tournament.status !== 'draft'}
                      list="global-players"
                    />
                    <datalist id="global-players">
                      {globalPlayers.map(p => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                    <Button type="submit" className="w-full" disabled={tournament.status !== 'draft' || !newPlayerName.trim()}>
                      Add Player
                    </Button>
                  </form>
                </CardContent>
              </Card>
              
              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Player List</CardTitle>
                  {tournament.status === 'draft' && (
                    <Button onClick={startDraw} disabled={players.length < 3}>
                      Start Draw & Generate Matches
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {players.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-400 w-6">{i + 1}.</span>
                          <span className="font-medium">{p.name}</span>
                          {p.groupId && (
                            <span className="text-xs bg-zinc-100 px-2 py-1 rounded">Group {p.groupId}</span>
                          )}
                        </div>
                        {tournament.status === 'draft' && (
                          <Button variant="ghost" size="icon" onClick={() => removePlayer(p.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {players.length === 0 && (
                      <p className="text-center text-zinc-500 py-8">No players added yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="groups">
            <div className="flex justify-end mb-4">
              {tournament.status === 'groups' && (
                <Button onClick={generateBracket} disabled={players.length < 8}>
                  Generate Bracket (Top 8)
                </Button>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {['A', 'B'].map(groupId => {
                const groupPlayers = players.filter(p => p.groupId === groupId).sort((a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses);
                if (groupPlayers.length === 0) return null;
                return (
                  <Card key={groupId}>
                    <CardHeader>
                      <CardTitle>Group {groupId}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50">
                            <tr>
                              <th className="px-4 py-2">Player</th>
                              <th className="px-4 py-2 text-center">P</th>
                              <th className="px-4 py-2 text-center">W</th>
                              <th className="px-4 py-2 text-center">D</th>
                              <th className="px-4 py-2 text-center">L</th>
                              <th className="px-4 py-2 text-center">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupPlayers.map((p, i) => (
                              <tr key={p.id} className="border-b">
                                <td className="px-4 py-2 font-medium">
                                  {i + 1}. {p.name}
                                </td>
                                <td className="px-4 py-2 text-center">{p.matchesPlayed}</td>
                                <td className="px-4 py-2 text-center">{p.wins}</td>
                                <td className="px-4 py-2 text-center">{p.draws}</td>
                                <td className="px-4 py-2 text-center">{p.losses}</td>
                                <td className="px-4 py-2 text-center font-bold">{p.points}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="matches">
            <div className="grid gap-4">
              {matches.map(m => (
                <Card 
                  key={m.id} 
                  className={`cursor-pointer hover:border-zinc-400 transition-colors ${
                    m.status === 'completed' ? 'bg-zinc-100 opacity-75' : 
                    m.status === 'in_progress' ? 'bg-green-50 border-green-200' : 
                    'bg-white'
                  }`} 
                  onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 flex items-center justify-end gap-4">
                      <span className={`font-bold ${m.status === 'completed' ? (m.isDraw ? 'text-orange-500' : m.winnerId === m.playerAId ? 'text-green-600' : 'text-red-600') : ''}`}>{m.playerAName}</span>
                      {m.status === 'completed' ? (
                        <span className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? 'text-orange-500 bg-orange-50' : m.winnerId === m.playerAId ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                          {m.isDraw ? 'D' : m.winnerId === m.playerAId ? 'W' : 'L'}
                        </span>
                      ) : (
                        <span className="text-2xl font-mono bg-white px-3 py-1 rounded border">{m.playerALegs}</span>
                      )}
                    </div>
                    <div className="px-4 flex flex-col items-center">
                      <span className="text-zinc-400 text-sm font-medium">
                        {m.status === 'completed' ? 'FT' : m.status === 'in_progress' ? 'LIVE' : 'VS'}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase">{m.phase}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-start gap-4">
                      {m.status === 'completed' ? (
                        <span className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? 'text-orange-500 bg-orange-50' : m.winnerId === m.playerBId ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                          {m.isDraw ? 'D' : m.winnerId === m.playerBId ? 'W' : 'L'}
                        </span>
                      ) : (
                        <span className="text-2xl font-mono bg-white px-3 py-1 rounded border">{m.playerBLegs}</span>
                      )}
                      <span className={`font-bold ${m.status === 'completed' ? (m.isDraw ? 'text-orange-500' : m.winnerId === m.playerBId ? 'text-green-600' : 'text-red-600') : ''}`}>{m.playerBName}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {matches.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
                  <p className="text-zinc-500">No matches generated yet.</p>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="bracket">
            <div className="grid md:grid-cols-3 gap-8 p-4 bg-white rounded-lg border overflow-x-auto">
              <div className="space-y-4 min-w-[200px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-500 uppercase text-sm">Quarter Finals</h3>
                  {matches.filter(m => m.phase === 'quarter').length > 0 && matches.filter(m => m.phase === 'semi').length === 0 && (
                    <Button size="sm" variant="outline" onClick={() => generateNextRound('quarter')}>
                      Next Round
                    </Button>
                  )}
                </div>
                {matches.filter(m => m.phase === 'quarter').map(m => (
                  <Card key={m.id} className="cursor-pointer hover:border-zinc-400" onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}>
                    <div className="p-3 text-sm flex justify-between border-b">
                      <span className={m.winnerId === m.playerAId ? 'font-bold' : ''}>{m.playerAName}</span>
                      <span className="font-mono">{m.playerALegs}</span>
                    </div>
                    <div className="p-3 text-sm flex justify-between">
                      <span className={m.winnerId === m.playerBId ? 'font-bold' : ''}>{m.playerBName}</span>
                      <span className="font-mono">{m.playerBLegs}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="space-y-4 min-w-[200px] mt-12">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-500 uppercase text-sm">Semi Finals</h3>
                  {matches.filter(m => m.phase === 'semi').length > 0 && matches.filter(m => m.phase === 'final').length === 0 && (
                    <Button size="sm" variant="outline" onClick={() => generateNextRound('semi')}>
                      Next Round
                    </Button>
                  )}
                </div>
                {matches.filter(m => m.phase === 'semi').map(m => (
                  <Card key={m.id} className="cursor-pointer hover:border-zinc-400" onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}>
                    <div className="p-3 text-sm flex justify-between border-b">
                      <span className={m.winnerId === m.playerAId ? 'font-bold' : ''}>{m.playerAName}</span>
                      <span className="font-mono">{m.playerALegs}</span>
                    </div>
                    <div className="p-3 text-sm flex justify-between">
                      <span className={m.winnerId === m.playerBId ? 'font-bold' : ''}>{m.playerBName}</span>
                      <span className="font-mono">{m.playerBLegs}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <div className="space-y-4 min-w-[200px] mt-24">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-500 uppercase text-sm">Final</h3>
                  {matches.filter(m => m.phase === 'final' && m.status === 'completed').length > 0 && tournament.status !== 'completed' && (
                    <Button size="sm" onClick={async () => {
                      await updateDoc(doc(db, 'tournaments', id), { status: 'completed' });
                    }}>
                      Complete Tournament
                    </Button>
                  )}
                </div>
                {matches.filter(m => m.phase === 'final').map(m => (
                  <Card key={m.id} className="cursor-pointer hover:border-zinc-400" onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}>
                    <div className="p-3 text-sm flex justify-between border-b">
                      <span className={m.winnerId === m.playerAId ? 'font-bold text-green-600' : ''}>{m.playerAName}</span>
                      <span className="font-mono">{m.playerALegs}</span>
                    </div>
                    <div className="p-3 text-sm flex justify-between">
                      <span className={m.winnerId === m.playerBId ? 'font-bold text-green-600' : ''}>{m.playerBName}</span>
                      <span className="font-mono">{m.playerBLegs}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>Tournament Results & Season Points</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    const finalMatch = matches.find(m => m.phase === 'final');
                    const semiMatches = matches.filter(m => m.phase === 'semi');
                    const quarterMatches = matches.filter(m => m.phase === 'quarter');

                    let rankedPlayers = [...players].map(p => {
                      let rankScore = 0;
                      if (finalMatch?.winnerId === p.id) rankScore = 10000;
                      else if (finalMatch && (finalMatch.playerAId === p.id || finalMatch.playerBId === p.id)) rankScore = 9000;
                      else if (semiMatches.some(m => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 8000;
                      else if (quarterMatches.some(m => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 7000;
                      
                      rankScore += (p.points || 0) * 100 + (p.wins || 0) * 10 - (p.losses || 0);
                      
                      return { ...p, rankScore };
                    });

                    rankedPlayers.sort((a, b) => b.rankScore - a.rankScore);
                    
                    return rankedPlayers.map((p, index) => {
                      let seasonPoints = 1; // Participation
                      if (p.stayedUntilFinal || index < 2) seasonPoints += 1; // Finalists automatically get it
                      
                      if (index === 0) seasonPoints += 6;
                      else if (index === 1) seasonPoints += 5;
                      else if (index === 2) seasonPoints += 4;
                      else if (index === 3) seasonPoints += 2;
                      else if (index === 4) seasonPoints += 2;

                      return (
                        <div key={p.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-bold">{p.name}</div>
                              <div className="text-sm text-zinc-500">
                                {seasonPoints} Season Points
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={p.stayedUntilFinal || index < 2}
                                disabled={index < 2}
                                onChange={async (e) => {
                                  await updateDoc(doc(db, 'tournaments', id, 'players', p.id), {
                                    stayedUntilFinal: e.target.checked
                                  });
                                }}
                                className="rounded border-zinc-300"
                              />
                              Stayed until final
                            </label>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
