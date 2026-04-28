"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { Medal, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { grantSeasonAchievements } from "@/lib/achievementEngine";

interface SeasonStandingEntry {
  playerId: string;
  name: string;
  totalPoints: number;
  tournamentsPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

export default function StandingsPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [standings, setStandings] = useState<SeasonStandingEntry[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGranting, setIsGranting] = useState(false);

  // Seasons laden
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const q = query(collection(db, "seasons"));
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => a.number - b.number);
        setSeasons(docs);
        if (docs.length > 0 && !selectedSeasonId) {
          // Standard: letzte (aktuellste) Season vorauswählen
          setSelectedSeasonId(docs[docs.length - 1].id);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "seasons"),
    );
  }, [user, isAuthReady]);

  // Rangliste für ausgewählte Season berechnen
  useEffect(() => {
    if (!isAuthReady || !user || !selectedSeasonId) {
      setStandings([]);
      setTournaments([]);
      return;
    }

    setIsLoading(true);

    const adminUid = process.env.NEXT_PUBLIC_ADMIN_UID;
    const qTournaments = isAdmin
      ? query(collection(db, "tournaments"), where("ownerId", "==", user.uid), where("seasonId", "==", selectedSeasonId))
      : adminUid
        ? query(collection(db, "tournaments"), where("ownerId", "==", adminUid), where("seasonId", "==", selectedSeasonId))
        : query(collection(db, "tournaments"), where("isPublic", "==", true), where("seasonId", "==", selectedSeasonId));
    const q = qTournaments;

    const unsub = onSnapshot(
      q,
      async (snap) => {
        const allTourns = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter(
            (t) => t.type !== "single_match" && t.type !== "casual_tiebreak",
          );

        allTourns.sort((a, b) => {
          const na = a.tournamentNumber ?? 99;
          const nb = b.tournamentNumber ?? 99;
          return na - nb;
        });
        setTournaments(allTourns);

        // Nur abgeschlossene reguläre Turniere für die Rangliste (Final-Turnier ausgeschlossen)
        const completed = allTourns.filter(
          (t) => t.status === "completed" && !t.isFinalTournament,
        );

        // Default scoring rules (can be overridden by Liga)
        const defaultScoring: Record<string, number> = {
          "1": 7, "2": 6, "3": 4, "4": 3, "5": 2, participation: 1, stayedUntilFinal: 1,
        };

        const playerMap = new Map<string, SeasonStandingEntry>();

        for (const tourn of completed) {
          try {
            const playersSnap = await getDocs(
              collection(db, "tournaments", tourn.id, "players"),
            );
            const matchesSnap = await getDocs(
              collection(db, "tournaments", tourn.id, "matches"),
            );
            const tPlayers = playersSnap.docs.map((pd) => ({ id: pd.id, ...(pd.data() as any) }));
            const tMatches = matchesSnap.docs.map((md) => ({ id: md.id, ...(md.data() as any) }));

            // Compute placement ranking (same logic as tournament results)
            const finalMatch = tMatches.find((m: any) => m.phase === "final");
            const semiMatches = tMatches.filter((m: any) => m.phase === "semi");
            const quarterMatches = tMatches.filter((m: any) => m.phase === "quarter");

            const rankedPlayers = tPlayers.map((p: any) => {
              let rankScore = 0;
              if (finalMatch?.winnerId === p.id) rankScore = 10000;
              else if (finalMatch && (finalMatch.playerAId === p.id || finalMatch.playerBId === p.id)) rankScore = 9000;
              else if (semiMatches.some((m: any) => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 8000;
              else if (quarterMatches.some((m: any) => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 7000;
              rankScore += (p.points || 0) * 100 + (p.wins || 0) * 10 - (p.losses || 0);
              return { ...p, rankScore };
            }).sort((a: any, b: any) => b.rankScore - a.rankScore);

            rankedPlayers.forEach((p: any, index: number) => {
              const existing = playerMap.get(p.id) ?? {
                playerId: p.id,
                name: p.name,
                totalPoints: 0,
                tournamentsPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
              };

              // Placement-based scoring
              const placement = String(index + 1);
              const placementPoints = defaultScoring[placement] ?? 0;
              const participationPoints = defaultScoring.participation ?? 0;
              const finalBonus = (p.stayedUntilFinal || index < 2) ? (defaultScoring.stayedUntilFinal ?? 0) : 0;
              existing.totalPoints += placementPoints + participationPoints + finalBonus;
              existing.tournamentsPlayed += 1;
              existing.wins += p.wins ?? 0;
              existing.draws += p.draws ?? 0;
              existing.losses += p.losses ?? 0;
              playerMap.set(p.id, existing);
            });
          } catch (_) {
            // einzelnes Turnier überspringen wenn kein Zugriff
          }
        }

        const result = Array.from(playerMap.values()).sort(
          (a, b) =>
            b.totalPoints - a.totalPoints ||
            b.wins - a.wins ||
            a.losses - b.losses,
        );
        setStandings(result);
        setIsLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "tournaments");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [user, isAuthReady, isAdmin, selectedSeasonId]);

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Laden...
      </div>
    );
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const completedCount = tournaments.filter(
    (t) => t.status === "completed",
  ).length;
  const regularTournaments = tournaments.filter((t) => !t.isFinalTournament);
  const finalTournament = tournaments.find((t) => t.isFinalTournament);

  return (
    <div className="page-pad">
      <div className="section-gap">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rangliste</h1>
            <p className="text-zinc-500">
              Saisonale Punkteübersicht aller Spieler.
            </p>
          </div>

          {/* Season-Dropdown */}
          {seasons.length > 0 && (
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 w-full sm:w-auto"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {seasons.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
            <Trophy className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-zinc-500 font-medium">Noch keine Seasons</p>
            <p className="text-zinc-400 text-sm mt-1">
              Erstelle zuerst eine Season unter{" "}
              <a href="/seasons" className="underline">
                Seasons
              </a>
              .
            </p>
          </div>
        ) : (
          <>
            {/* Saison-Übersicht */}
            {selectedSeason && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{tournaments.length}</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Turniere gesamt
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">{completedCount}</p>
                    <p className="text-xs text-zinc-500 mt-1">Abgeschlossen</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">
                      {regularTournaments.length} / 10
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Regular Turniere
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-2xl font-bold">
                      {finalTournament ? (
                        <span
                          className={
                            finalTournament.status === "completed"
                              ? "text-yellow-500"
                              : "text-zinc-400"
                          }
                        >
                          ✓
                        </span>
                      ) : (
                        <span className="text-zinc-300">–</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Final Turnier</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Turnier-Übersicht dieser Season */}
            {tournaments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Turniere in {selectedSeason?.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {tournaments.map((t) => (
                      <a
                        key={t.id}
                        href={`/tournament/${t.id}`}
                        className={`p-2 rounded-lg border text-center text-xs font-medium transition-colors hover:border-zinc-400 ${
                          t.status === "completed"
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : t.status === "draft"
                              ? "bg-white dark:bg-zinc-900 text-zinc-400 border-dashed"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200"
                        }`}
                      >
                        <span className="block text-lg font-bold">
                          {t.isFinalTournament
                            ? "F"
                            : `#${t.tournamentNumber ?? "?"}`}
                        </span>
                        <span className="truncate block">{t.title}</span>
                        <span className="text-[10px] opacity-60 uppercase">
                          {t.status}
                        </span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rangliste */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle>
                    Rangliste{selectedSeason ? ` – ${selectedSeason.name}` : ""}
                  </CardTitle>
                  {isAdmin && standings.length > 0 && (
                    <button
                      disabled={isGranting}
                      onClick={async () => {
                        if (!selectedSeasonId || standings.length === 0) return;
                        if (!confirm('Saison-Achievements an alle Platzierten vergeben?\nDies sollte nur einmal am Saisonende gemacht werden.')) return;
                        setIsGranting(true);
                        try {
                          const qualCount = finalTournament?.grandFinalConfig?.qualifierCount ?? 8;
                          await grantSeasonAchievements(
                            selectedSeasonId,
                            selectedSeason?.name ?? '',
                            standings.map((s) => ({ playerId: s.playerId, totalPoints: s.totalPoints })),
                            qualCount,
                          );
                        } catch (err) {
                          console.error('Season achievements error:', err);
                        } finally {
                          setIsGranting(false);
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 transition-colors disabled:opacity-50"
                    >
                      {isGranting ? 'Vergebe…' : '🏆 Saison-Achievements vergeben'}
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center text-zinc-400 py-8">Lade...</p>
                ) : standings.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed rounded-lg border-zinc-200">
                    <p className="text-zinc-500">
                      Noch keine abgeschlossenen Turniere in dieser Season.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Spieler</th>
                          <th className="px-4 py-3 text-center">Turniere</th>
                          <th className="px-4 py-3 text-center">S</th>
                          <th className="px-4 py-3 text-center">U</th>
                          <th className="px-4 py-3 text-center">N</th>
                          <th className="px-4 py-3 text-center font-bold">
                            Punkte
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const qualCount = finalTournament?.grandFinalConfig?.qualifierCount ?? (finalTournament ? 8 : 0);
                          const rows: React.ReactNode[] = [];
                          standings.forEach((entry, i) => {
                            // Trennzeile nach letztem Qualifier (nur wenn Final-Turnier nicht abgeschlossen)
                            if (qualCount > 0 && i === qualCount && finalTournament?.status !== "completed") {
                              rows.push(
                                <tr key="nachrücker-divider">
                                  <td colSpan={7} className="px-4 py-1.5 text-center text-xs text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/50">
                                    — Nachrücker-Zone —
                                  </td>
                                </tr>
                              );
                            }
                            const isQualified = qualCount > 0 && i < qualCount;
                            rows.push(
                              <tr
                                key={entry.playerId}
                                className={`border-b dark:border-zinc-800 ${i === 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : i === 1 ? "bg-zinc-50 dark:bg-zinc-800/30" : i === 2 ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                              >
                                <td className="px-4 py-3 font-bold text-zinc-400">
                                  {i === 0 ? (
                                    <Medal className="w-5 h-5 text-yellow-500" />
                                  ) : i === 1 ? (
                                    <Medal className="w-5 h-5 text-zinc-400" />
                                  ) : i === 2 ? (
                                    <Medal className="w-5 h-5 text-orange-500" />
                                  ) : (
                                    <span className="text-zinc-400">{i + 1}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-semibold">
                                  <div className="flex items-center gap-2">
                                    {entry.name}
                                    {isQualified && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                        Qualifiziert ✓
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center text-zinc-500">
                                  {entry.tournamentsPlayed}
                                </td>
                                <td className="px-4 py-3 text-center text-green-600 font-medium">
                                  {entry.wins}
                                </td>
                                <td className="px-4 py-3 text-center text-orange-500 font-medium">
                                  {entry.draws}
                                </td>
                                <td className="px-4 py-3 text-center text-red-500 font-medium">
                                  {entry.losses}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-lg font-bold">
                                    {entry.totalPoints}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
