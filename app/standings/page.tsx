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
  const { user, isAuthReady } = useFirebase();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [standings, setStandings] = useState<SeasonStandingEntry[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Seasons laden
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const q = query(
      collection(db, "seasons"),
      where("ownerId", "==", user.uid),
    );
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

    const q = query(
      collection(db, "tournaments"),
      where("ownerId", "==", user.uid),
      where("seasonId", "==", selectedSeasonId),
    );

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

        // Nur abgeschlossene Turniere für die Rangliste
        const completed = allTourns.filter((t) => t.status === "completed");

        const playerMap = new Map<string, SeasonStandingEntry>();

        for (const tourn of completed) {
          try {
            const playersSnap = await getDocs(
              collection(db, "tournaments", tourn.id, "players"),
            );
            playersSnap.docs.forEach((pd) => {
              const pData = pd.data() as any;
              const existing = playerMap.get(pd.id) ?? {
                playerId: pd.id,
                name: pData.name,
                totalPoints: 0,
                tournamentsPlayed: 0,
                wins: 0,
                draws: 0,
                losses: 0,
              };
              existing.totalPoints += pData.points ?? 0;
              existing.tournamentsPlayed += 1;
              existing.wins += pData.wins ?? 0;
              existing.draws += pData.draws ?? 0;
              existing.losses += pData.losses ?? 0;
              playerMap.set(pd.id, existing);
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
  }, [user, isAuthReady, selectedSeasonId]);

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
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div>
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
                <CardTitle>
                  Rangliste{selectedSeason ? ` – ${selectedSeason.name}` : ""}
                </CardTitle>
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
                        {standings.map((entry, i) => (
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
                              {entry.name}
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
                        ))}
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
