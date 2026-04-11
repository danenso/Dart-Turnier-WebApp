"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";

export default function CasualGamesPage() {
  const { user, isAuthReady } = useFirebase();
  const router = useRouter();
  const [casualGames, setCasualGames] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Single Match state
  const [isSingleMatchDialogOpen, setIsSingleMatchDialogOpen] = useState(false);
  const [casualGameType, setCasualGameType] = useState<
    "single_match" | "tiebreak"
  >("single_match");
  const [players, setPlayers] = useState<any[]>([]);
  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [tiebreakPlayerIds, setTiebreakPlayerIds] = useState<string[]>([]);
  const [singleMatchFormat, setSingleMatchFormat] = useState("301"); // 301 or 501
  const [singleMatchBestOf, setSingleMatchBestOf] = useState("3"); // 1, 3, 5
  const [singleAllowSingleOut, setSingleAllowSingleOut] = useState(false);
  const [singleAllowDoubleOut, setSingleAllowDoubleOut] = useState(true);
  const [singleAllowTripleOut, setSingleAllowTripleOut] = useState(false);
  const [singleAllowDraw, setSingleAllowDraw] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, "tournaments"),
      where("ownerId", "==", user.uid),
    );
    const unsubscribeTournaments = onSnapshot(
      q,
      (snapshot) => {
        const allDocs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        }));
        // Sort by createdAt descending locally
        allDocs.sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        const c = allDocs.filter(
          (doc) =>
            doc.type === "single_match" || doc.type === "casual_tiebreak",
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
        const p = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

  const createCasualGame = async () => {
    if (!user) return;

    if (casualGameType === "single_match") {
      if (!player1Id || !player2Id) return;
      if (player1Id === player2Id) {
        alert("Please select two different players.");
        return;
      }

      setIsCreating(true);
      try {
        const p1 = players.find((p) => p.id === player1Id);
        const p2 = players.find((p) => p.id === player2Id);

        if (!p1 || !p2) return;

        const docRef = await addDoc(collection(db, "tournaments"), {
          title: `Single Match: ${p1.name} vs ${p2.name}`,
          status: "single_match",
          type: "single_match",
          allowSingleOut: singleAllowSingleOut,
          allowDoubleOut: singleAllowDoubleOut,
          allowTripleOut: singleAllowTripleOut,
          allowDraw: singleAllowDraw,
          createdAt: new Date().toISOString(),
          ownerId: user.uid,
        });

        const format = `${singleMatchFormat}_bo${singleMatchBestOf}`;
        const rest = parseInt(singleMatchFormat);

        const matchRef = await addDoc(
          collection(db, "tournaments", docRef.id, "matches"),
          {
            phase: "final",
            playerAId: p1.id,
            playerBId: p2.id,
            playerAName: p1.name,
            playerBName: p2.name,
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
      // Tiebreak
      if (tiebreakPlayerIds.length < 2) {
        alert("Please select at least two players for a tiebreak.");
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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Freies Spiel
            </h1>
            <p className="text-zinc-500">
              Casual matches and tiebreaks for fun.
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Dialog
              open={isSingleMatchDialogOpen}
              onOpenChange={setIsSingleMatchDialogOpen}
            >
              <Button
                className="w-full sm:w-auto"
                onClick={() => setIsSingleMatchDialogOpen(true)}
              >
                Neues Spiel
              </Button>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Freies Spiel (Casual Game)</DialogTitle>
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
                        <Label>Player 1</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={player1Id}
                          onChange={(e) => setPlayer1Id(e.target.value)}
                        >
                          <option value="">Select Player 1</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Player 2</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={player2Id}
                          onChange={(e) => setPlayer2Id(e.target.value)}
                        >
                          <option value="">Select Player 2</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2 mt-4">
                        <Label>Format</Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleFormat"
                              value="301"
                              checked={singleMatchFormat === "301"}
                              onChange={(e) =>
                                setSingleMatchFormat(e.target.value)
                              }
                            />
                            301
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleFormat"
                              value="501"
                              checked={singleMatchFormat === "501"}
                              onChange={(e) =>
                                setSingleMatchFormat(e.target.value)
                              }
                            />
                            501
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2 mt-4">
                        <Label>Best Of</Label>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleBestOf"
                              value="1"
                              checked={singleMatchBestOf === "1"}
                              onChange={(e) =>
                                setSingleMatchBestOf(e.target.value)
                              }
                            />
                            Best of 1
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleBestOf"
                              value="3"
                              checked={singleMatchBestOf === "3"}
                              onChange={(e) =>
                                setSingleMatchBestOf(e.target.value)
                              }
                            />
                            Best of 3
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="singleBestOf"
                              value="5"
                              checked={singleMatchBestOf === "5"}
                              onChange={(e) =>
                                setSingleMatchBestOf(e.target.value)
                              }
                            />
                            Best of 5
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2 mt-4">
                        <Label>Out Rules</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="singleSingleOut"
                            checked={singleAllowSingleOut}
                            onChange={(e) =>
                              setSingleAllowSingleOut(e.target.checked)
                            }
                          />
                          <Label
                            htmlFor="singleSingleOut"
                            className="font-normal"
                          >
                            Single Out (incl. Bull)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="singleDoubleOut"
                            checked={singleAllowDoubleOut}
                            onChange={(e) =>
                              setSingleAllowDoubleOut(e.target.checked)
                            }
                          />
                          <Label
                            htmlFor="singleDoubleOut"
                            className="font-normal"
                          >
                            Double Out (incl. Bull&apos;s Eye)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="singleTripleOut"
                            checked={singleAllowTripleOut}
                            onChange={(e) =>
                              setSingleAllowTripleOut(e.target.checked)
                            }
                          />
                          <Label
                            htmlFor="singleTripleOut"
                            className="font-normal"
                          >
                            Triple Out (incl. Bull&apos;s Eye)
                          </Label>
                        </div>
                      </div>

                      <div className="grid gap-2 mt-4">
                        <Label>Match Rules</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="singleAllowDraw"
                            checked={singleAllowDraw}
                            onChange={(e) =>
                              setSingleAllowDraw(e.target.checked)
                            }
                            disabled={singleMatchBestOf !== "1"}
                          />
                          <Label
                            htmlFor="singleAllowDraw"
                            className="font-normal"
                          >
                            Allow Draw (Best of 1 only)
                          </Label>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-2">
                      <Label>Select Players (min. 2)</Label>
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
                                    tiebreakPlayerIds.filter(
                                      (id) => id !== p.id,
                                    ),
                                  );
                                }
                              }}
                            />
                            {p.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsSingleMatchDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createCasualGame}
                    disabled={
                      isCreating ||
                      (casualGameType === "single_match" &&
                        (!player1Id || !player2Id || player1Id === player2Id)) ||
                      (casualGameType === "tiebreak" &&
                        tiebreakPlayerIds.length < 2)
                    }
                  >
                    {isCreating ? "Starting..." : "Start Game"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {casualGames.map((t) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:border-zinc-400 transition-colors"
              onClick={() => router.push(`/tournament/${t.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{t.title}</CardTitle>
                <CardDescription>
                  {new Date(t.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-zinc-100 text-zinc-900">
                  {t.type === "casual_tiebreak" ? "TIEBREAK" : "SINGLE MATCH"}
                </div>
              </CardContent>
            </Card>
          ))}
          {casualGames.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
              <p className="text-zinc-500">
                No casual games yet. Create one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
