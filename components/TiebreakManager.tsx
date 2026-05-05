import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { ArrowUp, ArrowDown, Check, Play } from "lucide-react";
import { SpinWheel } from "@/components/SpinWheel";

interface TiebreakProps {
  tournamentId: string;
  tiebreak: any;
  isAdmin: boolean;
  tiebreakHits?: number;
}

export function TiebreakManager({
  tournamentId,
  tiebreak,
  isAdmin,
  tiebreakHits,
}: TiebreakProps) {
  const hits = tiebreakHits ?? 4;
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [scores, setScores] = useState<Record<string, Record<number, number>>>(
    tiebreak.scores || {},
  );

  const order =
    tiebreak.status === "pending"
      ? manualOrder || tiebreak.playerIds
      : tiebreak.playerIds;

  const showSpinWheel =
    tiebreak.status === "pending" && !tiebreak.spinWheelShown;

  const movePlayer = (index: number, direction: "up" | "down") => {
    if (!isAdmin || tiebreak.status !== "pending") return;
    const newOrder = [...order];
    if (direction === "up" && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [
        newOrder[index],
        newOrder[index - 1],
      ];
    } else if (direction === "down" && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [
        newOrder[index],
        newOrder[index + 1],
      ];
    }
    setManualOrder(newOrder);
  };

  const confirmSpinWheel = async () => {
    if (!isAdmin) return;
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        { spinWheelShown: true },
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${tournamentId}/tiebreaks/${tiebreak.id}`,
      );
    }
  };

  const startTiebreak = async () => {
    if (!isAdmin) return;
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        {
          status: "in_progress",
          playerIds: order,
          currentRound: 1,
          scores: {},
        },
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${tournamentId}/tiebreaks/${tiebreak.id}`,
      );
    }
  };

  const setScore = (playerId: string, round: number, value: number) => {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [round]: value },
    }));
  };

  const saveRound = async () => {
    if (!isAdmin) return;
    const activePlayers = getActivePlayersForRound(tiebreak.currentRound);
    for (const pId of activePlayers) {
      if (scores[pId]?.[tiebreak.currentRound] === undefined) {
        alert("Bitte Treffer für alle aktiven Spieler eingeben.");
        return;
      }
    }

    // Nach mind. X Runden: prüfen ob klarer Gewinner (kein Gleichstand)
    const nextRound = tiebreak.currentRound + 1;
    if (nextRound > hits) {
      const totals = tiebreak.playerIds.map((id: string) => {
        let total = 0;
        for (let r = 1; r <= tiebreak.currentRound; r++) total += scores[id]?.[r] || 0;
        return { id, total };
      }).sort((a: any, b: any) => b.total - a.total);
      const hasTie = totals[0].total === totals[1].total;
      if (!hasTie) {
        // Auto-abschließen
        try {
          await updateDoc(
            doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
            { scores, currentRound: nextRound, status: "completed", finalOrder: totals.map((p: any) => p.id) },
          );
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tournaments/${tournamentId}/tiebreaks/${tiebreak.id}`);
        }
        return;
      }
    }

    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        { scores, currentRound: nextRound },
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${tournamentId}/tiebreaks/${tiebreak.id}`,
      );
    }
  };

  const completeTiebreak = async () => {
    if (!isAdmin) return;
    const placements = calculatePlacements();
    const hasTies = placements.some(
      (p: any, i: number, arr: any[]) => i > 0 && p.total === arr[i - 1].total,
    );
    if (hasTies) {
      alert("Es gibt noch Gleichstände. Bitte eine weitere Runde spielen.");
      return;
    }
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        {
          status: "completed",
          scores,
          finalOrder: placements.map((p: any) => p.id),
        },
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${tournamentId}/tiebreaks/${tiebreak.id}`,
      );
    }
  };

  const getActivePlayersForRound = (round: number) => {
    if (round <= hits) return tiebreak.playerIds;
    const totals = tiebreak.playerIds.map((id: string) => {
      let total = 0;
      for (let r = 1; r < round; r++) total += scores[id]?.[r] || 0;
      return { id, total };
    });
    const activeIds = new Set<string>();
    totals.forEach((t1: any) => {
      totals.forEach((t2: any) => {
        if (t1.id !== t2.id && t1.total === t2.total) activeIds.add(t1.id);
      });
    });
    return Array.from(activeIds);
  };

  const calculatePlacements = () =>
    tiebreak.playerIds
      .map((id: string) => {
        let total = 0;
        Object.values(scores[id] || {}).forEach((val) => (total += val as number));
        return { id, total };
      })
      .sort((a: any, b: any) => b.total - a.total);

  const getPlayerName = (id: string) => {
    const idx = tiebreak.playerIds.indexOf(id);
    return tiebreak.playerNames[idx] || id;
  };

  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading, sans-serif)",
    fontWeight: "var(--heading-weight, 700)" as any,
    textTransform: "var(--heading-transform, none)" as any,
    fontStyle: "var(--heading-style, normal)",
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Tiebreak-Gruppe</span>
          {tiebreak.spinWheelShown && (
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
              Zielzahl: {tiebreak.targetNumber}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* SpinWheel-Phase: Losung noch nicht bestätigt */}
        {showSpinWheel && (
          <div className="py-2">
            {isAdmin ? (
              <SpinWheel
                targetNumber={tiebreak.targetNumber}
                onComplete={confirmSpinWheel}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-zinc-500">
                  Der Admin lost gerade die Zielzahl aus…
                </p>
                <div className="text-4xl font-black text-zinc-300">?</div>
              </div>
            )}
          </div>
        )}

        {/* Reihenfolge-Phase: Losung bestätigt, noch nicht gestartet */}
        {tiebreak.status === "pending" && tiebreak.spinWheelShown && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Wurffolge für den Tiebreak festlegen ({hits} Pfeile auf{" "}
              <strong>{tiebreak.targetNumber}</strong>).
            </p>
            {order.map((pId: string, idx: number) => (
              <div
                key={pId}
                className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-3 rounded border dark:border-zinc-800"
              >
                <span className="font-medium" style={headingStyle}>
                  {idx + 1}. {getPlayerName(pId)}
                </span>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => movePlayer(idx, "up")}
                      disabled={idx === 0}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => movePlayer(idx, "down")}
                      disabled={idx === order.length - 1}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <Button onClick={startTiebreak} className="w-full mt-4">
                <Play className="w-4 h-4 mr-2" /> Tiebreak starten
              </Button>
            )}
          </div>
        )}

        {/* Spielphase */}
        {tiebreak.status !== "pending" && (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2">Spieler</th>
                    {Array.from({
                      length: Math.max(hits, tiebreak.currentRound),
                    }).map((_, i) => (
                      <th key={i} className="px-4 py-2 text-center">
                        R{i + 1}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-center font-bold">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {tiebreak.playerIds.map((pId: string) => {
                    let total = 0;
                    return (
                      <tr key={pId} className="border-b dark:border-zinc-800">
                        <td className="px-4 py-2 font-medium" style={headingStyle}>
                          {getPlayerName(pId)}
                        </td>
                        {Array.from({
                          length: Math.max(hits, tiebreak.currentRound),
                        }).map((_, i) => {
                          const round = i + 1;
                          const score = scores[pId]?.[round];
                          if (score !== undefined) total += score;

                          const isActive =
                            tiebreak.status === "in_progress" &&
                            round === tiebreak.currentRound &&
                            getActivePlayersForRound(round).includes(pId);

                          return (
                            <td key={round} className="px-2 py-2 text-center">
                              {isActive && isAdmin ? (
                                <div className="flex justify-center gap-1">
                                  {Array.from({ length: hits + 1 }, (_, i) => i).map((v) => (
                                    <button
                                      key={v}
                                      onClick={() => setScore(pId, round, v)}
                                      className={`w-8 h-8 rounded text-sm font-bold transition-colors ${
                                        scores[pId]?.[round] === v
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                      }`}
                                    >
                                      {v}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span>{score !== undefined ? score : "-"}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-center font-bold">
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {tiebreak.status === "in_progress" && (
              <p className="text-xs text-zinc-400 text-center">
                Runde {tiebreak.currentRound} · {hits} Pfeile auf Zahl{" "}
                <strong>{tiebreak.targetNumber}</strong>
              </p>
            )}

            {tiebreak.status === "in_progress" && isAdmin && (
              <div className="flex justify-end gap-4">
                <Button onClick={saveRound} variant="outline">
                  Runde {tiebreak.currentRound} speichern
                </Button>
                {tiebreak.currentRound >= hits && (
                  <Button
                    onClick={completeTiebreak}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" /> Tiebreak abschließen
                  </Button>
                )}
              </div>
            )}

            {tiebreak.status === "completed" && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 p-4 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span className="font-medium">
                  Tiebreak abgeschlossen. Reihenfolge festgestellt.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
