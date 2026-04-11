import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { ArrowUp, ArrowDown, Check, Play } from "lucide-react";

interface TiebreakProps {
  tournamentId: string;
  tiebreak: any;
  isAdmin: boolean;
}

export function TiebreakManager({
  tournamentId,
  tiebreak,
  isAdmin,
}: TiebreakProps) {
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [scores, setScores] = useState<Record<string, Record<number, number>>>(
    tiebreak.scores || {},
  );

  const order =
    tiebreak.status === "pending"
      ? manualOrder || tiebreak.playerIds
      : tiebreak.playerIds;

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

  const startTiebreak = async () => {
    if (!isAdmin) return;
    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        {
          status: "in_progress",
          playerIds: order, // Save the manual order
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

  const handleScoreChange = (
    playerId: string,
    round: number,
    value: string,
  ) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0 || num > 3) return;

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [round]: num,
      },
    }));
  };

  const saveRound = async () => {
    if (!isAdmin) return;

    // Check if all active players have a score for the current round
    const activePlayers = getActivePlayersForRound(tiebreak.currentRound);
    for (const pId of activePlayers) {
      if (scores[pId]?.[tiebreak.currentRound] === undefined) {
        alert("Please enter scores for all active players.");
        return;
      }
    }

    try {
      await updateDoc(
        doc(db, "tournaments", tournamentId, "tiebreaks", tiebreak.id),
        {
          scores,
          currentRound: tiebreak.currentRound + 1,
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

  const completeTiebreak = async () => {
    if (!isAdmin) return;

    // Calculate final placements
    const placements = calculatePlacements();
    // Check if there are still ties
    const hasTies = placements.some(
      (p: any, i: number, arr: any[]) => i > 0 && p.total === arr[i - 1].total,
    );

    if (hasTies) {
      alert(
        "There are still ties. Please play another round for the tied players.",
      );
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

  // Determine which players are still tied and need to play this round
  const getActivePlayersForRound = (round: number) => {
    if (round <= 3) return tiebreak.playerIds; // Everyone plays first 3 rounds

    // For round > 3, only players who are tied with someone else play
    const totals = tiebreak.playerIds.map((id: string) => {
      let total = 0;
      for (let r = 1; r < round; r++) {
        total += scores[id]?.[r] || 0;
      }
      return { id, total };
    });

    const activeIds = new Set<string>();
    totals.forEach((t1: any) => {
      totals.forEach((t2: any) => {
        if (t1.id !== t2.id && t1.total === t2.total) {
          activeIds.add(t1.id);
        }
      });
    });

    return Array.from(activeIds);
  };

  const calculatePlacements = () => {
    return tiebreak.playerIds
      .map((id: string) => {
        let total = 0;
        Object.values(scores[id] || {}).forEach((val) => (total += val));
        return { id, total };
      })
      .sort((a: any, b: any) => b.total - a.total);
  };

  const getPlayerName = (id: string) => {
    const idx = tiebreak.playerIds.indexOf(id);
    return tiebreak.playerNames[idx] || id;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Tiebreak Group</span>
          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
            Target: {tiebreak.targetNumber}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tiebreak.status === "pending" ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              Set the throwing order for the tiebreak.
            </p>
            {order.map((pId: string, idx: number) => (
              <div
                key={pId}
                className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-3 rounded border dark:border-zinc-800"
              >
                <span className="font-medium">
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
                <Play className="w-4 h-4 mr-2" /> Start Tiebreak
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2">Player</th>
                    {Array.from({
                      length: Math.max(3, tiebreak.currentRound),
                    }).map((_, i) => (
                      <th key={i} className="px-4 py-2 text-center">
                        R{i + 1}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tiebreak.playerIds.map((pId: string) => {
                    let total = 0;
                    return (
                      <tr key={pId} className="border-b dark:border-zinc-800">
                        <td className="px-4 py-2 font-medium">
                          {getPlayerName(pId)}
                        </td>
                        {Array.from({
                          length: Math.max(3, tiebreak.currentRound),
                        }).map((_, i) => {
                          const round = i + 1;
                          const score = scores[pId]?.[round];
                          if (score !== undefined) total += score;

                          const isActive =
                            tiebreak.status === "in_progress" &&
                            round === tiebreak.currentRound &&
                            getActivePlayersForRound(round).includes(pId);

                          return (
                            <td key={round} className="px-4 py-2 text-center">
                              {isActive && isAdmin ? (
                                <Input
                                  type="number"
                                  min="0"
                                  max="3"
                                  className="w-16 mx-auto text-center"
                                  value={scores[pId]?.[round] ?? ""}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      pId,
                                      round,
                                      e.target.value,
                                    )
                                  }
                                />
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

            {tiebreak.status === "in_progress" && isAdmin && (
              <div className="flex justify-end gap-4">
                <Button onClick={saveRound} variant="outline">
                  Save Round {tiebreak.currentRound}
                </Button>
                {tiebreak.currentRound >= 3 && (
                  <Button
                    onClick={completeTiebreak}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" /> Complete Tiebreak
                  </Button>
                )}
              </div>
            )}

            {tiebreak.status === "completed" && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-400 p-4 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span className="font-medium">
                  Tiebreak completed. Final order determined.
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
