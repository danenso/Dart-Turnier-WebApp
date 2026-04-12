"use client";

import { cn } from "@/lib/utils";
import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import {
  collection,
  doc,
  onSnapshot,
  query,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  where,
} from "firebase/firestore";
import { ArrowLeft, Trash2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { TiebreakManager } from "@/components/TiebreakManager";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function TournamentPage() {
  const { id } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin } = useFirebase();
  const router = useRouter();

  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tiebreaks, setTiebreaks] = useState<any[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [globalPlayers, setGlobalPlayers] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    if (!isAuthReady || !user || !id) return;

    const tUnsub = onSnapshot(
      doc(db, "tournaments", id),
      (docSnap) => {
        if (docSnap.exists()) {
          setTournament({ id: docSnap.id, ...docSnap.data() });
        } else {
          router.push("/");
        }
      },
      (error) =>
        handleFirestoreError(error, OperationType.GET, `tournaments/${id}`),
    );

    const pUnsub = onSnapshot(
      collection(db, "tournaments", id, "players"),
      (snapshot) => {
        const p = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPlayers(p);
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `tournaments/${id}/players`,
        ),
    );

    const mUnsub = onSnapshot(
      collection(db, "tournaments", id, "matches"),
      (snapshot) => {
        const m = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(m);
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `tournaments/${id}/matches`,
        ),
    );

    const tbUnsub = onSnapshot(
      collection(db, "tournaments", id, "tiebreaks"),
      (snapshot) => {
        setTiebreaks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) =>
        handleFirestoreError(
          error,
          OperationType.LIST,
          `tournaments/${id}/tiebreaks`,
        ),
    );

    const q = query(
      collection(db, "players"),
      where("ownerId", "==", user.uid),
    );
    const gUnsub = onSnapshot(
      q,
      (snapshot) => {
        setGlobalPlayers(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `players`),
    );

    return () => {
      tUnsub();
      pUnsub();
      mUnsub();
      tbUnsub();
      gUnsub();
    };
  }, [id, user, isAuthReady, router]);

  const addPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || !user) return;
    try {
      let globalPlayerId = "";
      const existing = globalPlayers.find(
        (p) => p.name.toLowerCase() === newPlayerName.trim().toLowerCase(),
      );

      if (existing) {
        globalPlayerId = existing.id;
      } else {
        const newGlobalPlayerRef = await addDoc(collection(db, "players"), {
          name: newPlayerName.trim(),
          ownerId: user.uid,
          createdAt: new Date().toISOString(),
        });
        globalPlayerId = newGlobalPlayerRef.id;
      }

      await setDoc(doc(db, "tournaments", id, "players", globalPlayerId), {
        name: newPlayerName.trim(),
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      });
      setNewPlayerName("");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `tournaments/${id}/players`,
      );
    }
  };

  const removePlayer = async (playerId: string) => {
    try {
      await deleteDoc(doc(db, "tournaments", id, "players", playerId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `tournaments/${id}/players/${playerId}`,
      );
    }
  };

  const generateBracket = async () => {
    if (players.length < 4) {
      alert("Need at least 4 players for a bracket.");
      return;
    }

    const groupMatches = matches.filter((m) => m.phase === "group");
    if (
      groupMatches.length === 0 ||
      groupMatches.some((m) => m.status !== "completed")
    ) {
      alert(
        "All group matches must be completed before generating the bracket.",
      );
      return;
    }

    // Check if we are already in tiebreaks phase
    if (tournament.status === "tiebreaks") {
      const pendingTiebreaks = tiebreaks.filter(
        (tb) => tb.status !== "completed",
      );
      if (pendingTiebreaks.length > 0) {
        alert("Please complete all tiebreaks first.");
        return;
      }
    }

    // Sort players, taking tiebreaks into account
    const sortPlayers = (groupPlayers: any[]) => {
      return [...groupPlayers].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.wins !== b.wins) return b.wins - a.wins;
        if (a.losses !== b.losses) return a.losses - b.losses;

        // If still tied, check if there's a completed tiebreak involving both
        const tb = tiebreaks.find(
          (t) =>
            t.status === "completed" &&
            t.finalOrder?.includes(a.id) &&
            t.finalOrder?.includes(b.id),
        );
        if (tb) {
          return tb.finalOrder.indexOf(a.id) - tb.finalOrder.indexOf(b.id);
        }
        return 0;
      });
    };

    const groupA = players.filter((p) => p.groupId === "A");
    const groupB = players.filter((p) => p.groupId === "B");

    const sortedA = sortPlayers(groupA.length > 0 ? groupA : players);
    const sortedB = sortPlayers(groupB);

    // Check for unresolved ties
    const findUnresolvedTies = (sortedGroup: any[]) => {
      if (sortedGroup.length === 0) return [];
      const ties = [];
      let currentTie = [sortedGroup[0]];
      for (let i = 1; i < sortedGroup.length; i++) {
        const prev = sortedGroup[i - 1];
        const curr = sortedGroup[i];

        const isTied =
          curr.points === prev.points &&
          curr.wins === prev.wins &&
          curr.losses === prev.losses;
        const hasTb = tiebreaks.find(
          (t) =>
            t.status === "completed" &&
            t.finalOrder?.includes(curr.id) &&
            t.finalOrder?.includes(prev.id),
        );

        if (isTied && !hasTb) {
          currentTie.push(curr);
        } else {
          if (currentTie.length > 1) ties.push(currentTie);
          currentTie = [curr];
        }
      }
      if (currentTie.length > 1) ties.push(currentTie);
      return ties;
    };

    const tiesA = findUnresolvedTies(sortedA);
    const tiesB = findUnresolvedTies(sortedB);
    const allTies = [...tiesA, ...tiesB];

    try {
      if (allTies.length > 0) {
        for (const tieGroup of allTies) {
          await addDoc(collection(db, "tournaments", id, "tiebreaks"), {
            targetNumber: Math.floor(Math.random() * 20) + 1,
            playerIds: tieGroup.map((p) => p.id),
            playerNames: tieGroup.map((p) => p.name),
            scores: {},
            currentRound: 1,
            status: "pending",
          });
        }
        await updateDoc(doc(db, "tournaments", id), {
          status: "tiebreaks",
        });
      } else {
        // Generate Bracket Matches
        let matchups = [];
        const isTop4 = players.length < 8;

        if (groupB.length > 0) {
          // 2 groups, top 4 from each
          const top4A = sortedA.slice(0, 4);
          const top4B = sortedB.slice(0, 4);
          matchups = [
            [top4A[0], top4B[3]],
            [top4B[1], top4A[2]],
            [top4B[0], top4A[3]],
            [top4A[1], top4B[2]],
          ];
        } else {
          // 1 group
          if (isTop4) {
            // Top 4
            const top4 = sortedA.slice(0, 4);
            matchups = [
              [top4[0], top4[3]],
              [top4[1], top4[2]],
            ];
          } else {
            // Top 8
            const top8 = sortedA.slice(0, 8);
            matchups = [
              [top8[0], top8[7]],
              [top8[1], top8[6]],
              [top8[2], top8[5]],
              [top8[3], top8[4]],
            ];
          }
        }

        const phase = isTop4 ? "semi" : "quarter";

        for (const [pA, pB] of matchups) {
          await addDoc(collection(db, "tournaments", id, "matches"), {
            phase: phase,
            playerAId: pA.id,
            playerBId: pB.id,
            playerAName: pA.name,
            playerBName: pB.name,
            playerALegs: 0,
            playerBLegs: 0,
            currentLeg: 1,
            playerAStartsLeg: true,
            currentTurnId: "",
            playerARest: 301,
            playerBRest: 301,
            answerThrowActive: false,
            status: "pending",
            format: "301_bo3",
          });
        }

        await updateDoc(doc(db, "tournaments", id), {
          status: "bracket",
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };

  const generateNextRound = async (currentPhase: string) => {
    const currentMatches = matches.filter((m) => m.phase === currentPhase);
    if (currentMatches.some((m) => m.status !== "completed")) {
      alert("Not all matches in this round are completed.");
      return;
    }

    try {
      if (currentPhase === "quarter") {
        // Generate Semi Finals
        // QF1 winner vs QF2 winner, QF3 winner vs QF4 winner
        // Assuming matches are sorted by creation time
        const m1 = currentMatches[0];
        const m2 = currentMatches[1];
        const m3 = currentMatches[2];
        const m4 = currentMatches[3];

        const sfMatchups = [
          [
            m1.winnerId === m1.playerAId
              ? { id: m1.playerAId, name: m1.playerAName }
              : { id: m1.playerBId, name: m1.playerBName },
            m2.winnerId === m2.playerAId
              ? { id: m2.playerAId, name: m2.playerAName }
              : { id: m2.playerBId, name: m2.playerBName },
          ],
          [
            m3.winnerId === m3.playerAId
              ? { id: m3.playerAId, name: m3.playerAName }
              : { id: m3.playerBId, name: m3.playerBName },
            m4.winnerId === m4.playerAId
              ? { id: m4.playerAId, name: m4.playerAName }
              : { id: m4.playerBId, name: m4.playerBName },
          ],
        ];

        for (const [pA, pB] of sfMatchups) {
          await addDoc(collection(db, "tournaments", id, "matches"), {
            phase: "semi",
            playerAId: pA.id,
            playerBId: pB.id,
            playerAName: pA.name,
            playerBName: pB.name,
            playerALegs: 0,
            playerBLegs: 0,
            currentLeg: 1,
            playerAStartsLeg: true,
            currentTurnId: "",
            playerARest: 301,
            playerBRest: 301,
            answerThrowActive: false,
            status: "pending",
            format: "301_bo3",
          });
        }
      } else if (currentPhase === "semi") {
        // Generate Final
        const m1 = currentMatches[0];
        const m2 = currentMatches[1];

        const pA =
          m1.winnerId === m1.playerAId
            ? { id: m1.playerAId, name: m1.playerAName }
            : { id: m1.playerBId, name: m1.playerBName };
        const pB =
          m2.winnerId === m2.playerAId
            ? { id: m2.playerAId, name: m2.playerAName }
            : { id: m2.playerBId, name: m2.playerBName };

        await addDoc(collection(db, "tournaments", id, "matches"), {
          phase: "final",
          playerAId: pA.id,
          playerBId: pB.id,
          playerAName: pA.name,
          playerBName: pB.name,
          playerALegs: 0,
          playerBLegs: 0,
          currentLeg: 1,
          playerAStartsLeg: true,
          currentTurnId: "",
          playerARest: 501,
          playerBRest: 501,
          answerThrowActive: false,
          status: "pending",
          format: "501_bo3",
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };
  const startDraw = async () => {
    if (players.length < 4) {
      alert("Need at least 4 players to start.");
      return;
    }

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const numGroups = players.length >= 8 ? 2 : 1;

    try {
      const groupA = [];
      const groupB = [];

      // Assign groups
      for (let i = 0; i < shuffled.length; i++) {
        const groupId = numGroups === 1 ? "A" : i % 2 === 0 ? "A" : "B";
        if (groupId === "A") groupA.push(shuffled[i]);
        else groupB.push(shuffled[i]);

        await updateDoc(doc(db, "tournaments", id, "players", shuffled[i].id), {
          groupId,
        });
      }

      // Generate Round Robin matches for a group
      const generateMatches = async (groupPlayers: any[]) => {
        for (let i = 0; i < groupPlayers.length; i++) {
          for (let j = i + 1; j < groupPlayers.length; j++) {
            await addDoc(collection(db, "tournaments", id, "matches"), {
              phase: "group",
              playerAId: groupPlayers[i].id,
              playerBId: groupPlayers[j].id,
              playerAName: groupPlayers[i].name,
              playerBName: groupPlayers[j].name,
              playerALegs: 0,
              playerBLegs: 0,
              currentLeg: 1,
              playerAStartsLeg: true,
              currentTurnId: "",
              playerARest: 301,
              playerBRest: 301,
              answerThrowActive: false,
              status: "pending",
              format: "301_bo1",
            });
          }
        }
      };

      await generateMatches(groupA);
      if (numGroups === 2) {
        await generateMatches(groupB);
      }

      // Update tournament status
      await updateDoc(doc(db, "tournaments", id), {
        status: "groups",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };

  const deleteTournament = async () => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, "tournaments", id));
      router.push("/");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tournaments/${id}`);
    }
  };

  if (!tournament) return <div className="p-8">Loading...</div>;

  if (tournament.type === "casual_tiebreak") {
    return (
      <div className="p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/")}
            className="-ml-4 mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {tournament.title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-900">
                  CASUAL TIEBREAK
                </span>
              </div>
            </div>
            {isAdmin && (
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            )}
          </div>

          <div className="space-y-6 mt-8">
            {tiebreaks.map((tb) => (
              <TiebreakManager
                key={tb.id}
                tournamentId={id}
                tiebreak={tb}
                isAdmin={isAdmin}
              />
            ))}
          </div>

          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Tiebreak?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete the
                  tiebreak.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={deleteTournament}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/")}
          className="-ml-4 mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {tournament.title}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 text-zinc-900">
                {tournament.status.toUpperCase()}
              </span>
              <span className="text-sm text-zinc-500 flex items-center gap-1">
                <Users className="h-4 w-4" /> {players.length} Players
              </span>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Tournament
            </Button>
          )}
        </div>

        <Tabs defaultValue="participants" className="w-full">
          <div className="relative mb-0 h-[45px]">
            <TabsList 
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={cn(
                "flex w-full overflow-x-auto justify-start gap-3 h-[46px] bg-transparent p-2 pb-2 select-none",
                "cursor-grab active:cursor-grabbing",
                "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              )}
            >
              <TabsTrigger 
                value="participants"
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Participants
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                disabled={tournament.status === "draft"}
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Groups
              </TabsTrigger>
              <TabsTrigger
                value="matches"
                disabled={tournament.status === "draft"}
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Matches
              </TabsTrigger>
              <TabsTrigger
                value="tiebreaks"
                disabled={tournament.status !== "tiebreaks"}
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Tiebreaks
              </TabsTrigger>
              <TabsTrigger
                value="bracket"
                disabled={["draft", "groups", "tiebreaks"].includes(
                  tournament.status,
                )}
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Finals
              </TabsTrigger>
              <TabsTrigger
                value="results"
                disabled={tournament.status !== "completed"}
                className={cn(
                  "flex-none rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Results
              </TabsTrigger>
            </TabsList>
          </div>

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
                      disabled={tournament.status !== "draft"}
                      list="global-players"
                    />
                    <datalist id="global-players">
                      {globalPlayers.map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        tournament.status !== "draft" || !newPlayerName.trim()
                      }
                    >
                      Add Player
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Player List</CardTitle>
                  {tournament.status === "draft" && (
                    <Button onClick={startDraw} disabled={players.length < 4}>
                      Start Draw & Generate Matches
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {players.map((p, i) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-400 w-6">{i + 1}.</span>
                          <span className="font-medium">{p.name}</span>
                          {p.groupId && (
                            <span className="text-xs bg-zinc-100 px-2 py-1 rounded">
                              Group {p.groupId}
                            </span>
                          )}
                        </div>
                        {tournament.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayer(p.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {players.length === 0 && (
                      <p className="text-center text-zinc-500 py-8">
                        No players added yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <div className="flex justify-end mb-4">
              {tournament.status === "groups" && (
                <Button onClick={generateBracket} disabled={players.length < 4}>
                  Generate Bracket {players.length >= 8 ? "(Top 8)" : "(Top 4)"}
                </Button>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {["A", "B"].map((groupId) => {
                const groupPlayers = players
                  .filter((p) => p.groupId === groupId)
                  .sort(
                    (a, b) =>
                      b.points - a.points ||
                      b.wins - a.wins ||
                      a.losses - b.losses,
                  );
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
                                <td className="px-4 py-2 text-center">
                                  {p.matchesPlayed}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {p.wins}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {p.draws}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {p.losses}
                                </td>
                                <td className="px-4 py-2 text-center font-bold">
                                  {p.points}
                                </td>
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

          <TabsContent value="tiebreaks">
            <div className="space-y-6">
              {tiebreaks.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
                  <p className="text-zinc-500">
                    No tiebreaks needed or generated yet.
                  </p>
                </div>
              ) : (
                tiebreaks.map((tb) => (
                  <TiebreakManager
                    key={tb.id}
                    tournamentId={id}
                    tiebreak={tb}
                    isAdmin={isAdmin}
                  />
                ))
              )}
              {tournament.status === "tiebreaks" &&
                tiebreaks.every((tb) => tb.status === "completed") && (
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={generateBracket}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Continue to Bracket
                    </Button>
                  </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="matches">
            <div className="grid gap-4">
              {matches.map((m) => (
                <Card
                  key={m.id}
                  className={`cursor-pointer hover:border-zinc-400 transition-colors ${
                    m.status === "completed"
                      ? "bg-zinc-100 opacity-75"
                      : m.status === "in_progress"
                        ? "bg-green-50 border-green-200"
                        : "bg-white dark:bg-zinc-900"
                  }`}
                  onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1 flex items-center justify-end gap-4">
                      <span
                        className={`font-bold ${m.status === "completed" ? (m.isDraw ? "text-orange-500" : m.winnerId === m.playerAId ? "text-green-600" : "text-red-600") : ""}`}
                      >
                        {m.playerAName}
                      </span>
                      {m.status === "completed" ? (
                        <span
                          className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? "text-orange-500 bg-orange-50" : m.winnerId === m.playerAId ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}
                        >
                          {m.isDraw
                            ? "D"
                            : m.winnerId === m.playerAId
                              ? "W"
                              : "L"}
                        </span>
                      ) : (
                        <span className="text-2xl font-mono bg-white dark:bg-zinc-900 px-3 py-1 rounded border dark:border-zinc-800">
                          {m.playerALegs}
                        </span>
                      )}
                    </div>
                    <div className="px-4 flex flex-col items-center">
                      <span className="text-zinc-400 text-sm font-medium">
                        {m.status === "completed"
                          ? "FT"
                          : m.status === "in_progress"
                            ? "LIVE"
                            : "VS"}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase">
                        {m.phase}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center justify-start gap-4">
                      {m.status === "completed" ? (
                        <span
                          className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? "text-orange-500 bg-orange-50" : m.winnerId === m.playerBId ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"}`}
                        >
                          {m.isDraw
                            ? "D"
                            : m.winnerId === m.playerBId
                              ? "W"
                              : "L"}
                        </span>
                      ) : (
                        <span className="text-2xl font-mono bg-white dark:bg-zinc-900 px-3 py-1 rounded border dark:border-zinc-800">
                          {m.playerBLegs}
                        </span>
                      )}
                      <span
                        className={`font-bold ${m.status === "completed" ? (m.isDraw ? "text-orange-500" : m.winnerId === m.playerBId ? "text-green-600" : "text-red-600") : ""}`}
                      >
                        {m.playerBName}
                      </span>
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
            <div
              className={`grid gap-8 p-4 bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-x-auto ${players.length >= 8 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              {players.length >= 8 && (
                <div className="space-y-4 min-w-[200px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-zinc-500 uppercase text-sm">
                      Quarter Finals
                    </h3>
                    {matches.filter((m) => m.phase === "quarter").length > 0 &&
                      matches.filter((m) => m.phase === "semi").length ===
                        0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateNextRound("quarter")}
                        >
                          Next Round
                        </Button>
                      )}
                  </div>
                  {matches
                    .filter((m) => m.phase === "quarter")
                    .map((m) => (
                      <Card
                        key={m.id}
                        className="cursor-pointer hover:border-zinc-400"
                        onClick={() =>
                          router.push(`/tournament/${id}/match/${m.id}`)
                        }
                      >
                        <div className="p-3 text-sm flex justify-between border-b">
                          <span
                            className={
                              m.winnerId === m.playerAId ? "font-bold" : ""
                            }
                          >
                            {m.playerAName}
                          </span>
                          <span className="font-mono">{m.playerALegs}</span>
                        </div>
                        <div className="p-3 text-sm flex justify-between">
                          <span
                            className={
                              m.winnerId === m.playerBId ? "font-bold" : ""
                            }
                          >
                            {m.playerBName}
                          </span>
                          <span className="font-mono">{m.playerBLegs}</span>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
              <div
                className={`space-y-4 min-w-[200px] ${players.length >= 8 ? "mt-12" : ""}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-500 uppercase text-sm">
                    Semi Finals
                  </h3>
                  {matches.filter((m) => m.phase === "semi").length > 0 &&
                    matches.filter((m) => m.phase === "final").length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateNextRound("semi")}
                      >
                        Next Round
                      </Button>
                    )}
                </div>
                {matches
                  .filter((m) => m.phase === "semi")
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="cursor-pointer hover:border-zinc-400"
                      onClick={() =>
                        router.push(`/tournament/${id}/match/${m.id}`)
                      }
                    >
                      <div className="p-3 text-sm flex justify-between border-b">
                        <span
                          className={
                            m.winnerId === m.playerAId ? "font-bold" : ""
                          }
                        >
                          {m.playerAName}
                        </span>
                        <span className="font-mono">{m.playerALegs}</span>
                      </div>
                      <div className="p-3 text-sm flex justify-between">
                        <span
                          className={
                            m.winnerId === m.playerBId ? "font-bold" : ""
                          }
                        >
                          {m.playerBName}
                        </span>
                        <span className="font-mono">{m.playerBLegs}</span>
                      </div>
                    </Card>
                  ))}
              </div>
              <div
                className={`space-y-4 min-w-[200px] ${players.length >= 8 ? "mt-24" : "mt-12"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-zinc-500 uppercase text-sm">
                    Final
                  </h3>
                  {matches.filter(
                    (m) => m.phase === "final" && m.status === "completed",
                  ).length > 0 &&
                    tournament.status !== "completed" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await updateDoc(doc(db, "tournaments", id), {
                            status: "completed",
                          });
                        }}
                      >
                        Complete Tournament
                      </Button>
                    )}
                </div>
                {matches
                  .filter((m) => m.phase === "final")
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="cursor-pointer hover:border-zinc-400"
                      onClick={() =>
                        router.push(`/tournament/${id}/match/${m.id}`)
                      }
                    >
                      <div className="p-3 text-sm flex justify-between border-b">
                        <span
                          className={
                            m.winnerId === m.playerAId
                              ? "font-bold text-green-600"
                              : ""
                          }
                        >
                          {m.playerAName}
                        </span>
                        <span className="font-mono">{m.playerALegs}</span>
                      </div>
                      <div className="p-3 text-sm flex justify-between">
                        <span
                          className={
                            m.winnerId === m.playerBId
                              ? "font-bold text-green-600"
                              : ""
                          }
                        >
                          {m.playerBName}
                        </span>
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
                    const finalMatch = matches.find((m) => m.phase === "final");
                    const semiMatches = matches.filter(
                      (m) => m.phase === "semi",
                    );
                    const quarterMatches = matches.filter(
                      (m) => m.phase === "quarter",
                    );

                    let rankedPlayers = [...players].map((p) => {
                      let rankScore = 0;
                      if (finalMatch?.winnerId === p.id) rankScore = 10000;
                      else if (
                        finalMatch &&
                        (finalMatch.playerAId === p.id ||
                          finalMatch.playerBId === p.id)
                      )
                        rankScore = 9000;
                      else if (
                        semiMatches.some(
                          (m) => m.playerAId === p.id || m.playerBId === p.id,
                        )
                      )
                        rankScore = 8000;
                      else if (
                        quarterMatches.some(
                          (m) => m.playerAId === p.id || m.playerBId === p.id,
                        )
                      )
                        rankScore = 7000;

                      rankScore +=
                        (p.points || 0) * 100 +
                        (p.wins || 0) * 10 -
                        (p.losses || 0);

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
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-4 border dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900"
                        >
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
                                  await updateDoc(
                                    doc(db, "tournaments", id, "players", p.id),
                                    {
                                      stayedUntilFinal: e.target.checked,
                                    },
                                  );
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

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tournament</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this tournament? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteTournament}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
