"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCheckoutSuggestion } from "@/lib/checkout";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  increment,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ArrowLeft, Radius, Undo2, ChevronRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Multiplier = "single" | "double" | "triple";

interface Dart {
  multiplier: Multiplier;
  baseValue: number;
  scoredPoints: number;
}

export default function MatchPage() {
  const { id, matchId } = useParams() as { id: string; matchId: string };
  const { user, isAuthReady } = useFirebase();
  const router = useRouter();

  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [currentDarts, setCurrentDarts] = useState<Dart[]>([]);
  const [multiplier, setMultiplier] = useState<Multiplier>("single");
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user || !id || !matchId) return;

    const unsubMatch = onSnapshot(
      doc(db, "tournaments", id, "matches", matchId),
      (docSnap) => {
        if (docSnap.exists()) {
          setMatch({ id: docSnap.id, ...docSnap.data() });
        } else {
          router.push(`/tournament/${id}`);
        }
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.GET,
          `tournaments/${id}/matches/${matchId}`,
        ),
    );

    const unsubTournament = onSnapshot(
      doc(db, "tournaments", id),
      (docSnap) => {
        if (docSnap.exists()) {
          setTournament({ id: docSnap.id, ...docSnap.data() });
        }
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, `tournaments/${id}`),
    );

    return () => {
      unsubMatch();
      unsubTournament();
    };
  }, [id, matchId, user, isAuthReady, router]);

  useEffect(() => {
    if (!match || match.status !== "completed") return;

    const findNextMatch = async () => {
      try {
        const matchesRef = collection(db, "tournaments", id, "matches");
        const q = query(
          matchesRef,
          where("status", "in", ["pending", "in_progress"]),
        );
        const snapshot = await getDocs(q);
        const matches = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as any,
        );

        let next = matches.find((m) => m.phase === match.phase);
        if (!next) {
          next = matches[0];
        }

        if (next) {
          setNextMatchId(next.id);
        }
      } catch (error) {
        console.error("Error finding next match", error);
      }
    };

    findNextMatch();
  }, [match, id]);

  const setStarter = async (playerId: string) => {
    try {
      await updateDoc(doc(db, "tournaments", id, "matches", matchId), {
        status: "in_progress",
        playerAStartsLeg: playerId === match.playerAId,
        currentTurnId: playerId,
        playerADartsThrown: 0,
        playerBDartsThrown: 0,
        playerAScored: 0,
        playerBScored: 0,
        turns: [],
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${id}/matches/${matchId}`,
      );
    }
  };

  const handleDartInput = async (baseValue: number) => {
    if (baseValue === 25 && multiplier === "triple") {
      setMultiplier("single");
      return;
    }

    let mult = multiplier;
    if (baseValue === 0) mult = "single";

    const scoredPoints =
      baseValue === 25 && mult === "double"
        ? 50
        : baseValue * (mult === "single" ? 1 : mult === "double" ? 2 : 3);

    const newDart: Dart = {
      multiplier: mult,
      baseValue,
      scoredPoints,
    };

    const newDarts = [...currentDarts, newDart];
    setCurrentDarts(newDarts);
    setMultiplier("single");

    const isPlayerA = match.currentTurnId === match.playerAId;
    const currentRest = isPlayerA ? match.playerARest : match.playerBRest;
    const turnScore = newDarts.reduce((sum, d) => sum + d.scoredPoints, 0);
    const newRest = currentRest - turnScore;

    let isBust = false;
    let isCheckout = false;

    const allowSingleOut = tournament?.allowSingleOut || false;
    const allowDoubleOut = tournament?.allowDoubleOut !== false; // default true
    const allowTripleOut = tournament?.allowTripleOut || false;

    if (newRest < 0) {
      isBust = true;
    } else if (newRest === 1 && !allowSingleOut) {
      isBust = true;
    } else if (newRest === 0) {
      const isBull = baseValue === 25 && mult === "single";
      const isBullsEye = baseValue === 25 && mult === "double";

      let validCheckout = false;

      if (allowSingleOut && (mult === "single" || isBull || isBullsEye))
        validCheckout = true;
      if (allowDoubleOut && (mult === "double" || isBull || isBullsEye))
        validCheckout = true;
      if (allowTripleOut && (mult === "triple" || isBull || isBullsEye))
        validCheckout = true;

      if (validCheckout) {
        isCheckout = true;
      } else {
        isBust = true;
      }
    }

    if (newDarts.length === 3 || isBust || isCheckout) {
      await submitTurn(newDarts, isBust, isCheckout, newRest);
    }
  };

  const submitTurn = async (
    darts: Dart[],
    isBust: boolean,
    isCheckout: boolean,
    newRest: number,
  ) => {
    const isPlayerA = match.currentTurnId === match.playerAId;
    const turnScore = darts.reduce((sum, d) => sum + d.scoredPoints, 0);

    let updates: any = {};

    setHistory([
      ...history,
      {
        playerARest: match.playerARest,
        playerBRest: match.playerBRest,
        currentTurnId: match.currentTurnId,
        answerThrowActive: match.answerThrowActive,
        status: match.status,
        playerADartsThrown: match.playerADartsThrown || 0,
        playerBDartsThrown: match.playerBDartsThrown || 0,
        playerAScored: match.playerAScored || 0,
        playerBScored: match.playerBScored || 0,
        turns: match.turns || [],
      },
    ]);

    const newTurn = {
      playerId: match.currentTurnId,
      darts,
      totalScored: isBust ? 0 : turnScore,
      isBust,
    };

    updates.turns = [...(match.turns || []), newTurn];

    if (isPlayerA) {
      updates.playerADartsThrown =
        (match.playerADartsThrown || 0) + darts.length;
      if (!isBust) {
        updates.playerAScored = (match.playerAScored || 0) + turnScore;
        updates.playerARest = newRest;
      }
    } else {
      updates.playerBDartsThrown =
        (match.playerBDartsThrown || 0) + darts.length;
      if (!isBust) {
        updates.playerBScored = (match.playerBScored || 0) + turnScore;
        updates.playerBRest = newRest;
      }
    }

    let legEnded = false;
    let winnerId = "";
    let isDraw = false;

    if (isCheckout) {
      const isBestOfOne = match.format?.includes("bo1");
      const allowDraw = tournament?.allowDraw && isBestOfOne;

      if (match.answerThrowActive) {
        legEnded = true;
        isDraw = true;
      } else {
        if (
          allowDraw &&
          match.currentTurnId ===
            (match.playerAStartsLeg ? match.playerAId : match.playerBId)
        ) {
          updates.answerThrowActive = true;
          updates.currentTurnId = match.playerAStartsLeg
            ? match.playerBId
            : match.playerAId;
        } else {
          legEnded = true;
          winnerId = match.currentTurnId;
        }
      }
    } else {
      if (match.answerThrowActive) {
        legEnded = true;
        winnerId = match.playerAStartsLeg ? match.playerAId : match.playerBId;
      } else {
        updates.currentTurnId = isPlayerA ? match.playerBId : match.playerAId;
      }
    }

    if (legEnded) {
      const bestOfMatch = match.format?.match(/bo(\d+)/);
      const bestOf = bestOfMatch ? parseInt(bestOfMatch[1]) : 1;
      const legsNeededToWin = Math.ceil(bestOf / 2);

      let newPlayerALegs = match.playerALegs || 0;
      let newPlayerBLegs = match.playerBLegs || 0;

      if (winnerId === match.playerAId) newPlayerALegs++;
      if (winnerId === match.playerBId) newPlayerBLegs++;

      const matchFullyEnded =
        newPlayerALegs >= legsNeededToWin ||
        newPlayerBLegs >= legsNeededToWin ||
        isDraw;

      if (matchFullyEnded) {
        updates.status = "completed";
        updates.playerALegs = newPlayerALegs;
        updates.playerBLegs = newPlayerBLegs;
        if (winnerId)
          updates.winnerId =
            newPlayerALegs > newPlayerBLegs ? match.playerAId : match.playerBId;
        if (isDraw) updates.isDraw = true;

        if (match.phase === "group") {
          try {
            const pARef = doc(
              db,
              "tournaments",
              id,
              "players",
              match.playerAId,
            );
            const pBRef = doc(
              db,
              "tournaments",
              id,
              "players",
              match.playerBId,
            );
            const globalPARef = doc(db, "players", match.playerAId);
            const globalPBRef = doc(db, "players", match.playerBId);

            if (isDraw) {
              await updateDoc(pARef, {
                points: increment(1),
                matchesPlayed: increment(1),
                draws: increment(1),
              });
              await updateDoc(pBRef, {
                points: increment(1),
                matchesPlayed: increment(1),
                draws: increment(1),
              });
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                draws: increment(1),
              });
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                draws: increment(1),
              });
            } else if (updates.winnerId === match.playerAId) {
              await updateDoc(pARef, {
                points: increment(2),
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(pBRef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
            } else {
              await updateDoc(pBRef, {
                points: increment(2),
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(pARef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
            }
          } catch (error) {
            console.error("Error updating player stats", error);
          }
        } else if (tournament?.type !== 'single_match') {
          try {
            const globalPARef = doc(db, "players", match.playerAId);
            const globalPBRef = doc(db, "players", match.playerBId);

            if (isDraw) {
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                draws: increment(1),
              });
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                draws: increment(1),
              });
            } else if (updates.winnerId === match.playerAId) {
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
            } else {
              await updateDoc(globalPBRef, {
                matchesPlayed: increment(1),
                wins: increment(1),
              });
              await updateDoc(globalPARef, {
                matchesPlayed: increment(1),
                losses: increment(1),
              });
            }
          } catch (error) {
            console.error("Error updating player stats", error);
          }
        }
      } else {
        updates.playerALegs = newPlayerALegs;
        updates.playerBLegs = newPlayerBLegs;
        updates.currentLeg = (match.currentLeg || 1) + 1;
        updates.playerAStartsLeg = !match.playerAStartsLeg;
        updates.currentTurnId = updates.playerAStartsLeg
          ? match.playerAId
          : match.playerBId;
        const rest = match.format?.startsWith("501") ? 501 : 301;
        updates.playerARest = rest;
        updates.playerBRest = rest;
        updates.answerThrowActive = false;
        updates.playerADartsThrown = 0;
        updates.playerBDartsThrown = 0;
        updates.playerAScored = 0;
        updates.playerBScored = 0;
        updates.turns = [];
      }
    }

    try {
      await updateDoc(doc(db, "tournaments", id, "matches", matchId), updates);
      setCurrentDarts([]);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `tournaments/${id}/matches/${matchId}`,
      );
    }
  };

  const handleUndo = async () => {
    if (currentDarts.length > 0) {
      setCurrentDarts(currentDarts.slice(0, -1));
      setMultiplier("single");
    } else if (history.length > 0) {
      const lastState = history[history.length - 1];
      const lastTurn =
        match.turns && match.turns.length > 0
          ? match.turns[match.turns.length - 1]
          : null;
      try {
        await updateDoc(
          doc(db, "tournaments", id, "matches", matchId),
          lastState,
        );
        setHistory(history.slice(0, -1));
        if (lastTurn && lastTurn.darts && lastTurn.darts.length > 0) {
          setCurrentDarts(lastTurn.darts.slice(0, -1));
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `tournaments/${id}/matches/${matchId}`,
        );
      }
    }
  };

  if (!match) return <div className="p-8">Loading...</div>;

  if (match.status === "pending") {
    return (
      <div className="flex-1 bg-zinc-50 p-4 md:p-8 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-6">
            <h2 className="text-2xl font-bold">Who starts?</h2>
            <div className="grid grid-cols-2 gap-4">
              <Button size="lg" onClick={() => setStarter(match.playerAId)}>
                {match.playerAName}
              </Button>
              <Button size="lg" onClick={() => setStarter(match.playerBId)}>
                {match.playerBName}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgA = match.playerADartsThrown
    ? ((match.playerAScored / match.playerADartsThrown) * 3).toFixed(2)
    : "0.00";
  const avgB = match.playerBDartsThrown
    ? ((match.playerBScored / match.playerBDartsThrown) * 3).toFixed(2)
    : "0.00";

  const formatDart = (d: Dart) => {
    if (d.baseValue === 0) return "0";
    if (d.baseValue === 25) return d.multiplier === "double" ? "D25" : "25";
    return `${d.multiplier === "double" ? "D" : d.multiplier === "triple" ? "T" : ""}${d.baseValue}`;
  };

  const renderPlayerRow = (isPlayerA: boolean) => {
    const isActive =
      match.currentTurnId === (isPlayerA ? match.playerAId : match.playerBId);
    const name = isPlayerA ? match.playerAName : match.playerBName;
    const rest = isPlayerA ? match.playerARest : match.playerBRest;
    const dartsThrown = isPlayerA
      ? match.playerADartsThrown || 0
      : match.playerBDartsThrown || 0;
    const avg = isPlayerA ? avgA : avgB;

    let displayDarts: Dart[] = [];
    let turnTotal = 0;

    if (isActive) {
      displayDarts = currentDarts;
      turnTotal = currentDarts.reduce((sum, d) => sum + d.scoredPoints, 0);
    } else {
      const playerTurns = (match.turns || []).filter(
        (t: any) =>
          t.playerId === (isPlayerA ? match.playerAId : match.playerBId),
      );
      if (playerTurns.length > 0) {
        const lastTurn = playerTurns[playerTurns.length - 1];
        displayDarts = lastTurn.darts;
        turnTotal = lastTurn.totalScored;
      }
    }

    return (
      <div
        className={`flex border-b dark:border-zinc-800 ${isActive ? "bg-blue-50/50 dark:bg-blue-900/20" : "bg-white dark:bg-zinc-900"}`}
      >
        <div
          className={`w-2 ${isActive ? "bg-red-600" : "bg-transparent"}`}
        ></div>
        <div className="flex-1 p-4 flex flex-col justify-center border-r">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-zinc-500 flex items-center gap-1">
              <Radius className="w-3 h-3" />{" "}
              {dartsThrown + (isActive ? currentDarts.length : 0)}
            </span>
          </div>
          <div className="text-4xl sm:text-6xl font-bold tracking-tighter">
            {rest - (isActive ? turnTotal : 0)}
          </div>
          <div className="text-base sm:text-lg text-zinc-600 mt-1">{name}</div>
        </div>
        <div className="flex-[2] flex flex-col">
          <div className="flex flex-1 border-b">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex-1 border-r flex items-center justify-center text-xl sm:text-2xl font-medium"
              >
                {displayDarts[i] ? formatDart(displayDarts[i]) : ""}
              </div>
            ))}
            <div className="flex-1 flex items-center justify-center text-xl sm:text-2xl font-medium bg-zinc-50">
              {displayDarts.length > 0 ? turnTotal : ""}
            </div>
          </div>
          <div className="flex flex-1">
            <div className="flex-[3] border-r flex items-center justify-center text-2xl sm:text-3xl font-bold">
              {displayDarts.length > 0 ? turnTotal : ""}
            </div>
            <div className="flex-1 flex items-center justify-center text-lg sm:text-xl text-zinc-600 bg-zinc-50">
              Ø {avg}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-theme(spacing.16))]">
      <div className="bg-slate-800 text-white p-2 flex items-center justify-between shadow-md">
        <Button
          variant="ghost"
          className="text-zinc-300 hover:text-white"
          onClick={() =>
            router.push(
              tournament?.type === "single_match" ? "/" : `/tournament/${id}`,
            )
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="text-sm font-medium">
          {match.format?.replace("_bo", " (Best of ") + ")"}
          {match.answerThrowActive && (
            <span className="ml-4 text-orange-400 font-bold uppercase">
              Answer Throw Active!
            </span>
          )}
        </div>
        <div className="w-20"></div>
      </div>

      <div className="flex-1 w-full flex flex-col lg:flex-row bg-white dark:bg-zinc-900 shadow-lg mt-0 overflow-hidden">
        {/* Scoreboard */}
        <div className="flex flex-col border-b-4 lg:border-b-0 lg:border-r-4 border-slate-800 flex-1">
          {renderPlayerRow(true)}
          {renderPlayerRow(false)}
        </div>

        {match.status === "completed" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-50">
            <h2 className="text-3xl font-bold mb-2">Match Finished</h2>
            <p className="text-xl text-zinc-600 mb-6">
              {match.isDraw
                ? "Draw (1:1 Points)"
                : `${match.winnerId === match.playerAId ? match.playerAName : match.playerBName} wins!`}
            </p>
            <div className="flex gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  router.push(
                    tournament?.type === "single_match"
                      ? "/"
                      : `/tournament/${id}`,
                  )
                }
              >
                {tournament?.type === "single_match"
                  ? "Return to Dashboard"
                  : "Return to Tournament"}
              </Button>
              {nextMatchId && (
                <Button
                  size="lg"
                  onClick={() =>
                    router.push(`/tournament/${id}/match/${nextMatchId}`)
                  }
                >
                  Next Match <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-zinc-200 p-2 flex flex-col">
            <div className="text-center py-2 text-zinc-600 font-medium flex justify-between px-4">
              <span>
                Leg {match.currentLeg},{" "}
                {match.currentTurnId === match.playerAId
                  ? match.playerAName
                  : match.playerBName}{" "}
                is throwing.
              </span>
              {getCheckoutSuggestion(
                (match.currentTurnId === match.playerAId
                  ? match.playerARest
                  : match.playerBRest) -
                  currentDarts.reduce((sum, d) => sum + d.scoredPoints, 0),
                3 - currentDarts.length,
              ) && (
                <span className="text-green-700 font-bold">
                  Route:{" "}
                  {getCheckoutSuggestion(
                    (match.currentTurnId === match.playerAId
                      ? match.playerARest
                      : match.playerBRest) -
                      currentDarts.reduce((sum, d) => sum + d.scoredPoints, 0),
                    3 - currentDarts.length,
                  )}
                </span>
              )}
            </div>

            {/* Number Pad */}
            <div className="flex-1 grid grid-cols-7 gap-1 p-1">
              {[
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                19, 20, 25,
              ].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-full text-lg sm:text-xl font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none border-zinc-300 dark:border-zinc-700"
                  onClick={() => handleDartInput(num)}
                >
                  {num}
                </Button>
              ))}

              <Button
                variant="outline"
                className="h-full text-lg sm:text-xl font-bold bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none border-zinc-300 dark:border-zinc-700 col-span-1"
                onClick={() => handleDartInput(0)}
              >
                0
              </Button>
              <Button
                className={`h-full text-sm sm:text-xl font-bold rounded-none col-span-2 ${multiplier === "double" ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}
                onClick={() =>
                  setMultiplier(multiplier === "double" ? "single" : "double")
                }
              >
                DOUBLE
              </Button>
              <Button
                className={`h-full text-sm sm:text-xl font-bold rounded-none col-span-2 ${multiplier === "triple" ? "bg-red-700 hover:bg-red-800 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
                onClick={() =>
                  setMultiplier(multiplier === "triple" ? "single" : "triple")
                }
              >
                TRIPLE
              </Button>
              <Button
                className="h-full text-sm sm:text-xl font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-none col-span-2"
                onClick={handleUndo}
                disabled={currentDarts.length === 0 && history.length === 0}
              >
                ZURÜCK
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
