"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { useAppIcon } from "@/components/ThemeCustomizerProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";
import {
  User,
  Trophy,
  Trash2,
  Zap,
  CheckCircle2,
  Users,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { BOT_PLAYER_ID, type AIDifficulty, getBotName, AI_DIFFICULTY_LABELS } from "@/lib/ai-player";

export default function CasualGamesPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();
  const getIcon = useAppIcon();
  const router = useRouter();
  const [casualGames, setCasualGames] = useState<any[]>([]);
  const [matchDataMap, setMatchDataMap] = useState<Record<string, any>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Dialog state
  const [isSingleMatchDialogOpen, setIsSingleMatchDialogOpen] = useState(false);
  const [casualGameType, setCasualGameType] = useState<
    "single_match" | "tiebreak"
  >("single_match");
  const [players, setPlayers] = useState<any[]>([]);
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [tiebreakPlayerIds, setTiebreakPlayerIds] = useState<string[]>([]);
  const [singleMatchFormat, setSingleMatchFormat] = useState("301");
  const [singleMatchBestOf, setSingleMatchBestOf] = useState("3");
  const [singleAllowSingleOut, setSingleAllowSingleOut] = useState(false);
  const [singleAllowDoubleOut, setSingleAllowDoubleOut] = useState(true);
  const [singleAllowTripleOut, setSingleAllowTripleOut] = useState(false);
  const [singleAllowDraw, setSingleAllowDraw] = useState(false);
  const [isVsAI, setIsVsAI] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, "tournaments"),
      where("ownerId", "==", user.uid),
    );
    const unsubscribeTournaments = onSnapshot(
      q,
      (snapshot) => {
        const allDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        allDocs.sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        const c = allDocs.filter(
          (d) => d.type === "single_match" || d.type === "casual_tiebreak",
        );
        setCasualGames(c);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "tournaments");
      },
    );

    const qPlayers = query(
      collection(db, "players"),
      where("ownerId", "==", user.uid),
    );
    const unsubscribePlayers = onSnapshot(
      qPlayers,
      (snapshot) => {
        const p = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPlayers(p);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "players");
      },
    );

    return () => {
      unsubscribeTournaments();
      unsubscribePlayers();
    };
  }, [user, isAuthReady]);

  // Real-time subscription to match/tiebreak data for each game
  useEffect(() => {
    if (casualGames.length === 0) {
      setMatchDataMap({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    casualGames.forEach((game) => {
      if (game.type === "single_match") {
        const matchesRef = collection(db, "tournaments", game.id, "matches");
        const unsub = onSnapshot(matchesRef, (snap) => {
          const matchDocs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setMatchDataMap((prev) => ({
            ...prev,
            [game.id]: matchDocs[0] || null,
          }));
        });
        unsubscribers.push(unsub);
      } else if (game.type === "casual_tiebreak") {
        const tbRef = collection(db, "tournaments", game.id, "tiebreaks");
        const unsub = onSnapshot(tbRef, (snap) => {
          const tbDocs = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setMatchDataMap((prev) => ({
            ...prev,
            [game.id]: tbDocs[0] || null,
          }));
        });
        unsubscribers.push(unsub);
      }
    });

    return () => unsubscribers.forEach((u) => u());
  }, [casualGames]);

  const createCasualGame = async () => {
    if (!user) return;
    setFormError("");

    if (casualGameType === "single_match") {
      const effectivePlayer2Id = isVsAI ? BOT_PLAYER_ID : player2Id;

      if (!player1Id || !effectivePlayer2Id) return;
      if (!isVsAI && player1Id === player2Id) {
        setFormError("Bitte zwei verschiedene Spieler auswählen.");
        return;
      }

      setIsCreating(true);
      try {
        const p1 = players.find((p) => p.id === player1Id);
        const p2Name = isVsAI ? getBotName(aiDifficulty) : players.find((p) => p.id === player2Id)?.name;
        const p2 = isVsAI ? null : players.find((p) => p.id === player2Id);

        if (!p1 || (!isVsAI && !p2)) return;

        const docRef = await addDoc(collection(db, "tournaments"), {
          title: `Single Match: ${p1.name} vs ${p2Name}`,
          status: "single_match",
          type: "single_match",
          allowSingleOut: singleAllowSingleOut,
          allowDoubleOut: singleAllowDoubleOut,
          allowTripleOut: singleAllowTripleOut,
          allowDraw: singleAllowDraw,
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
          ...(isVsAI ? { aiDifficulty, isVsAI: true } : {}),
        });

        const format = `${singleMatchFormat}_bo${singleMatchBestOf}`;
        const rest = parseInt(singleMatchFormat);

        const matchRef = await addDoc(
          collection(db, "tournaments", docRef.id, "matches"),
          {
            phase: "final",
            playerAId: p1.id,
            playerBId: effectivePlayer2Id,
            playerAName: p1.name,
            playerBName: p2Name,
            playerALegs: 0,
            playerBLegs: 0,
            currentLeg: 1,
            playerAStartsLeg: true,
            currentTurnId: "",
            playerARest: rest,
            playerBRest: rest,
            answerThrowActive: false,
            status: "pending",
            format: format,
          },
        );

        router.push(`/tournament/${docRef.id}/match/${matchRef.id}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "tournaments");
        setIsCreating(false);
      }
    } else {
      if (tiebreakPlayerIds.length < 2) {
        setFormError(
          "Bitte mindestens zwei Spieler für einen Tiebreak auswählen.",
        );
        return;
      }

      setIsCreating(true);
      try {
        const selectedPlayers = players.filter((p) =>
          tiebreakPlayerIds.includes(p.id),
        );

        const docRef = await addDoc(collection(db, "tournaments"), {
          title: `Tiebreak: ${selectedPlayers.map((p) => p.name).join(", ")}`,
          status: "single_match",
          type: "casual_tiebreak",
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
        });

        const targetNumber = Math.floor(Math.random() * 20) + 1;

        await addDoc(collection(db, "tournaments", docRef.id, "tiebreaks"), {
          targetNumber,
          playerIds: selectedPlayers.map((p) => p.id),
          playerNames: selectedPlayers.map((p) => p.name),
          scores: {},
          currentRound: 1,
          status: "pending",
        });

        router.push(`/tournament/${docRef.id}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, "tournaments");
        setIsCreating(false);
      }
    }
  };

  const deleteGame = async (gameId: string, gameType: string) => {
    if (!isAdmin) return;
    setIsDeleting(true);
    try {
      const subCol = gameType === "casual_tiebreak" ? "tiebreaks" : "matches";
      const subColRef = collection(db, "tournaments", gameId, subCol);
      const subDocs = await getDocs(subColRef);
      for (const subDoc of subDocs.docs) {
        await deleteDoc(doc(db, "tournaments", gameId, subCol, subDoc.id));
      }
      await deleteDoc(doc(db, "tournaments", gameId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `tournaments/${gameId}`,
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const getPlayerInfo = (playerId: string) => {
    return players.find((p) => p.id === playerId) || null;
  };

  const parseFormat = (format: string) => {
    if (!format) return "";
    const [pts, bo] = format.split("_bo");
    return `${pts} · Best of ${bo}`;
  };

  const formatDate = (iso: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGameStatus = (game: any) => {
    const matchData = matchDataMap[game.id];
    if (!matchData) return "pending";
    return matchData.status || "pending";
  };

  const activeGames = casualGames.filter((g) => {
    const s = getGameStatus(g);
    return s === "pending" || s === "in_progress";
  });

  const completedGames = casualGames.filter((g) => {
    return getGameStatus(g) === "completed";
  });

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-500">Laden...</div>
      </div>
    );
  }

  if (!user) return null;

  const PlayerAvatar = ({
    playerId,
    size = "md",
  }: {
    playerId?: string;
    size?: "sm" | "md" | "lg";
  }) => {
    const player = playerId ? getPlayerInfo(playerId) : null;
    const sizeMap = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-12 h-12" };
    const iconMap = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" };
    return (
      <div
        className={`${sizeMap[size]} rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0`}
      >
        {player?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatar}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <User className={`${iconMap[size]} text-zinc-400`} />
        )}
      </div>
    );
  };

  const SingleMatchRow = ({
    game,
    matchData,
    compact = false,
  }: {
    game: any;
    matchData: any;
    compact?: boolean;
  }) => {
    const status = matchData?.status || "pending";
    const playerA = matchData?.playerAId ? getPlayerInfo(matchData.playerAId) : null;
    const playerB = matchData?.playerBId ? getPlayerInfo(matchData.playerBId) : null;
    const isCompleted = status === "completed";
    const isLive = status === "in_progress";
    const isPending = status === "pending";
    const aWon = isCompleted && !matchData?.isDraw && matchData?.winnerId === matchData?.playerAId;
    const bWon = isCompleted && !matchData?.isDraw && matchData?.winnerId === matchData?.playerBId;
    const isDraw = isCompleted && matchData?.isDraw;

    const rowBg = isCompleted
      ? "bg-zinc-50 dark:bg-zinc-900/50"
      : isLive
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
        : "bg-white dark:bg-zinc-900";

    return (
      <div
        className={`rounded-xl border ${rowBg} transition-all hover:shadow-md dark:hover:shadow-zinc-900 group`}
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => {
            if (matchData?.id) {
              router.push(`/tournament/${game.id}/match/${matchData.id}`);
            } else {
              router.push(`/tournament/${game.id}`);
            }
          }}
        >
          {/* Main row: Player A - Score/Status - Player B */}
          <div className="flex items-center gap-3">
            {/* Player A */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <PlayerAvatar playerId={matchData?.playerAId} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  {aWon && (
                    <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  )}
                  <span
                    className={`font-semibold text-sm leading-tight truncate ${
                      aWon
                        ? "text-green-600 dark:text-green-400"
                        : bWon
                          ? "text-zinc-400 dark:text-zinc-500"
                          : isDraw
                            ? "text-orange-500"
                            : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {matchData?.playerAName || "—"}
                  </span>
                </div>
                {playerA?.nickname && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                    &ldquo;{playerA.nickname}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Center: Score + Status */}
            <div className="flex flex-col items-center gap-1 shrink-0 px-2">
              {/* Status badge */}
              <div
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  isLive
                    ? "bg-green-500 text-white animate-pulse"
                    : isCompleted
                      ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                }`}
              >
                {isLive ? "Live" : isCompleted ? "FT" : "VS"}
              </div>

              {/* Score */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-xl font-bold tabular-nums ${
                    aWon
                      ? "text-green-600 dark:text-green-400"
                      : bWon
                        ? "text-zinc-400 dark:text-zinc-500"
                        : isDraw
                          ? "text-orange-500"
                          : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {isCompleted
                    ? isDraw
                      ? "D"
                      : aWon
                        ? matchData?.playerALegs ?? "—"
                        : matchData?.playerALegs ?? "—"
                    : matchData?.playerALegs ?? "0"}
                </span>
                <span className="text-zinc-300 dark:text-zinc-600 font-light">
                  –
                </span>
                <span
                  className={`text-xl font-bold tabular-nums ${
                    bWon
                      ? "text-green-600 dark:text-green-400"
                      : aWon
                        ? "text-zinc-400 dark:text-zinc-500"
                        : isDraw
                          ? "text-orange-500"
                          : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {isCompleted
                    ? isDraw
                      ? "D"
                      : bWon
                        ? matchData?.playerBLegs ?? "—"
                        : matchData?.playerBLegs ?? "—"
                    : matchData?.playerBLegs ?? "0"}
                </span>
              </div>

              {/* Format */}
              {matchData?.format && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  {parseFormat(matchData.format)}
                </span>
              )}
            </div>

            {/* Player B */}
            <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
              <div className="min-w-0 text-right">
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={`font-semibold text-sm leading-tight truncate ${
                      bWon
                        ? "text-green-600 dark:text-green-400"
                        : aWon
                          ? "text-zinc-400 dark:text-zinc-500"
                          : isDraw
                            ? "text-orange-500"
                            : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {matchData?.playerBName || "—"}
                  </span>
                  {bWon && (
                    <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  )}
                </div>
                {playerB?.nickname && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
                    &ldquo;{playerB.nickname}&rdquo;
                  </p>
                )}
              </div>
              <PlayerAvatar playerId={matchData?.playerBId} size="md" />
            </div>
          </div>

          {/* Bottom row: Date + extra info for completed */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(game.createdAt)}
              </span>
              {isCompleted && isDraw && (
                <span className="text-[11px] font-medium text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
                  Unentschieden
                </span>
              )}
              {isCompleted && !isDraw && (aWon || bWon) && (
                <span className="text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  {aWon ? matchData?.playerAName : matchData?.playerBName} gewinnt
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Admin delete button */}
        {isAdmin && (
          <div className="px-4 pb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmId(game.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Löschen</span>
            </Button>
          </div>
        )}
      </div>
    );
  };

  const TiebreakRow = ({ game, tbData }: { game: any; tbData: any }) => {
    const status = tbData?.status || "pending";
    const isCompleted = status === "completed";
    const isLive = status === "in_progress";
    const playerIds: string[] = tbData?.playerIds || [];
    const playerNames: string[] = tbData?.playerNames || [];

    const rowBg = isCompleted
      ? "bg-zinc-50 dark:bg-zinc-900/50"
      : isLive
        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
        : "bg-white dark:bg-zinc-900";

    return (
      <div
        className={`rounded-xl border ${rowBg} transition-all hover:shadow-md dark:hover:shadow-zinc-900 group cursor-pointer`}
        onClick={() => router.push(`/tournament/${game.id}`)}
      >
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    Tiebreak
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                      isLive
                        ? "bg-green-500 text-white animate-pulse"
                        : isCompleted
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                          : "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
                    }`}
                  >
                    {isLive ? "Live" : isCompleted ? "FT" : "Offen"}
                  </span>
                </div>
                {tbData?.targetNumber && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Zielzahl: {tbData.targetNumber}
                  </p>
                )}
              </div>
            </div>

            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {formatDate(game.createdAt)}
            </span>
          </div>

          {/* Players */}
          <div className="mt-3 flex flex-wrap gap-2">
            {playerIds.map((pid, i) => {
              const player = getPlayerInfo(pid);
              return (
                <div
                  key={pid}
                  className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2.5 py-1"
                >
                  <PlayerAvatar playerId={pid} size="sm" />
                  <div>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {playerNames[i] || player?.name || "—"}
                    </span>
                    {player?.nickname && (
                      <span className="text-[10px] text-zinc-400 ml-1">
                        &ldquo;{player.nickname}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="px-4 pb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmId(game.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span className="text-xs">Löschen</span>
            </Button>
          </div>
        )}
      </div>
    );
  };

  const GameRow = ({ game }: { game: any }) => {
    const matchData = matchDataMap[game.id];
    if (game.type === "casual_tiebreak") {
      return <TiebreakRow game={game} tbData={matchData} />;
    }
    return <SingleMatchRow game={game} matchData={matchData} />;
  };

  const gameToDelete = casualGames.find((g) => g.id === deleteConfirmId);

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Icon icon={getIcon("casual")} className="w-8 h-8" />
              Freies Spiel
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Casual Matches und Tiebreaks ohne Turnier.
            </p>
          </div>
          <Dialog
            open={isSingleMatchDialogOpen}
            onOpenChange={setIsSingleMatchDialogOpen}
          >
            <Button
              className="w-full sm:w-auto"
              onClick={() => setIsSingleMatchDialogOpen(true)}
            >
              <Zap className="w-4 h-4 mr-2" />
              Neues Spiel
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Freies Spiel erstellen</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Spielmodus</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="casualGameType"
                        value="single_match"
                        checked={casualGameType === "single_match"}
                        onChange={(e) =>
                          setCasualGameType(e.target.value as any)
                        }
                      />
                      Einzelspiel
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="casualGameType"
                        value="tiebreak"
                        checked={casualGameType === "tiebreak"}
                        onChange={(e) =>
                          setCasualGameType(e.target.value as any)
                        }
                      />
                      Tiebreak
                    </label>
                  </div>
                </div>

                {casualGameType === "single_match" ? (
                  <>
                    <div className="grid gap-2">
                      <Label>Spieler 1</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={player1Id}
                        onChange={(e) => setPlayer1Id(e.target.value)}
                      >
                        <option value="">Spieler 1 wählen</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.nickname ? ` (${p.nickname})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* KI-Toggle */}
                    <div className="flex items-center gap-3 py-1">
                      <button
                        type="button"
                        onClick={() => setIsVsAI(!isVsAI)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isVsAI ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isVsAI ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                      <Label className="cursor-pointer font-normal" onClick={() => setIsVsAI(!isVsAI)}>
                        🤖 Gegen KI spielen
                      </Label>
                    </div>

                    {isVsAI ? (
                      /* Schwierigkeitsstufen */
                      <div className="grid gap-2">
                        <Label>Schwierigkeitsstufe</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["easy", "medium", "hard"] as AIDifficulty[]).map((level) => {
                            const icons = { easy: "🎯", medium: "⚡", hard: "🏆" };
                            const descs = { easy: "Für Einsteiger", medium: "Ausgewogen", hard: "Herausfordernd" };
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => setAiDifficulty(level)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm transition-all ${
                                  aiDifficulty === level
                                    ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-semibold"
                                    : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"
                                }`}
                              >
                                <span className="text-2xl">{icons[level]}</span>
                                <span className="font-medium">{AI_DIFFICULTY_LABELS[level]}</span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-tight">{descs[level]}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                          <span>🤖</span>
                          <span>Gegner: <strong>{getBotName(aiDifficulty)}</strong> — die KI wirft automatisch.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <Label>Spieler 2</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={player2Id}
                          onChange={(e) => setPlayer2Id(e.target.value)}
                        >
                          <option value="">Spieler 2 wählen</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {p.nickname ? ` (${p.nickname})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid gap-2 mt-2">
                      <Label>Format</Label>
                      <div className="flex items-center gap-4">
                        {["301", "501"].map((f) => (
                          <label key={f} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleFormat"
                              value={f}
                              checked={singleMatchFormat === f}
                              onChange={(e) =>
                                setSingleMatchFormat(e.target.value)
                              }
                            />
                            {f}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Best Of</Label>
                      <div className="flex items-center gap-4">
                        {["1", "3", "5"].map((bo) => (
                          <label key={bo} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleBestOf"
                              value={bo}
                              checked={singleMatchBestOf === bo}
                              onChange={(e) =>
                                setSingleMatchBestOf(e.target.value)
                              }
                            />
                            Best of {bo}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-2 mt-2">
                      <Label>Out Rules</Label>
                      {[
                        {
                          id: "singleSingleOut",
                          label: "Single Out (inkl. Bull)",
                          checked: singleAllowSingleOut,
                          onChange: setSingleAllowSingleOut,
                        },
                        {
                          id: "singleDoubleOut",
                          label: "Double Out (inkl. Bull's Eye)",
                          checked: singleAllowDoubleOut,
                          onChange: setSingleAllowDoubleOut,
                        },
                        {
                          id: "singleTripleOut",
                          label: "Triple Out (inkl. Bull's Eye)",
                          checked: singleAllowTripleOut,
                          onChange: setSingleAllowTripleOut,
                        },
                      ].map((rule) => (
                        <div key={rule.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={rule.id}
                            checked={rule.checked}
                            onChange={(e) => rule.onChange(e.target.checked)}
                          />
                          <Label htmlFor={rule.id} className="font-normal">
                            {rule.label}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2">
                      <Label>Match Rules</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="singleAllowDraw"
                          checked={singleAllowDraw}
                          onChange={(e) => setSingleAllowDraw(e.target.checked)}
                          disabled={singleMatchBestOf !== "1"}
                        />
                        <Label htmlFor="singleAllowDraw" className="font-normal">
                          Unentschieden erlaubt (nur Best of 1)
                        </Label>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2">
                    <Label>Spieler auswählen (mind. 2)</Label>
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                      {players.map((p) => (
                        <label key={p.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={tiebreakPlayerIds.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTiebreakPlayerIds([
                                  ...tiebreakPlayerIds,
                                  p.id,
                                ]);
                              } else {
                                setTiebreakPlayerIds(
                                  tiebreakPlayerIds.filter((id) => id !== p.id),
                                );
                              }
                            }}
                          />
                          <span>
                            {p.name}
                            {p.nickname && (
                              <span className="text-zinc-400 text-sm ml-1">
                                &ldquo;{p.nickname}&rdquo;
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {formError && (
                <p className="text-sm text-red-500 px-1">{formError}</p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsSingleMatchDialogOpen(false);
                    setFormError("");
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={createCasualGame}
                  disabled={
                    isCreating ||
                    (casualGameType === "single_match" &&
                      (!player1Id || (!isVsAI && (!player2Id || player1Id === player2Id)))) ||
                    (casualGameType === "tiebreak" &&
                      tiebreakPlayerIds.length < 2)
                  }
                >
                  {isCreating ? "Starte..." : "Spiel starten"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Active games section */}
        {activeGames.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Aktiv
              </h2>
              <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                {activeGames.length}
              </span>
            </div>
            <div className="space-y-2">
              {activeGames.map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}

        {/* Completed games section */}
        {completedGames.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Beendet
              </h2>
              <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                {completedGames.length}
              </span>
            </div>
            <div className="space-y-2">
              {completedGames.map((game) => (
                <GameRow key={game.id} game={game} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {casualGames.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
            <Icon icon={getIcon("casual")} className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">
              Noch keine freien Spiele
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Erstelle dein erstes Spiel mit &ldquo;Neues Spiel&rdquo;.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Spiel löschen
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Möchtest du das Spiel wirklich löschen? Diese Aktion kann nicht
            rückgängig gemacht werden.
          </p>
          {gameToDelete && (
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3 text-sm text-zinc-700 dark:text-zinc-300 font-medium">
              {gameToDelete.title}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={isDeleting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteConfirmId &&
                gameToDelete &&
                deleteGame(deleteConfirmId, gameToDelete.type)
              }
              disabled={isDeleting}
            >
              {isDeleting ? "Löschen..." : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
