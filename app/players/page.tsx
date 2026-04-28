'use client';

import { useFirebase } from '@/components/FirebaseProvider';
import { useAppIcon } from '@/components/ThemeCustomizerProvider';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';
import { slugify } from '@/lib/slugify';
import { collection, onSnapshot, query, where, addDoc, getDocs } from 'firebase/firestore';
import { SongPlayer } from '@/components/SongPlayer';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Swords } from 'lucide-react';

type ViewMode = 'list' | 'card';

export default function PlayersPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const getIcon = useAppIcon();
  const [players, setPlayers] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const searchParams = useSearchParams();
  const [showInvitedBanner, setShowInvitedBanner] = useState(false);
  const [myPlayer, setMyPlayer] = useState<any>(null);
  const [challengeTarget, setChallengeTarget] = useState<any>(null);
  const [challengeFormat, setChallengeFormat] = useState('501_bo3');
  const [challengeSending, setChallengeSending] = useState(false);
  const [challengeSent, setChallengeSent] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('invited') === '1') {
      setShowInvitedBanner(true);
      const t = setTimeout(() => setShowInvitedBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  useEffect(() => {
    const stored = localStorage.getItem('players-view-mode');
    if (stored === 'card' || stored === 'list') setViewMode(stored);
  }, []);

  const toggleView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('players-view-mode', mode);
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading, sans-serif)",
    fontWeight: "var(--heading-weight, 700)" as any,
    textTransform: "var(--heading-transform, none)" as any,
    fontStyle: "var(--heading-style, normal)",
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'players'));

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

  // Load current user's own player profile (for sending challenges)
  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, 'players'), where('authUid', '==', user.uid)))
      .then(snap => { if (!snap.empty) setMyPlayer({ id: snap.docs[0].id, ...snap.docs[0].data() }); })
      .catch(() => {});
  }, [user]);

  const sendChallenge = async () => {
    if (!user || !myPlayer || !challengeTarget) return;
    setChallengeSending(true);
    try {
      await addDoc(collection(db, 'challenges'), {
        fromUserId: user.uid,
        toUserId: challengeTarget.authUid,
        fromPlayerId: myPlayer.id,
        toPlayerId: challengeTarget.id,
        fromPlayerName: myPlayer.nickname || myPlayer.name,
        toPlayerName: challengeTarget.nickname || challengeTarget.name,
        format: challengeFormat,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setChallengeSent(challengeTarget.id);
      setChallengeTarget(null);
      setTimeout(() => setChallengeSent(null), 4000);
    } catch (e) {
      console.error('Challenge error:', e);
    } finally {
      setChallengeSending(false);
    }
  };

  if (!isAuthReady) return <div className="p-8">Loading...</div>;

  return (
    <div className="page-pad">
      <div className="section-gap">

        {/* Einladungsbestätigung */}
        {showInvitedBanner && (
          <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl px-5 py-4">
            <span className="text-xl">🎯</span>
            <div>
              <p className="font-semibold text-sm">Einladung verschickt!</p>
              <p className="text-sm opacity-80">Der Spieler hat eine Willkommens-E-Mail mit seinen Zugangsdaten erhalten.</p>
            </div>
            <button onClick={() => setShowInvitedBanner(false)} className="ml-auto text-green-600 dark:text-green-400 hover:opacity-70">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Spieler</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {players.length} {players.length === 1 ? 'Spieler' : 'Spieler'} registriert
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => toggleView('list')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Listenansicht"
            >
              <Icon icon="mdi:format-list-bulleted" className="w-5 h-5" />
            </button>
            <button
              onClick={() => toggleView('card')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
              title="Kartenansicht"
            >
              <Icon icon="mdi:view-grid" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {players.length === 0 && (
          <div className="py-20 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <Icon icon={getIcon('players')} className="w-14 h-14 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 font-medium">Noch keine Spieler vorhanden</p>
            <p className="text-zinc-400 text-sm mt-1">Erstelle ein Turnier und füge Spieler hinzu.</p>
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === 'list' && players.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {players.map(player => {
              const slug = slugify(player.name);
              return (
                <div key={player.id} className="py-3 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  {/* Avatar + Name+SongPlayer (zwischen Name und Icons) + Aktions-Icons */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                      {player.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.avatar} alt={player.name} className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <Icon icon={getIcon('account')} className="w-5 h-5 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {player.nickname ? (
                        <>
                          <h3 className="text-sm leading-tight truncate font-medium" style={headingStyle}>{player.nickname}</h3>
                          <p className="text-xs text-zinc-500 truncate">{player.name}</p>
                        </>
                      ) : (
                        <h3 className="text-sm leading-tight truncate font-medium">{player.name}</h3>
                      )}
                      {player.songUrl && (
                        <div className="mt-1">
                          <SongPlayer
                            playerId={player.id}
                            songUrl={player.songUrl}
                            songTitle={player.songTitle || 'Unbekannter Titel'}
                            songArtist={player.songArtist || ''}
                            className="flex items-center gap-2 w-full"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Challenge button: only for players with accounts that aren't the current user */}
                      {myPlayer && player.authUid && player.authUid !== user?.uid && (
                        <Button
                          variant="ghost" size="icon"
                          title="Herausfordern"
                          onClick={() => setChallengeTarget(player)}
                          className={challengeSent === player.id ? 'text-green-500' : 'text-blue-400'}
                        >
                          <Swords className="w-4 h-4" />
                        </Button>
                      )}
                      <Link href={`/players/${slug}`}>
                        <Button variant="ghost" size="icon" title="Statistiken">
                          <Icon icon={getIcon('standings')} className="w-4 h-4 text-zinc-500" />
                        </Button>
                      </Link>
                      {isAdmin && (
                        <Link href={`/players/${slug}/edit`}>
                          <Button variant="ghost" size="icon" title="Bearbeiten">
                            <Icon icon="mdi:pencil" className="w-4 h-4 text-zinc-500" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CARD VIEW */}
        {viewMode === 'card' && players.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {players.map(player => {
              const slug = slugify(player.name);
              return (
                <div
                  key={player.id}
                  className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 shrink-0">
                      {player.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={player.avatar} alt={player.name} className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <Icon icon={getIcon('account')} className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {player.nickname ? (
                        <>
                          <h3 className="text-xl leading-tight truncate" style={headingStyle}>{player.nickname}</h3>
                          <p className="text-sm text-zinc-500 truncate">{player.name}</p>
                        </>
                      ) : (
                        <h3 className="text-xl leading-tight truncate">{player.name}</h3>
                      )}
                    </div>
                  </div>

                  {player.songUrl && (
                    <SongPlayer
                      playerId={player.id}
                      songUrl={player.songUrl}
                      songTitle={player.songTitle || 'Unbekannter Titel'}
                      songArtist={player.songArtist || ''}
                    />
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                    <Link href={`/players/${slug}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Icon icon={getIcon('standings')} className="w-4 h-4" />
                        Statistiken
                      </Button>
                    </Link>
                    {myPlayer && player.authUid && player.authUid !== user?.uid && (
                      <Button
                        variant="outline" size="sm"
                        className={`gap-1.5 ${challengeSent === player.id ? 'text-green-500 border-green-500/40' : 'text-blue-400 border-blue-400/40'}`}
                        onClick={() => setChallengeTarget(player)}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        {challengeSent === player.id ? 'Gesendet' : 'Herausfordern'}
                      </Button>
                    )}
                    {isAdmin && (
                      <Link href={`/players/${slug}/edit`}>
                        <Button variant="ghost" size="icon" title="Bearbeiten">
                          <Icon icon="mdi:pencil" className="w-4 h-4 text-zinc-500" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Challenge Dialog */}
      {challengeTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setChallengeTarget(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                <Swords className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-100">Herausfordern</p>
                <p className="text-sm text-zinc-500">{challengeTarget.nickname || challengeTarget.name}</p>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Spielmodus</p>
              {[
                { value: '501_bo1', label: '501 · Best of 1' },
                { value: '501_bo3', label: '501 · Best of 3' },
                { value: '501_bo5', label: '501 · Best of 5' },
                { value: '301_bo3', label: '301 · Best of 3' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center ${challengeFormat === opt.value ? 'border-blue-500 bg-blue-500' : 'border-zinc-300 dark:border-zinc-600'}`}>
                    {challengeFormat === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input
                    type="radio"
                    name="format"
                    value={opt.value}
                    checked={challengeFormat === opt.value}
                    onChange={() => setChallengeFormat(opt.value)}
                    className="sr-only"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setChallengeTarget(null)}>Abbrechen</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700 gap-1.5" disabled={challengeSending} onClick={sendChallenge}>
                <Swords className="w-4 h-4" />
                {challengeSending ? 'Sende…' : 'Herausfordern'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
