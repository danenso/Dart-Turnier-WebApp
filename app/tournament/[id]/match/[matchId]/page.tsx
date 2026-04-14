"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SongPlayer } from "@/components/SongPlayer";
import { getCheckoutSuggestion } from "@/lib/checkout";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  increment,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { ArrowLeft, Radius, Undo2, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BOT_PLAYER_ID, generateAITurn, AI_DIFFICULTY_LABELS, type AIDifficulty } from "@/lib/ai-player";

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
  const [playerAProfile, setPlayerAProfile] = useState<any>(null);
  const [playerBProfile, setPlayerBProfile] = useState<any>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const submitTurnRef = useRef<typeof submitTurn | null>(null);
  const aiThinkingRef = useRef(false);

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

  useEffect(() => {
    if (!match?.playerAId || !match?.playerBId) return;
    const fetchProfiles = async () => {
      try {
        const [snapA, snapB] = await Promise.all([
          getDoc(doc(db, "players", match.playerAId)),
          getDoc(doc(db, "players", match.playerBId)),
        ]);
        if (snapA.exists()) setPlayerAProfile({ id: snapA.id, ...snapA.data() });
        if (snapB.exists()) setPlayerBProfile({ id: snapB.id, ...snapB.data() });
      } catch (e) {
        console.error("Fehler beim Laden der Spielerprofile", e);
      }
    };
    fetchProfiles();
  }, [match?.playerAId, match?.playerBId]);

  const playSound = (file: string, waitForCurrent = false) => {
    if (!voiceEnabled) return;
    const play = () => {
      // Etwaige ausstehende Callbacks vom vorherigen Sound löschen
      if (currentAudioRef.current) currentAudioRef.current.onended = null;
      const audio = new Audio(`/sounds/dart/${file}.mp3`);
      audio.volume = 1;
      currentAudioRef.current = audio;
      audio.play().catch(() => {/* Autoplay-Policy: stumm ignorieren */});
    };
    const prev = currentAudioRef.current;
    if (waitForCurrent && prev && !prev.ended && !prev.paused) {
      // Vorherigen pending Callback überschreiben – nur der neueste zählt
      prev.onended = play;
    } else {
      play();
    }
  };

  const speakDart = (baseValue: number, mult: string) => {
    if (baseValue === 0) playSound("miss");
    else if (baseValue === 25 && mult === "double") playSound("bullseye");
    else if (baseValue === 25) playSound("25");
    else if (mult === "double") playSound(`d${baseValue}`);
    else if (mult === "triple") playSound(`t${baseValue}`);
    else playSound(String(baseValue));
  };

  const setStarter = async (playerId: string) => {
    playSound("gameon");
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

    speakDart(baseValue, mult);

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

    // Sound-Events für die Runde
    if (isBust) {
      playSound("bust", true);
    } else if (turnScore === 180) {
      playSound("180", true);
    }

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
        if (isDraw) playSound("draw", true);
        else playSound("gameshot", true);

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

  // Ref immer auf die frische submitTurn-Instanz zeigen lassen
  submitTurnRef.current = submitTurn;

  // ── KI-Zug automatisch ausführen ─────────────────────────────────────────
  useEffect(() => {
    if (!match || !tournament?.isVsAI) return;
    if (match.status !== "in_progress") return;
    if (match.currentTurnId !== BOT_PLAYER_ID) return;
    if (aiThinkingRef.current) return;

    aiThinkingRef.current = true;
    setAiThinking(true);

    // KI "denkt" kurz nach (Realismus)
    const thinkTime = 900 + Math.random() * 900;
    const timeout = setTimeout(async () => {
      const difficulty: AIDifficulty = tournament.aiDifficulty ?? "medium";
      const rest = match.playerBRest;

      const result = generateAITurn(
        rest,
        difficulty,
        tournament.allowSingleOut || false,
        tournament.allowDoubleOut !== false,
        tournament.allowTripleOut || false,
      );

      if (submitTurnRef.current) {
        await submitTurnRef.current(result.darts, result.isBust, result.isCheckout, result.newRest);
      }

      setAiThinking(false);
      aiThinkingRef.current = false;
    }, thinkTime);

    return () => {
      clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.currentTurnId, match?.status, tournament?.isVsAI]);

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
    const formatMatch = match.format?.match(/^(301|501)_bo(\d+)$/);
    const bestOf = formatMatch ? parseInt(formatMatch[2]) : 1;
    const isSingleMatch = tournament?.type === "single_match";
    const venueLabel = isSingleMatch
      ? "Freispiel"
      : tournament?.name ?? "Turnier";
    const isVsAI = tournament?.isVsAI === true;

    const renderPlayerCard = (isA: boolean) => {
      const profile = isA ? playerAProfile : playerBProfile;
      const playerId = isA ? match.playerAId : match.playerBId;
      const playerName = isA ? match.playerAName : match.playerBName;
      const animClass = isA ? "match-slide-left" : "match-slide-right";
      const isBot = playerId === BOT_PLAYER_ID;

      return (
        <div
          className={`flex flex-col items-center gap-3 w-full max-w-xs mx-auto ${animClass}`}
          style={{ animationDelay: "0.1s" }}
        >
          {/* Avatar */}
          <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden border-4 shadow-2xl shrink-0 ${
            isBot
              ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center"
              : "border-zinc-900/15 dark:border-white/20 bg-zinc-300 dark:bg-zinc-700"
          }`}>
            {isBot ? (
              <span className="text-5xl md:text-6xl select-none">🤖</span>
            ) : profile?.avatar ? (
              <img src={profile.avatar} alt={playerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl md:text-4xl font-bold text-zinc-500 dark:text-white/60">
                {playerName?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>

          {isBot && tournament?.aiDifficulty && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium px-3 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-full border border-amber-200 dark:border-amber-800">
              {AI_DIFFICULTY_LABELS[tournament.aiDifficulty as AIDifficulty]}
            </p>
          )}

          {/* Nickname */}
          {!isBot && profile?.nickname && (
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 italic tracking-wide truncate max-w-full px-2">
              &ldquo;{profile.nickname}&rdquo;
            </p>
          )}

          {/* Name als Button — Bot-Karte startet immer mit Mensch */}
          <button
            onClick={() => isBot ? setStarter(match.playerAId) : setStarter(playerId)}
            className={`group relative w-full px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold text-base md:text-lg
              active:scale-95 transition-all duration-200 shadow-lg focus:outline-none
              ${isBot
                ? "text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-400/40 hover:bg-amber-500/20 hover:border-amber-400/60 focus:ring-2 focus:ring-amber-400/40"
                : "text-zinc-800 dark:text-white bg-zinc-900/8 border border-zinc-900/15 hover:bg-zinc-900/15 hover:border-zinc-900/25 dark:bg-white/10 dark:border-white/20 dark:hover:bg-white/20 dark:hover:border-white/40 focus:ring-2 focus:ring-zinc-900/25 dark:focus:ring-white/40"
              }`}
          >
            <span className="relative z-10">{playerName}</span>
          </button>

          {/* Song Player */}
          {!isBot && profile?.songUrl && (
            <div className="w-full mt-1">
              <SongPlayer
                playerId={playerId}
                songUrl={profile.songUrl}
                songTitle={profile.songTitle || "Einlaufsong"}
                songArtist={profile.songArtist || ""}
              />
            </div>
          )}
        </div>
      );
    };

    return (
      <>
        <style>{`
          @keyframes matchSlideLeft {
            from { opacity: 0; transform: translateX(-60px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes matchSlideRight {
            from { opacity: 0; transform: translateX(60px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes matchScaleIn {
            from { opacity: 0; transform: scale(0.4); }
            to   { opacity: 1; transform: scale(1); }
          }
          @keyframes matchFadeDown {
            from { opacity: 0; transform: translateY(-20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes matchFadeUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .match-slide-left  { animation: matchSlideLeft  0.55s cubic-bezier(0.22,1,0.36,1) both; }
          .match-slide-right { animation: matchSlideRight 0.55s cubic-bezier(0.22,1,0.36,1) both; }
          .match-scale-in    { animation: matchScaleIn    0.6s  cubic-bezier(0.34,1.56,0.64,1) 0.2s both; }
          .match-fade-down   { animation: matchFadeDown   0.5s  ease-out both; }
          .match-fade-up     { animation: matchFadeUp     0.5s  ease-out 0.35s both; }
        `}</style>

        <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 overflow-auto">

          {/* Top: Format Badge */}
          <div className="flex justify-center pt-6 pb-2 match-fade-down">
            <div className="px-5 py-1.5 rounded-full bg-zinc-900/8 border border-zinc-900/15 text-zinc-700 dark:bg-white/10 dark:border-white/20 dark:text-white/80 text-sm font-semibold tracking-widest uppercase">
              Best of {bestOf}
            </div>
          </div>

          {/* Question */}
          <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm md:text-base mt-1 match-fade-down" style={{ animationDelay: "0.05s" }}>
            Wer beginnt das Spiel?
          </p>

          {/* Main area: Players + VS */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0 px-4 md:px-8 py-6">

            {/* Player A */}
            <div className="w-full md:flex-1 flex justify-center">
              {renderPlayerCard(true)}
            </div>

            {/* VS */}
            <div className="flex items-center justify-center px-4 md:px-8 match-scale-in shrink-0">
              <span className="text-5xl md:text-7xl lg:text-8xl font-black text-zinc-900/90 dark:text-white/90 tracking-tight select-none"
                style={{ textShadow: "0 0 40px rgba(0,0,0,0.08)" }}>
                VS
              </span>
            </div>

            {/* Player B */}
            <div className="w-full md:flex-1 flex justify-center">
              {renderPlayerCard(false)}
            </div>
          </div>

          {/* Bottom: Venue / Tournament name */}
          <div className="flex justify-center pb-6 pt-2 match-fade-up">
            <div className="px-5 py-1.5 rounded-full bg-zinc-900/5 border border-zinc-900/8 dark:bg-white/5 dark:border-white/10 text-zinc-500 dark:text-zinc-500 text-xs font-medium tracking-widest uppercase">
              {venueLabel}
            </div>
          </div>
        </div>
      </>
    );
  }

  const avgA = match.playerADartsThrown
    ? ((match.playerAScored / match.playerADartsThrown) * 3).toFixed(1)
    : "–";
  const avgB = match.playerBDartsThrown
    ? ((match.playerBScored / match.playerBDartsThrown) * 3).toFixed(1)
    : "–";

  const formatDart = (d: Dart) => {
    if (d.baseValue === 0) return "0";
    if (d.baseValue === 25) return d.multiplier === "double" ? "D25" : "25";
    return `${d.multiplier === "double" ? "D" : d.multiplier === "triple" ? "T" : ""}${d.baseValue}`;
  };

  const getHighScore = (isPlayerA: boolean) => {
    const pid = isPlayerA ? match.playerAId : match.playerBId;
    const turns = (match.turns || []).filter(
      (t: any) => t.playerId === pid && !t.isBust,
    );
    if (!turns.length) return 0;
    return Math.max(...turns.map((t: any) => t.totalScored));
  };

  const formatBestOf = () => {
    const m = match.format?.match(/^(301|501)_bo(\d+)$/);
    if (!m) return match.format || "";
    return `${m[1]} · Best of ${m[2]}`;
  };

  const bestOfCount = (() => {
    const m = match.format?.match(/bo(\d+)/);
    return m ? parseInt(m[1]) : 1;
  })();

  const renderPlayerPanel = (isPlayerA: boolean) => {
    const isActive =
      match.currentTurnId === (isPlayerA ? match.playerAId : match.playerBId);
    const profile = isPlayerA ? playerAProfile : playerBProfile;
    const name = isPlayerA ? match.playerAName : match.playerBName;
    const rest = isPlayerA ? match.playerARest : match.playerBRest;
    const dartsThrown = isPlayerA
      ? match.playerADartsThrown || 0
      : match.playerBDartsThrown || 0;
    const avg = isPlayerA ? avgA : avgB;
    const legs = isPlayerA ? match.playerALegs || 0 : match.playerBLegs || 0;
    const highScore = getHighScore(isPlayerA);

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
    const displayRest = rest - (isActive ? turnTotal : 0);

    const scoreColor =
      displayRest <= 50
        ? "text-green-500 dark:text-green-400"
        : displayRest <= 100
          ? "text-yellow-500 dark:text-yellow-400"
          : "text-zinc-900 dark:text-white";

    // Nickname primär, Name sekundär
    const nameBlock = (compact: boolean) => (
      <div className="flex-1 min-w-0">
        {profile?.nickname ? (
          <>
            <div className={`font-black text-zinc-900 dark:text-white truncate leading-tight ${compact ? "text-base" : "text-xl"}`}>
              {profile.nickname}
            </div>
            <div className={`text-zinc-500 truncate leading-tight ${compact ? "text-[11px]" : "text-xs"}`}>
              {name}
            </div>
          </>
        ) : (
          <div className={`font-bold text-zinc-900 dark:text-white truncate leading-tight ${compact ? "text-base" : "text-xl"}`}>
            {name}
          </div>
        )}
      </div>
    );

    const isBot = (isPlayerA ? match.playerAId : match.playerBId) === BOT_PLAYER_ID;

    const avatarEl = (size: "sm" | "md" | "lg") => {
      const cls =
        size === "sm" ? "w-12 h-12" :
        size === "md" ? "w-14 h-14" :
        "w-16 h-16";
      const fontSize = size === "sm" ? "text-2xl" : size === "md" ? "text-3xl" : "text-4xl";
      return (
        <div className={`${cls} rounded-full overflow-hidden shrink-0 border-2 ${
          isBot
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400/50 flex items-center justify-center"
            : `bg-zinc-300 dark:bg-zinc-700 ${isActive ? "border-blue-400/50" : "border-zinc-300 dark:border-zinc-600"}`
        }`}>
          {isBot ? (
            <span className={`${fontSize} select-none`}>🤖</span>
          ) : profile?.avatar ? (
            <img src={profile.avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-bold text-lg text-zinc-600 dark:text-zinc-300">
              {name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
      );
    };

    const legsDots = (
      <div className="flex gap-1.5 shrink-0">
        {Array.from({ length: bestOfCount }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors duration-300 ${i < legs ? "bg-green-500 dark:bg-green-400 shadow-sm shadow-green-400/50" : "bg-zinc-300 dark:bg-zinc-700"}`}
          />
        ))}
      </div>
    );

    // Statistiken — skaliert groß
    const statsEl = (large: boolean) => (
      <div className={`flex items-center gap-3 flex-wrap ${large ? "text-sm" : "text-xs"}`}>
        <span className="flex items-center gap-1">
          <span className="text-zinc-500">Ø</span>
          <span className="text-zinc-800 dark:text-zinc-100 font-bold">{avg}</span>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-500">🎯</span>
          <span className="text-zinc-800 dark:text-zinc-100 font-bold">
            {dartsThrown + (isActive ? currentDarts.length : 0)}
          </span>
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-500">HS</span>
          <span className={`font-bold ${highScore === 180 ? "text-yellow-500 dark:text-yellow-400" : "text-zinc-800 dark:text-zinc-100"}`}>
            {highScore || "–"}
          </span>
        </span>
      </div>
    );

    // Pfeil-Anzeige — Display-Stil, kein Button-Optik
    const dartsDisplay = (large: boolean) => (
      <div className={`flex items-center gap-2 bg-zinc-200 dark:bg-black/40 rounded-lg px-3 ${large ? "py-2" : "py-1.5"} select-none`}>
        {[0, 1, 2].map((i) => (
          <span
            key={
              displayDarts[i]
                ? `${i}-${displayDarts[i].baseValue}-${displayDarts[i].multiplier}`
                : `${i}-empty`
            }
            className={`${large ? "text-sm" : "text-xs"} font-mono font-semibold tabular-nums ${
              displayDarts[i] ? "text-blue-500 dark:text-blue-300 dart-pop" : "text-zinc-400 dark:text-zinc-700"
            }`}
          >
            {displayDarts[i] ? formatDart(displayDarts[i]) : "–"}
          </span>
        ))}
        <span className="text-zinc-400 dark:text-zinc-700 mx-1">|</span>
        <span
          className={`${large ? "text-base" : "text-sm"} font-black tabular-nums ml-auto ${
            displayDarts.length > 0 ? "text-zinc-900 dark:text-white" : "text-zinc-400 dark:text-zinc-700"
          }`}
        >
          {displayDarts.length > 0 ? turnTotal : "–"}
        </span>
      </div>
    );

    return (
      <div
        className={`relative flex-1 min-h-0 border-b last:border-b-0 md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 transition-colors duration-300 overflow-hidden ${
          isActive ? "bg-blue-50 dark:bg-blue-950/40" : "bg-zinc-50 dark:bg-zinc-900/30"
        }`}
      >
        {/* Active indicator bar */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-r transition-colors duration-300 z-10 ${
            isActive ? "bg-blue-400" : "bg-transparent"
          }`}
        />

        {/* KI denkt… Overlay */}
        {isBot && isActive && aiThinking && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-amber-50/80 dark:bg-amber-950/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-900 rounded-xl border border-amber-300 dark:border-amber-700 shadow-lg">
              <span className="text-2xl animate-bounce">🤖</span>
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">KI denkt…</span>
            </div>
          </div>
        )}

        {/* ── Mobile layout ── */}
        <div className="flex md:hidden flex-col h-full px-3 py-2.5 pl-4 gap-2">
          {/* Zeile 1: Avatar+Name links | Score mittig | Legs rechts */}
          <div className="flex items-center gap-2 flex-1 min-h-0">
            {/* Links: Avatar + Nickname/Name */}
            <div className="flex items-center gap-2 w-[42%] min-w-0 shrink-0">
              {avatarEl("sm")}
              {nameBlock(true)}
            </div>
            {/* Mitte: Restpunkte */}
            <div
              key={`m-${isPlayerA ? "a" : "b"}-${displayRest}`}
              className="score-pop flex-1 flex justify-center items-center"
            >
              <span className={`font-black tabular-nums text-5xl leading-none ${scoreColor}`}>
                {displayRest}
              </span>
            </div>
            {/* Rechts: Legs */}
            <div className="shrink-0 flex justify-end">
              {legsDots}
            </div>
          </div>
          {/* Zeile 2: Statistiken — volle Breite */}
          {statsEl(false)}
          {/* Zeile 3: Pfeilpunkte — volle Breite */}
          {dartsDisplay(false)}
        </div>

        {/* ── Desktop layout: vertikal ── */}
        <div className="hidden md:flex flex-col px-5 py-4 pl-6 h-full justify-between gap-2">
          {/* Avatar + Name + Legs */}
          <div className="flex items-center gap-3">
            {avatarEl("md")}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
              {nameBlock(false)}
            </div>
            {legsDots}
          </div>
          {/* Score */}
          <div className="text-center">
            <div key={`d-${isPlayerA ? "a" : "b"}-${displayRest}`} className="score-pop inline-block">
              <span className={`font-black tabular-nums text-7xl leading-none ${scoreColor}`}>
                {displayRest}
              </span>
            </div>
          </div>
          {/* Stats */}
          <div className="flex justify-center">
            {statsEl(true)}
          </div>
          {/* Darts Display */}
          {dartsDisplay(true)}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes scorePop {
          0%   { transform: scale(1.18); opacity: 0.5; }
          65%  { transform: scale(0.96); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes dartPop {
          0%   { transform: scale(0.3); opacity: 0; }
          70%  { transform: scale(1.12); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .score-pop > span { animation: scorePop 0.35s cubic-bezier(0.34,1.56,0.64,1) both; }
        .dart-pop         { animation: dartPop  0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
        .fade-in-up       { animation: fadeInUp 0.45s ease-out both; }
      `}</style>

      <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-950 overflow-hidden">

        {/* Header */}
        <header className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 flex items-center justify-between shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
            onClick={() =>
              router.push(
                tournament?.type === "single_match" ? "/casual" : `/tournament/${id}`,
              )
            }
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Zurück
          </Button>

          <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
            <span>{formatBestOf()}</span>
            {match.answerThrowActive && (
              <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded text-xs font-bold uppercase animate-pulse">
                Answer Throw!
              </span>
            )}
          </div>

          <button
            onClick={() => setVoiceEnabled((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              voiceEnabled
                ? "bg-blue-500/20 border border-blue-500/40 text-blue-400 hover:bg-blue-500/30"
                : "bg-zinc-200 border border-zinc-300 text-zinc-500 hover:bg-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700"
            }`}
            title={voiceEnabled ? "Sound ausschalten" : "Sound einschalten"}
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{voiceEnabled ? "Sound an" : "Sound aus"}</span>
          </button>
        </header>

        {/* Players: flex-1 → teilt sich die Höhe gleichmäßig mit dem Dart-Pad (50/50) */}
        <div className="flex flex-col md:flex-row border-b border-zinc-200 dark:border-zinc-800 flex-1 min-h-0 overflow-hidden">
          {renderPlayerPanel(true)}
          {renderPlayerPanel(false)}
        </div>

        {/* Main: completed or dart pad */}
        {match.status === "completed" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-950 fade-in-up">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
              Match beendet
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 mb-8">
              {match.isDraw
                ? "Unentschieden (1:1 Punkte)"
                : `${
                    match.winnerId === match.playerAId
                      ? match.playerAName
                      : match.playerBName
                  } gewinnt!`}
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Button
                size="lg"
                variant="outline"
                className="border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() =>
                  router.push(
                    tournament?.type === "single_match"
                      ? "/"
                      : `/tournament/${id}`,
                  )
                }
              >
                {tournament?.type === "single_match"
                  ? "Zurück zu Freies Spiel"
                  : "Zum Turnier"}
              </Button>
              {nextMatchId && (
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() =>
                    router.push(`/tournament/${id}/match/${nextMatchId}`)
                  }
                >
                  Nächstes Match <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">

            {/* Info bar */}
            <div className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between text-sm shrink-0">
              <span className="text-zinc-600 dark:text-zinc-300">
                <span className="text-blue-400 font-bold">
                  {match.currentTurnId === match.playerAId
                    ? match.playerAName
                    : match.playerBName}
                </span>{" "}
                wirft · Leg {match.currentLeg}
              </span>
              {getCheckoutSuggestion(
                (match.currentTurnId === match.playerAId
                  ? match.playerARest
                  : match.playerBRest) -
                  currentDarts.reduce((sum, d) => sum + d.scoredPoints, 0),
                3 - currentDarts.length,
              ) && (
                <span className="text-green-400 font-semibold text-xs">
                  🎯{" "}
                  {getCheckoutSuggestion(
                    (match.currentTurnId === match.playerAId
                      ? match.playerARest
                      : match.playerBRest) -
                      currentDarts.reduce(
                        (sum, d) => sum + d.scoredPoints,
                        0,
                      ),
                    3 - currentDarts.length,
                  )}
                </span>
              )}
            </div>

            {/* Dart pad */}
            <div className="flex-1 flex flex-col gap-1.5 p-2 bg-white dark:bg-zinc-950 min-h-0">

              {/* Modifier + Undo row */}
              <div className="grid grid-cols-3 gap-1 shrink-0">
                <button
                  onClick={() =>
                    setMultiplier(multiplier === "double" ? "single" : "double")
                  }
                  className={`py-2 rounded-lg font-bold text-xs md:text-sm transition-all duration-150 active:scale-95 ${
                    multiplier === "double"
                      ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                      : "bg-zinc-200 text-orange-600 border border-orange-500/30 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-orange-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  DOUBLE
                </button>
                <button
                  onClick={() =>
                    setMultiplier(multiplier === "triple" ? "single" : "triple")
                  }
                  className={`py-2 rounded-lg font-bold text-xs md:text-sm transition-all duration-150 active:scale-95 ${
                    multiplier === "triple"
                      ? "bg-red-500 text-white shadow-md shadow-red-500/30"
                      : "bg-zinc-200 text-red-600 border border-red-500/30 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-red-400 dark:hover:bg-zinc-700"
                  }`}
                >
                  TRIPLE
                </button>
                <button
                  onClick={handleUndo}
                  disabled={currentDarts.length === 0 && history.length === 0}
                  className="py-2 rounded-lg font-bold text-xs md:text-sm bg-zinc-200 text-zinc-600 border border-zinc-300 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-all duration-150 flex items-center justify-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" /> UNDO
                </button>
              </div>

              {/* Number grid */}
              <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-1 min-h-0">
                {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleDartInput(num)}
                    className={`rounded font-bold text-sm md:text-base transition-all duration-100 active:scale-90 active:brightness-75 w-full h-full ${
                      multiplier === "double"
                        ? "bg-orange-500/15 border border-orange-500/35 text-orange-700 hover:bg-orange-500/25 dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-200 dark:hover:bg-orange-500/30"
                        : multiplier === "triple"
                          ? "bg-red-500/15 border border-red-500/35 text-red-700 hover:bg-red-500/25 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-200 dark:hover:bg-red-500/30"
                          : "bg-zinc-100 border border-zinc-300 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {num}
                  </button>
                ))}

                {/* Bull / Bull's Eye */}
                <button
                  onClick={() => handleDartInput(25)}
                  className={`rounded font-bold text-xs transition-all duration-100 active:scale-90 w-full h-full ${
                    multiplier === "double"
                      ? "bg-orange-500/20 border border-orange-500/50 text-orange-700 hover:bg-orange-500/30 dark:bg-orange-500/30 dark:border-orange-500/60 dark:text-orange-100 dark:hover:bg-orange-500/40"
                      : "bg-zinc-100 border border-zinc-300 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {multiplier === "double" ? "B·Eye" : "Bull"}
                </button>

                {/* Miss */}
                <button
                  onClick={() => handleDartInput(0)}
                  className="rounded font-bold text-sm md:text-base bg-zinc-100 border border-zinc-300 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-700 active:scale-90 transition-all duration-100 w-full h-full"
                >
                  0
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
