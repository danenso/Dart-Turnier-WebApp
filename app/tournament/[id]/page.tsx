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
import { ArrowLeft, Trash2, Users, ClipboardList, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { CheckoutBuilder } from "@/components/CheckoutBuilder";
import { CheckoutConfig, DEFAULT_CHECKOUT_CONFIG, fromLegacyBooleans } from "@/lib/checkout-rules";
import { MatchStartSelector } from "@/components/MatchStartSelector";
import { DrawRule, MatchStartConfig, DEFAULT_DRAW_RULE, DEFAULT_MATCH_START } from "@/lib/match-rules";
import { grantTournamentAchievements, grantGrandFinalAchievements } from "@/lib/achievementEngine";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { TiebreakManager } from "@/components/TiebreakManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const { user, isAuthReady, isAdmin, isSuperAdmin } = useFirebase();
  const router = useRouter();

  const [tournament, setTournament] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [tiebreaks, setTiebreaks] = useState<any[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [globalPlayers, setGlobalPlayers] = useState<any[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // Retroaktive Match-Eingabe
  const [isRetroMatchDialogOpen, setIsRetroMatchDialogOpen] = useState(false);
  const [retroFormat, setRetroFormat] = useState<'501_bo1' | '501_bo3' | '301_bo1' | '301_bo3'>('501_bo3');
  type RetroPair = { aId: string; aName: string; bId: string; bName: string; key: string };
  const [retroPairs, setRetroPairs] = useState<RetroPair[]>([]);
  const [retroScores, setRetroScores] = useState<Record<string, { legsA: number; legsB: number }>>({});
  const [isSavingRetroMatches, setIsSavingRetroMatches] = useState(false);
  // Retroaktiv – Nur Platzierungen
  const [retroMode, setRetroMode] = useState<'matches' | 'placements'>('matches');
  const [retroPlacements, setRetroPlacements] = useState<Record<number, string>>({}); // placement → playerId
  const [retroParticipants, setRetroParticipants] = useState<string[]>([]); // playerIds who participated

  // Settings-Edit-Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCheckout, setEditCheckout] = useState<CheckoutConfig>(DEFAULT_CHECKOUT_CONFIG);
  const [editDrawRule, setEditDrawRule] = useState<DrawRule>(DEFAULT_DRAW_RULE);
  const [editMatchStart, setEditMatchStart] = useState<MatchStartConfig>(DEFAULT_MATCH_START);
  const [editBoards, setEditBoards] = useState(1);
  const [editTiebreakHits, setEditTiebreakHits] = useState(4);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [matchViewMode, setMatchViewMode] = useState<"card" | "list">("card");
  const [activeTab, setActiveTab] = useState("participants");

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
          router.push("/tournaments");
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

    const q = query(collection(db, "players"));
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

  // Auto-Tab-Wechsel wenn Phase wechselt
  useEffect(() => {
    if (!tournament) return;
    const status = tournament.status;
    if (status === "groups") {
      setActiveTab("groups");
    } else if (status === "tiebreaks") {
      setActiveTab("tiebreaks");
    } else if (status === "bracket") {
      setActiveTab("bracket");
    } else if (status === "completed") {
      setActiveTab("results");
    }
  }, [tournament?.status]);

  // Format-Label (z.B. "501 · Bo3")
  const fmtLabel = (fmt: string | undefined) => {
    if (!fmt) return "";
    const m = fmt.match(/^(301|501|701)_bo(\d+)$/);
    return m ? `${m[1]} · Bo${m[2]}` : fmt;
  };

  // Heading-Font Style für Nickname-Anzeige
  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--font-heading, sans-serif)",
    fontWeight: "var(--heading-weight, 700)" as any,
    textTransform: "var(--heading-transform, none)" as any,
    fontStyle: "var(--heading-style, normal)",
  };

  // Nickname aus globalPlayers holen (Tournament-Player-ID = Global-Player-ID)
  const getPlayerNickname = (playerId: string) => {
    const gp = globalPlayers.find((g) => g.id === playerId);
    return gp?.nickname || null;
  };

  // Anzeigename: Nickname wenn vorhanden, sonst Name
  const getDisplayName = (playerId: string, fallbackName?: string) => {
    return getPlayerNickname(playerId) || fallbackName || playerId;
  };

  // Avatar-URL aus globalPlayers
  const getPlayerAvatar = (playerId: string) => {
    const gp = globalPlayers.find((g) => g.id === playerId);
    return gp?.avatar || null;
  };

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
      alert("Mindestens 4 Spieler für die Endrunde erforderlich.");
      return;
    }

    const groupMatches = matches.filter((m) => m.phase === "group");
    if (
      groupMatches.length === 0 ||
      groupMatches.some((m) => m.status !== "completed")
    ) {
      alert(
        "Alle Gruppenspiele müssen abgeschlossen sein, bevor die Endrunde generiert werden kann.",
      );
      return;
    }

    // Check if we are already in tiebreaks phase
    if (tournament.status === "tiebreaks") {
      const pendingTiebreaks = tiebreaks.filter(
        (tb) => tb.status !== "completed",
      );
      if (pendingTiebreaks.length > 0) {
        alert("Bitte zuerst alle Tiebreaks abschließen.");
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

        const gfc = tournament?.grandFinalConfig;
        const pf = tournament?.phaseFormats;
        const startScore = (fmt: string) => fmt.startsWith("301") ? 301 : 501;
        const phaseFormat = isTop4
          ? (gfc?.semiFormat ?? pf?.semi ?? tournament?.format ?? "501_bo3")
          : (gfc?.quarterFormat ?? pf?.quarter ?? tournament?.format ?? "501_bo3");

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
            playerARest: startScore(phaseFormat),
            playerBRest: startScore(phaseFormat),
            answerThrowActive: false,
            status: "pending",
            format: phaseFormat,
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
      alert("Nicht alle Spiele dieser Runde sind abgeschlossen.");
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

        const sfGfc = tournament?.grandFinalConfig;
        const sfPf = tournament?.phaseFormats;
        const sfFmt = sfGfc?.semiFormat ?? sfPf?.semi ?? tournament?.format ?? "501_bo3";
        const sfStart = sfFmt.startsWith("301") ? 301 : 501;

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
            playerARest: sfStart,
            playerBRest: sfStart,
            answerThrowActive: false,
            status: "pending",
            format: sfFmt,
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

        const finGfc = tournament?.grandFinalConfig;
        const finPf = tournament?.phaseFormats;
        const finFmt = finGfc?.finalFormat ?? finPf?.final ?? tournament?.format ?? "501_bo5";
        const finStart = finFmt.startsWith("301") ? 301 : 501;

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
          playerARest: finStart,
          playerBRest: finStart,
          answerThrowActive: false,
          status: "pending",
          format: finFmt,
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    }
  };
  const startDraw = async () => {
    if (players.length < 4) {
      alert("Mindestens 4 Spieler für den Start erforderlich.");
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
      const grpFmt = tournament?.phaseFormats?.group ?? "301_bo1";
      const grpStart = grpFmt.startsWith("501") ? 501 : grpFmt.startsWith("701") ? 701 : 301;
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
              playerARest: grpStart,
              playerBRest: grpStart,
              answerThrowActive: false,
              status: "pending",
              format: grpFmt,
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

  const openRetroMatchDialog = () => {
    // Alle Round-Robin-Paare erzeugen
    const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));
    const pairs: { aId: string; aName: string; bId: string; bName: string; key: string }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        pairs.push({
          aId: sorted[i].id,
          aName: sorted[i].name,
          bId: sorted[j].id,
          bName: sorted[j].name,
          key: `${sorted[i].id}-${sorted[j].id}`,
        });
      }
    }
    setRetroPairs(pairs);

    // Vorbelegen aus bereits gespeicherten Matches
    const preScores: Record<string, { legsA: number; legsB: number }> = {};
    matches.filter((m) => m.status === "completed").forEach((m) => {
      const key = `${m.playerAId}-${m.playerBId}`;
      const reverseKey = `${m.playerBId}-${m.playerAId}`;
      const pair = pairs.find((p) => p.key === key || p.key === reverseKey);
      if (pair) {
        const isReverse = pair.key === reverseKey;
        preScores[pair.key] = isReverse
          ? { legsA: m.playerBLegs ?? 0, legsB: m.playerALegs ?? 0 }
          : { legsA: m.playerALegs ?? 0, legsB: m.playerBLegs ?? 0 };
      }
    });
    setRetroScores(preScores);

    // Format aus Turnier übernehmen oder Standard
    const fmt = tournament?.format;
    if (fmt === '501_bo1' || fmt === '501_bo3' || fmt === '301_bo1' || fmt === '301_bo3') {
      setRetroFormat(fmt);
    } else {
      setRetroFormat('501_bo3');
    }

    setRetroMode('matches');
    setRetroPlacements({});
    setRetroParticipants([]);
    setIsRetroMatchDialogOpen(true);
  };

  const saveRetroMatches = async () => {
    if (!user) return;
    setIsSavingRetroMatches(true);
    try {
      // Bestehende group-Matches löschen (re-entry)
      const existingGroupMatches = matches.filter((m) => m.phase === 'group');
      for (const m of existingGroupMatches) {
        await deleteDoc(doc(db, "tournaments", id, "matches", m.id));
      }

      const bestOfMatch = retroFormat.match(/bo(\d+)/);
      const bestOf = bestOfMatch ? parseInt(bestOfMatch[1]) : 3;
      const drawAllowed = tournament?.drawRule?.enabled || tournament?.allowDraw;

      // Player-Stats aggregieren
      const stats: Record<string, { wins: number; draws: number; losses: number; points: number; matchesPlayed: number }> = {};
      players.forEach((p) => {
        stats[p.id] = { wins: 0, draws: 0, losses: 0, points: 0, matchesPlayed: 0 };
      });

      // Neue Match-Dokumente anlegen
      for (const pair of retroPairs) {
        const score = retroScores[pair.key];
        if (!score) continue; // nicht eingetragen → überspringen

        const { legsA, legsB } = score;
        const isDraw = drawAllowed && bestOf === 1 && legsA === 0 && legsB === 0;
        const winnerId = isDraw ? null : legsA > legsB ? pair.aId : pair.bId;

        await addDoc(collection(db, "tournaments", id, "matches"), {
          phase: 'group',
          playerAId: pair.aId,
          playerBId: pair.bId,
          playerAName: pair.aName,
          playerBName: pair.bName,
          playerALegs: legsA,
          playerBLegs: legsB,
          status: 'completed',
          format: retroFormat,
          winnerId: winnerId ?? '',
          isDraw: isDraw || false,
        });

        // Stats berechnen
        if (isDraw) {
          if (stats[pair.aId]) { stats[pair.aId].draws++; stats[pair.aId].points++; stats[pair.aId].matchesPlayed++; }
          if (stats[pair.bId]) { stats[pair.bId].draws++; stats[pair.bId].points++; stats[pair.bId].matchesPlayed++; }
        } else if (winnerId === pair.aId) {
          if (stats[pair.aId]) { stats[pair.aId].wins++; stats[pair.aId].points += 2; stats[pair.aId].matchesPlayed++; }
          if (stats[pair.bId]) { stats[pair.bId].losses++; stats[pair.bId].matchesPlayed++; }
        } else if (winnerId === pair.bId) {
          if (stats[pair.bId]) { stats[pair.bId].wins++; stats[pair.bId].points += 2; stats[pair.bId].matchesPlayed++; }
          if (stats[pair.aId]) { stats[pair.aId].losses++; stats[pair.aId].matchesPlayed++; }
        }
      }

      // Player-Dokumente updaten
      for (const p of players) {
        const s = stats[p.id];
        if (!s) continue;
        await setDoc(doc(db, "tournaments", id, "players", p.id), {
          name: p.name,
          points: s.points,
          matchesPlayed: s.matchesPlayed,
          wins: s.wins,
          draws: s.draws,
          losses: s.losses,
        });
      }

      // Turnier abschließen
      await updateDoc(doc(db, "tournaments", id), {
        status: "completed",
        format: retroFormat,
        ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
        ...(tournament.tournamentNumber !== undefined ? { tournamentNumber: tournament.tournamentNumber } : {}),
        ...(tournament.isFinalTournament ? { isFinalTournament: true } : {}),
        isRetroactive: true,
      });

      // Achievements nach dem Status-Update vergeben
      try {
        await grantTournamentAchievements(
          id,
          { ...tournament, seasonId: tournament.seasonId },
          players,
          [],  // Retroaktive Turniere haben keine Match-Dokumente für perfect-group
        );
      } catch (_) {
        // Achievement errors don't block completion
      }

      setIsRetroMatchDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    } finally {
      setIsSavingRetroMatches(false);
    }
  };

  const saveRetroPlacements = async () => {
    if (!user) return;
    setIsSavingRetroMatches(true);
    try {
      // Bestehende Matches löschen
      for (const m of matches.filter((m) => m.phase === 'group')) {
        await deleteDoc(doc(db, "tournaments", id, "matches", m.id));
      }

      // Alle Teilnehmer = explizite Placements + retroParticipants
      const placedIds = Object.values(retroPlacements).filter(Boolean);
      const allParticipantIds = [...new Set([...placedIds, ...retroParticipants])];

      // Punkte nach Konzept: 1. → 7 (5+1+1), 2. → 6 (4+1+1), 3. → 4 (3+1), 4. → 3 (2+1), Rest → 1
      const pointsByPlacement: Record<number, number> = { 1: 7, 2: 6, 3: 4, 4: 3 };

      // Player-Dokumente updaten
      for (const p of players) {
        const placement = Object.entries(retroPlacements).find(([, pid]) => pid === p.id);
        const placementNum = placement ? parseInt(placement[0]) : 0;
        const participated = allParticipantIds.includes(p.id);
        if (!participated) continue;

        const points = placementNum > 0 ? (pointsByPlacement[placementNum] ?? 1) : 1;
        const wins = placementNum === 1 ? 1 : 0;

        await setDoc(doc(db, "tournaments", id, "players", p.id), {
          name: p.name,
          points,
          matchesPlayed: 1,
          wins,
          draws: 0,
          losses: placementNum > 1 ? 1 : 0,
          placement: placementNum || undefined,
        });
      }

      // Turnier abschließen
      await updateDoc(doc(db, "tournaments", id), {
        status: "completed",
        ...(tournament.seasonId ? { seasonId: tournament.seasonId } : {}),
        ...(tournament.tournamentNumber !== undefined ? { tournamentNumber: tournament.tournamentNumber } : {}),
        ...(tournament.isFinalTournament ? { isFinalTournament: true } : {}),
        isRetroactive: true,
        entryMode: 'placements-only',
      });

      // Achievements vergeben – Spieler nach Platzierung sortiert
      try {
        const sortedByPlacement = allParticipantIds
          .map((pid) => {
            const pl = Object.entries(retroPlacements).find(([, id]) => id === pid);
            const p = players.find((p) => p.id === pid);
            return {
              id: pid,
              name: p?.name ?? '',
              placement: pl ? parseInt(pl[0]) : 99,
              points: pl ? (pointsByPlacement[parseInt(pl[0])] ?? 1) : 1,
              wins: pl && parseInt(pl[0]) === 1 ? 1 : 0,
              losses: 0,
            };
          })
          .sort((a, b) => a.placement - b.placement);

        await grantTournamentAchievements(
          id,
          { ...tournament, seasonId: tournament.seasonId },
          sortedByPlacement,
          [],
        );
      } catch (_) {
        // Achievement errors don't block completion
      }

      setIsRetroMatchDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    } finally {
      setIsSavingRetroMatches(false);
    }
  };

  const openEditDialog = () => {
    if (!tournament) return;
    setEditTitle(tournament.title ?? "");
    setEditCheckout(
      tournament.checkoutRule ??
      fromLegacyBooleans(
        tournament.allowSingleOut ?? false,
        tournament.allowDoubleOut !== false,
        tournament.allowTripleOut ?? false,
      ),
    );
    setEditDrawRule(tournament.drawRule ?? DEFAULT_DRAW_RULE);
    setEditMatchStart(tournament.matchStartConfig ?? DEFAULT_MATCH_START);
    setEditBoards(tournament.numberOfBoards ?? 1);
    setEditTiebreakHits(tournament.tiebreakHits ?? 4);
    setIsEditOpen(true);
  };

  const saveSettings = async () => {
    if (!editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      const updates: any = { title: editTitle.trim(), numberOfBoards: editBoards, tiebreakHits: editTiebreakHits };
      if (tournament.status === "draft") {
        updates.checkoutRule = editCheckout;
        updates.drawRule = editDrawRule;
        updates.matchStartConfig = editMatchStart;
      }
      await updateDoc(doc(db, "tournaments", id), updates);
      setIsEditOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tournaments/${id}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const deleteTournament = async () => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, "tournaments", id));
      router.push("/tournaments");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tournaments/${id}`);
    }
  };

  if (!tournament) return <div className="p-8">Loading...</div>;

  if (tournament.type === "casual_tiebreak") {
    return (
      <div className="page-pad">
        <div className="section-gap">
          <Button
            variant="ghost"
            onClick={() => router.push("/casual")}
            className="-ml-4 mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zu Freies Spiel
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {tournament.title}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200">
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
                <Trash2 className="w-4 h-4 mr-2" /> Löschen
              </Button>
            )}
          </div>

          <div className={`mt-8 ${(tournament.numberOfBoards ?? 1) > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex gap-4 overflow-x-auto pb-2"}`}>
            {tiebreaks.map((tb) => (
              <div key={tb.id} className={(tournament.numberOfBoards ?? 1) === 1 ? "min-w-[340px] flex-shrink-0" : undefined}>
                <TiebreakManager
                  tournamentId={id}
                  tiebreak={tb}
                  isAdmin={isAdmin}
                  tiebreakHits={tournament.tiebreakHits ?? 4}
                />
              </div>
            ))}
          </div>

          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tiebreak löschen?</DialogTitle>
                <DialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button variant="destructive" onClick={deleteTournament}>
                  Löschen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.push("/tournaments")}
          className="-ml-4 mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Zurück zu Turnieren
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {tournament.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200">
                {tournament.status.toUpperCase()}
              </span>
              {tournament.isRetroactive && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700">
                  Retroaktiv
                </span>
              )}
              {tournament.isFinalTournament && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800">
                  Finale
                </span>
              )}
              {tournament.tournamentNumber && !tournament.isFinalTournament && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
                  #{tournament.tournamentNumber}
                </span>
              )}
              <span className="text-sm text-zinc-500 flex items-center gap-1">
                <Users className="h-4 w-4" /> {players.length} Spieler
              </span>
              {(tournament.numberOfBoards ?? 1) > 1 && (
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  🎯 {tournament.numberOfBoards} Scheiben
                </span>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={openEditDialog}
                title="Einstellungen"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
              <Button
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="flex-1 sm:flex-none"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Turnier löschen
              </Button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="relative mb-0 h-[36px]">
            <TabsList
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeave}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              className={cn(
                "flex w-full overflow-x-auto justify-start gap-2 h-[36px] bg-transparent p-0 select-none",
                "cursor-grab active:cursor-grabbing",
                "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              )}
            >
              <TabsTrigger 
                value="participants"
                className={cn(
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Teilnehmer
              </TabsTrigger>
              <TabsTrigger
                value="groups"
                disabled={tournament.status === "draft"}
                className={cn(
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Gruppen
              </TabsTrigger>
              <TabsTrigger
                value="matches"
                disabled={tournament.status === "draft"}
                className={cn(
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Spiele
              </TabsTrigger>
              <TabsTrigger
                value="tiebreaks"
                disabled={tournament.status !== "tiebreaks"}
                className={cn(
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
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
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Endrunde
              </TabsTrigger>
              <TabsTrigger
                value="results"
                disabled={tournament.status !== "completed"}
                className={cn(
                  "flex-none rounded-full px-4 py-1 text-sm font-semibold transition-all duration-200",
                  "bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800",
                  "text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100",
                  "data-[state=active]:bg-zinc-900 data-[state=active]:text-white data-[state=active]:border-zinc-900",
                  "dark:data-[state=active]:bg-zinc-100 dark:data-[state=active]:text-zinc-900 dark:data-[state=active]:border-zinc-100",
                  "shadow-sm after:hidden"
                )}
              >
                Ergebnisse
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="participants" className="mt-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 h-fit">
                <CardHeader>
                  <CardTitle>Spieler hinzufügen</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={addPlayer} className="space-y-4">
                    <Input
                      placeholder="Spielername"
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
                      Spieler hinzufügen
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Spielerliste</CardTitle>
                  {tournament.isRetroactive && tournament.status === "draft" && (
                    <Button
                      onClick={openRetroMatchDialog}
                      disabled={players.length < 2}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Matches eintragen
                    </Button>
                  )}
                  {tournament.isRetroactive && tournament.status === "completed" && isAdmin && (
                    <Button
                      onClick={openRetroMatchDialog}
                      variant="outline"
                      size="sm"
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Matches bearbeiten
                    </Button>
                  )}
                  {!tournament.isRetroactive && tournament.status === "draft" && (
                    <Button onClick={startDraw} disabled={players.length < 4}>
                      Auslosung starten
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
                          <span className="font-medium" style={getPlayerNickname(p.id) ? headingStyle : undefined}>
                            {getDisplayName(p.id, p.name)}
                          </span>
                          {getPlayerNickname(p.id) && (
                            <span className="text-xs text-zinc-400">{p.name}</span>
                          )}
                          {p.groupId && (
                            <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                              Gruppe {p.groupId}
                            </span>
                          )}
                        </div>
                        {tournament.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayer(p.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {players.length === 0 && (
                      <p className="text-center text-zinc-500 py-8">
                        Noch keine Spieler hinzugefügt.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="groups">
            <div className="flex items-center justify-between mb-4">
              {tournament.phaseFormats?.group && (
                <span className="text-xs text-zinc-400">Gruppenformat: <strong>{fmtLabel(tournament.phaseFormats.group)}</strong></span>
              )}
              <div className="flex-1" />
              {tournament.status === "groups" && (() => {
                const groupMatches = matches.filter((m) => m.phase === "group");
                const allCompleted = groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed");
                const canGenerate = players.length >= 4 && allCompleted;
                return (
                  <div className="flex items-center gap-3">
                    {!canGenerate && players.length >= 4 && (
                      <span className="text-xs text-zinc-400">
                        {groupMatches.length === 0 ? "Noch keine Gruppenspiele" : `${groupMatches.filter((m) => m.status !== "completed").length} Spiel(e) offen`}
                      </span>
                    )}
                    <Button onClick={generateBracket} disabled={!canGenerate}>
                      Endrunde generieren {players.length >= 8 ? "(Top 8)" : "(Top 4)"}
                    </Button>
                  </div>
                );
              })()}
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
                      <CardTitle>Gruppe {groupId}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50">
                            <tr>
                              <th className="px-4 py-2">Spieler</th>
                              <th className="px-4 py-2 text-center">SP</th>
                              <th className="px-4 py-2 text-center">S</th>
                              <th className="px-4 py-2 text-center">U</th>
                              <th className="px-4 py-2 text-center">N</th>
                              <th className="px-4 py-2 text-center">Pkt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupPlayers.map((p, i) => (
                              <tr key={p.id} className="border-b">
                                <td className="px-4 py-2 font-medium">
                                  <span style={getPlayerNickname(p.id) ? headingStyle : undefined}>
                                    {i + 1}. {getDisplayName(p.id, p.name)}
                                  </span>
                                  {getPlayerNickname(p.id) && (
                                    <div className="text-xs text-zinc-400 font-normal">{p.name}</div>
                                  )}
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
                <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200 dark:border-zinc-700">
                  <p className="text-zinc-500">
                    Keine Tiebreaks nötig oder generiert.
                  </p>
                </div>
              ) : (
                <div className={(tournament.numberOfBoards ?? 1) > 1 ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex gap-4 overflow-x-auto pb-2"}>
                  {tiebreaks.map((tb) => (
                    <div key={tb.id} className={(tournament.numberOfBoards ?? 1) === 1 ? "min-w-[340px] flex-shrink-0" : undefined}>
                      <TiebreakManager
                        tournamentId={id}
                        tiebreak={tb}
                        isAdmin={isAdmin}
                        tiebreakHits={tournament.tiebreakHits ?? 4}
                      />
                    </div>
                  ))}
                </div>
              )}
              {tournament.status === "tiebreaks" &&
                tiebreaks.every((tb) => tb.status === "completed") && (
                  <div className="flex justify-end mt-4">
                    <Button
                      onClick={generateBracket}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Weiter zur Endrunde
                    </Button>
                  </div>
                )}
            </div>
          </TabsContent>

          <TabsContent value="matches">
            {/* View Toggle */}
            {matches.filter((m) => m.phase === "group").length > 0 && (
              <div className="flex justify-end mb-3">
                <div className="flex border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setMatchViewMode("card")}
                    className={cn("px-3 py-1.5 text-xs font-medium transition-colors", matchViewMode === "card" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  >
                    Karten
                  </button>
                  <button
                    onClick={() => setMatchViewMode("list")}
                    className={cn("px-3 py-1.5 text-xs font-medium transition-colors border-l border-zinc-200 dark:border-zinc-700", matchViewMode === "list" ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900" : "bg-white dark:bg-zinc-900 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  >
                    Liste
                  </button>
                </div>
              </div>
            )}

            {/* CARD VIEW */}
            {matchViewMode === "card" && (
              <div className="grid gap-4">
                {matches.filter((m) => m.phase === "group").map((m) => (
                  <Card
                    key={m.id}
                    className={`cursor-pointer hover:border-zinc-400 transition-colors ${
                      m.status === "completed"
                        ? "bg-zinc-100 dark:bg-zinc-800/50 opacity-75"
                        : m.status === "in_progress"
                          ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                          : "bg-white dark:bg-zinc-900"
                    }`}
                    onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex-1 flex items-center justify-end gap-4">
                        <span
                          className={`font-bold ${m.status === "completed" ? (m.isDraw ? "text-orange-500" : m.winnerId === m.playerAId ? "text-green-600" : "text-red-600") : ""}`}
                          style={getPlayerNickname(m.playerAId) ? headingStyle : undefined}
                        >
                          {getDisplayName(m.playerAId, m.playerAName)}
                        </span>
                        {m.status === "completed" ? (
                          <span className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? "text-orange-500 bg-orange-50 dark:bg-orange-950/30" : m.winnerId === m.playerAId ? "text-green-600 bg-green-50 dark:bg-green-950/30" : "text-red-600 bg-red-50 dark:bg-red-950/30"}`}>
                            {m.isDraw ? "D" : m.winnerId === m.playerAId ? "W" : "L"}
                          </span>
                        ) : (
                          <span className="text-2xl font-mono bg-white dark:bg-zinc-900 px-3 py-1 rounded border dark:border-zinc-800">{m.playerALegs}</span>
                        )}
                      </div>
                      <div className="px-4 flex flex-col items-center">
                        <span className="text-zinc-400 text-sm font-medium">
                          {m.status === "completed" ? "FT" : m.status === "in_progress" ? "LIVE" : "VS"}
                        </span>
                        <span className="text-[10px] text-zinc-400 uppercase">{m.phase}</span>
                      </div>
                      <div className="flex-1 flex items-center justify-start gap-4">
                        {m.status === "completed" ? (
                          <span className={`text-2xl font-bold px-3 py-1 rounded ${m.isDraw ? "text-orange-500 bg-orange-50 dark:bg-orange-950/30" : m.winnerId === m.playerBId ? "text-green-600 bg-green-50 dark:bg-green-950/30" : "text-red-600 bg-red-50 dark:bg-red-950/30"}`}>
                            {m.isDraw ? "D" : m.winnerId === m.playerBId ? "W" : "L"}
                          </span>
                        ) : (
                          <span className="text-2xl font-mono bg-white dark:bg-zinc-900 px-3 py-1 rounded border dark:border-zinc-800">{m.playerBLegs}</span>
                        )}
                        <span
                          className={`font-bold ${m.status === "completed" ? (m.isDraw ? "text-orange-500" : m.winnerId === m.playerBId ? "text-green-600" : "text-red-600") : ""}`}
                          style={getPlayerNickname(m.playerBId) ? headingStyle : undefined}
                        >
                          {getDisplayName(m.playerBId, m.playerBName)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* LIST VIEW */}
            {matchViewMode === "list" && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 divide-y dark:divide-zinc-800">
                {matches.filter((m) => m.phase === "group").map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}
                  >
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${m.status === "completed" ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400" : m.status === "in_progress" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                      {m.phase}
                    </span>
                    <span className={`flex-1 text-sm truncate ${m.winnerId === m.playerAId ? "font-bold text-green-600 dark:text-green-400" : ""}`} style={getPlayerNickname(m.playerAId) ? headingStyle : undefined}>
                      {getDisplayName(m.playerAId, m.playerAName)}
                    </span>
                    <span className="text-xs font-mono text-zinc-500 shrink-0">
                      {m.status === "completed" ? `${m.playerALegs ?? 0}–${m.playerBLegs ?? 0}` : "vs"}
                    </span>
                    <span className={`flex-1 text-sm truncate text-right ${m.winnerId === m.playerBId ? "font-bold text-green-600 dark:text-green-400" : ""}`} style={getPlayerNickname(m.playerBId) ? headingStyle : undefined}>
                      {getDisplayName(m.playerBId, m.playerBName)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {matches.filter((m) => m.phase === "group").length === 0 && (
              <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200 dark:border-zinc-700">
                <p className="text-zinc-500">Noch keine Gruppenspiele generiert.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="bracket">
            {/* Helper to render a bracket match card with winner highlighting + name+nickname */}
            {(() => {
              const renderBracketPlayer = (playerId: string, playerName: string, isWinner: boolean) => {
                const nickname = getPlayerNickname(playerId);
                const avatar = getPlayerAvatar(playerId);
                return (
                  <div className={`p-2.5 text-sm flex items-center justify-between ${isWinner ? "bg-green-50 dark:bg-green-900/20" : ""}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatar} alt="" className={`w-5 h-5 rounded-full object-cover shrink-0 ${isWinner ? "ring-2 ring-green-400" : ""}`} />
                      ) : (
                        <div className={`w-5 h-5 rounded-full shrink-0 ${isWinner ? "bg-green-200 dark:bg-green-800" : "bg-zinc-200 dark:bg-zinc-700"}`} />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`truncate text-sm font-semibold ${isWinner ? "text-green-700 dark:text-green-400" : "text-zinc-800 dark:text-zinc-200"}`}
                          style={nickname ? headingStyle : undefined}
                        >
                          {getDisplayName(playerId, playerName)}
                        </div>
                        {nickname && (
                          <div className="text-[10px] text-zinc-400 truncate">{playerName}</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };

              const renderMatchCard = (m: any) => (
                <Card
                  key={m.id}
                  className={`cursor-pointer overflow-hidden transition-all ${m.status === "completed" ? "hover:border-green-400" : "hover:border-zinc-400"}`}
                  onClick={() => router.push(`/tournament/${id}/match/${m.id}`)}
                >
                  <div className={`border-b ${m.winnerId === m.playerAId ? "border-green-200 dark:border-green-800" : "dark:border-zinc-700"}`}>
                    {renderBracketPlayer(m.playerAId, m.playerAName, m.winnerId === m.playerAId)}
                  </div>
                  {renderBracketPlayer(m.playerBId, m.playerBName, m.winnerId === m.playerBId)}
                  {m.status === "completed" && (
                    <div className="px-2.5 pb-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-400">
                        {m.playerALegs ?? 0}–{m.playerBLegs ?? 0}
                      </span>
                      {m.winnerId && (
                        <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                          ✓ {getDisplayName(m.winnerId === m.playerAId ? m.playerAId : m.playerBId, m.winnerId === m.playerAId ? m.playerAName : m.playerBName)} weiter
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );

              return (
            <div
              className={`grid gap-8 p-4 bg-white dark:bg-zinc-900 rounded-lg border dark:border-zinc-800 overflow-x-auto ${players.length >= 8 ? "md:grid-cols-3" : "md:grid-cols-2"}`}
            >
              {players.length >= 8 && (
                <div className="min-w-[200px]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-zinc-500 uppercase text-sm">Viertelfinale</h3>
                      {(tournament.phaseFormats?.quarter || matches.find((m) => m.phase === "quarter")?.format) && (
                        <span className="text-[10px] text-zinc-400">{fmtLabel(tournament.phaseFormats?.quarter ?? matches.find((m) => m.phase === "quarter")?.format)}</span>
                      )}
                    </div>
                    {matches.filter((m) => m.phase === "quarter").length > 0 &&
                      matches.filter((m) => m.phase === "quarter").every((m) => m.status === "completed") &&
                      matches.filter((m) => m.phase === "semi").length === 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateNextRound("quarter")}
                        >
                          <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                          Halbfinale starten
                        </Button>
                      )}
                  </div>
                  {/* QF matches grouped into pairs with bracket connectors */}
                  {(() => {
                    const qf = matches.filter((m) => m.phase === "quarter");
                    const pairs: typeof qf[] = [];
                    for (let i = 0; i < qf.length; i += 2) pairs.push(qf.slice(i, i + 2));
                    return (
                      <div className="space-y-4">
                        {pairs.map((pair, pi) => {
                          const pairDone = pair.length === 2 && pair.every((m: any) => m.status === "completed");
                          const connColor = pairDone ? "border-green-400 dark:border-green-600" : "border-zinc-200 dark:border-zinc-700";
                          return (
                          <div key={pi} className={`relative ${pi > 0 ? "mt-4" : ""}`}>
                            <div className="space-y-4">
                              {pair.map(renderMatchCard)}
                            </div>
                            {pair.length === 2 && (
                              <div className="absolute -right-5 inset-y-0 w-5 pointer-events-none flex flex-col">
                                <div className={`flex-1 border-t-2 border-r-2 ${connColor} rounded-tr-lg`} />
                                <div className={`flex-1 border-b-2 border-r-2 ${connColor} rounded-br-lg`} />
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              <div
                className={`min-w-[200px] ${players.length >= 8 ? "mt-12" : ""}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-zinc-500 uppercase text-sm">Halbfinale</h3>
                    {(tournament.phaseFormats?.semi || matches.find((m) => m.phase === "semi")?.format) && (
                      <span className="text-[10px] text-zinc-400">{fmtLabel(tournament.phaseFormats?.semi ?? matches.find((m) => m.phase === "semi")?.format)}</span>
                    )}
                  </div>
                  {matches.filter((m) => m.phase === "semi").length > 0 &&
                    matches.filter((m) => m.phase === "semi").every((m) => m.status === "completed") &&
                    matches.filter((m) => m.phase === "final").length === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateNextRound("semi")}
                      >
                        <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                        Finale starten
                      </Button>
                    )}
                </div>
                {/* SF matches with bracket connector to final */}
                {(() => {
                  const sf = matches.filter((m) => m.phase === "semi");
                  const sfDone = sf.length === 2 && sf.every((m: any) => m.status === "completed");
                  const sfConn = sfDone ? "border-green-400 dark:border-green-600" : "border-zinc-200 dark:border-zinc-700";
                  return (
                    <div className="relative">
                      <div className="space-y-4">
                        {sf.map(renderMatchCard)}
                      </div>
                      {sf.length === 2 && (
                        <div className="absolute -right-5 inset-y-0 w-5 pointer-events-none flex flex-col">
                          <div className={`flex-1 border-t-2 border-r-2 ${sfConn} rounded-tr-lg`} />
                          <div className={`flex-1 border-b-2 border-r-2 ${sfConn} rounded-br-lg`} />
                        </div>
                      )}
                    </div>
                  );
                })()}
                {matches.filter((m) => m.phase === "semi").length === 0 && (
                  <div className="text-xs text-zinc-400 italic">Folgt nach Viertelfinale</div>
                )}
              </div>
              <div
                className={`space-y-4 min-w-[200px] ${players.length >= 8 ? "mt-24" : "mt-12"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-zinc-500 uppercase text-sm">Finale</h3>
                    {(tournament.phaseFormats?.final || matches.find((m) => m.phase === "final")?.format) && (
                      <span className="text-[10px] text-zinc-400">{fmtLabel(tournament.phaseFormats?.final ?? matches.find((m) => m.phase === "final")?.format)}</span>
                    )}
                  </div>
                  {matches.filter(
                    (m) => m.phase === "final" && m.status === "completed",
                  ).length > 0 &&
                    tournament.status !== "completed" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            if (tournament.isFinalTournament) {
                              await grantGrandFinalAchievements(id, tournament, matches);
                            } else {
                              await grantTournamentAchievements(id, tournament, players, matches);
                            }
                          } catch (_) {
                            // Achievement errors don't block tournament completion
                          }
                          await updateDoc(doc(db, "tournaments", id), {
                            status: "completed",
                          });
                        }}
                      >
                        Turnier abschließen
                      </Button>
                    )}
                </div>
                {matches.filter((m) => m.phase === "final").map(renderMatchCard)}
                {matches.filter((m) => m.phase === "final").length === 0 && (
                  <div className="text-xs text-zinc-400 italic">Folgt nach Halbfinale</div>
                )}
              </div>
            </div>
              );
            })()}
          </TabsContent>
          <TabsContent value="results">
            {(() => {
              const finalMatch = matches.find((m) => m.phase === "final");
              const semiMatches = matches.filter((m) => m.phase === "semi");
              const quarterMatches = matches.filter((m) => m.phase === "quarter");

              let rankedPlayers = [...players].map((p) => {
                let rankScore = 0;
                if (finalMatch?.winnerId === p.id) rankScore = 10000;
                else if (finalMatch && (finalMatch.playerAId === p.id || finalMatch.playerBId === p.id)) rankScore = 9000;
                else if (semiMatches.some((m) => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 8000;
                else if (quarterMatches.some((m) => m.playerAId === p.id || m.playerBId === p.id)) rankScore = 7000;
                rankScore += (p.points || 0) * 100 + (p.wins || 0) * 10 - (p.losses || 0);
                return { ...p, rankScore };
              });
              rankedPlayers.sort((a, b) => b.rankScore - a.rankScore);

              const podiumColors = [
                { border: "#D4AF37", bg: "from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20", text: "text-yellow-600 dark:text-yellow-400", label: "1. Platz", emoji: "🥇" },
                { border: "#C0C0C0", bg: "from-zinc-50 to-slate-50 dark:from-zinc-800/40 dark:to-slate-800/40", text: "text-zinc-500 dark:text-zinc-400", label: "2. Platz", emoji: "🥈" },
                { border: "#CD7F32", bg: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20", text: "text-orange-600 dark:text-orange-400", label: "3. Platz", emoji: "🥉" },
              ];

              const podium = rankedPlayers.slice(0, 3);
              const rest = rankedPlayers.slice(3);

              return (
                <div className="space-y-6">
                  {/* Podium */}
                  {podium.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {podium.map((p, index) => {
                        const colors = podiumColors[index];
                        const avatar = getPlayerAvatar(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`relative rounded-2xl border-2 bg-gradient-to-b ${colors.bg} p-5 flex flex-col items-center gap-3 text-center`}
                            style={{ borderColor: colors.border }}
                          >
                            <span className={`text-xs font-bold uppercase tracking-widest ${colors.text}`}>{colors.label}</span>
                            <div className="relative">
                              {avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatar} alt="" className="w-20 h-20 rounded-full object-cover border-4" style={{ borderColor: colors.border }} />
                              ) : (
                                <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4" style={{ borderColor: colors.border, background: "var(--card-background, #f4f4f5)" }}>
                                  {colors.emoji}
                                </div>
                              )}
                              {avatar && (
                                <span className="absolute -bottom-2 -right-2 text-2xl">{colors.emoji}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-lg leading-tight" style={getPlayerNickname(p.id) ? headingStyle : undefined}>
                                {getDisplayName(p.id, p.name)}
                              </div>
                              {getPlayerNickname(p.id) && (
                                <div className="text-xs text-zinc-400 mt-0.5">{p.name}</div>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 space-y-0.5 w-full">
                              <div className="flex justify-between px-2">
                                <span>Spiele</span><span className="font-semibold">{p.matchesPlayed}</span>
                              </div>
                              <div className="flex justify-between px-2">
                                <span>Siege / Ndl.</span><span className="font-semibold">{p.wins} / {p.losses}</span>
                              </div>
                            </div>
                            {isAdmin && (
                              <label className="text-xs flex items-center gap-1.5 cursor-pointer text-zinc-500 mt-1">
                                <input
                                  type="checkbox"
                                  checked={p.stayedUntilFinal || index < 2}
                                  disabled={index < 2}
                                  onChange={async (e) => {
                                    await updateDoc(doc(db, "tournaments", id, "players", p.id), { stayedUntilFinal: e.target.checked });
                                  }}
                                  className="rounded border-zinc-300 dark:border-zinc-600"
                                />
                                Bis Finale geblieben
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Rest der Teilnehmer */}
                  {rest.length > 0 && (
                    <Card>
                      <CardContent className="p-0">
                        {rest.map((p, i) => {
                          const index = i + 3;
                          return (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 dark:border-zinc-800">
                              <span className="w-6 text-sm text-zinc-500 font-semibold text-center">{index + 1}.</span>
                              <div className="relative flex-shrink-0">
                                {getPlayerAvatar(p.id) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={getPlayerAvatar(p.id)!} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-700" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-500">
                                    {getDisplayName(p.id, p.name).charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate" style={getPlayerNickname(p.id) ? headingStyle : undefined}>
                                  {getDisplayName(p.id, p.name)}
                                </div>
                                <div className="text-xs text-zinc-500">{p.matchesPlayed} Spiele · {p.wins}S / {p.losses}N</div>
                              </div>
                              {isAdmin && (
                                <label className="text-xs flex items-center gap-1.5 cursor-pointer text-zinc-500 flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={p.stayedUntilFinal || false}
                                    onChange={async (e) => {
                                      await updateDoc(doc(db, "tournaments", id, "players", p.id), { stayedUntilFinal: e.target.checked });
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-600"
                                  />
                                  Bis Finale
                                </label>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                  {rankedPlayers.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed rounded-lg border-zinc-200 dark:border-zinc-700">
                      <p className="text-zinc-500">Noch keine Ergebnisse vorhanden.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Retroaktive Ergebniseingabe Dialog */}
        {/* Retroaktive Match-Eingabe */}
        <Dialog open={isRetroMatchDialogOpen} onOpenChange={setIsRetroMatchDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ergebnisse eintragen – {tournament.title}</DialogTitle>
              <DialogDescription>
                {retroMode === 'matches'
                  ? 'Trage für jedes Match die Leg-Ergebnisse ein. Nicht gespielte Matches leer lassen.'
                  : 'Trage nur die Top-Platzierungen ein. Punkte werden automatisch berechnet.'}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Modus-Auswahl */}
              <div className="flex gap-2">
                <button
                  onClick={() => setRetroMode('matches')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    retroMode === 'matches'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                  }`}
                >
                  Alle Ergebnisse
                </button>
                <button
                  onClick={() => setRetroMode('placements')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    retroMode === 'placements'
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                  }`}
                >
                  Nur Platzierungen
                </button>
              </div>

              {retroMode === 'matches' && (
              <>
              {/* Format-Auswahl */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 whitespace-nowrap">Format:</span>
                <select
                  value={retroFormat}
                  onChange={(e) => setRetroFormat(e.target.value as typeof retroFormat)}
                  className="border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-zinc-900"
                >
                  <option value="501_bo1">501 · Best of 1</option>
                  <option value="501_bo3">501 · Best of 3</option>
                  <option value="301_bo1">301 · Best of 1</option>
                  <option value="301_bo3">301 · Best of 3</option>
                </select>
              </div>

              {/* Match-Liste */}
              <div className="space-y-2">
                {retroPairs.map((pair) => {
                  const score = retroScores[pair.key];
                  const bestOf = retroFormat.includes('bo3') ? 3 : 1;
                  const maxLegs = Math.ceil(bestOf / 2) + (bestOf > 1 ? 0 : 0); // bo1→1, bo3→2
                  const legsToWin = Math.ceil(bestOf / 2);

                  return (
                    <div key={pair.key} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg px-3 py-2">
                      <span className="flex-1 text-sm font-medium text-right truncate">{pair.aName}</span>

                      {/* Legs A */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setRetroScores((prev) => ({
                            ...prev,
                            [pair.key]: { legsA: Math.max(0, (prev[pair.key]?.legsA ?? 0) - 1), legsB: prev[pair.key]?.legsB ?? 0 }
                          }))}
                          className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >−</button>
                        <span className="w-5 text-center text-sm font-bold">{score?.legsA ?? '–'}</span>
                        <button
                          onClick={() => setRetroScores((prev) => ({
                            ...prev,
                            [pair.key]: { legsA: Math.min(legsToWin, (prev[pair.key]?.legsA ?? 0) + 1), legsB: prev[pair.key]?.legsB ?? 0 }
                          }))}
                          className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >+</button>
                      </div>

                      <span className="text-zinc-400 text-sm">:</span>

                      {/* Legs B */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setRetroScores((prev) => ({
                            ...prev,
                            [pair.key]: { legsA: prev[pair.key]?.legsA ?? 0, legsB: Math.max(0, (prev[pair.key]?.legsB ?? 0) - 1) }
                          }))}
                          className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >−</button>
                        <span className="w-5 text-center text-sm font-bold">{score?.legsB ?? '–'}</span>
                        <button
                          onClick={() => setRetroScores((prev) => ({
                            ...prev,
                            [pair.key]: { legsA: prev[pair.key]?.legsA ?? 0, legsB: Math.min(legsToWin, (prev[pair.key]?.legsB ?? 0) + 1) }
                          }))}
                          className="w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-700 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >+</button>
                      </div>

                      <span className="flex-1 text-sm font-medium text-left truncate">{pair.bName}</span>

                      {/* Löschen */}
                      <button
                        onClick={() => setRetroScores((prev) => {
                          const next = { ...prev };
                          delete next[pair.key];
                          return next;
                        })}
                        className="text-zinc-300 dark:text-zinc-600 hover:text-red-400 transition-colors text-xs ml-1"
                        title="Nicht gespielt"
                      >✕</button>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-zinc-400">
                {Object.keys(retroScores).length} von {retroPairs.length} Matches eingetragen · Standings werden automatisch kalkuliert
              </p>
              </>
              )}

              {retroMode === 'placements' && (
              <>
              {/* Platzierungen */}
              <div className="space-y-2">
                {[1, 2, 3, 4].map((placement) => {
                  const medalIcons = ['🥇', '🥈', '🥉', '4.'];
                  const pointLabels = ['7 Pkt', '6 Pkt', '4 Pkt', '3 Pkt'];
                  const usedIds = Object.values(retroPlacements).filter(Boolean);
                  return (
                    <div key={placement} className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">{medalIcons[placement - 1]}</span>
                      <select
                        value={retroPlacements[placement] ?? ''}
                        onChange={(e) => setRetroPlacements((prev) => ({ ...prev, [placement]: e.target.value }))}
                        className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900"
                      >
                        <option value="">– Spieler wählen –</option>
                        {players
                          .filter((p) => !usedIds.includes(p.id) || retroPlacements[placement] === p.id)
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                      <span className="text-xs text-zinc-400 w-12">{pointLabels[placement - 1]}</span>
                    </div>
                  );
                })}
              </div>

              {/* Weitere Teilnehmer */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Weitere Teilnehmer (je 1 Pkt)</p>
                <div className="flex flex-wrap gap-2">
                  {players
                    .filter((p) => !Object.values(retroPlacements).includes(p.id))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((p) => {
                      const active = retroParticipants.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setRetroParticipants((prev) =>
                            active ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            active
                              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              <p className="text-xs text-zinc-400">
                {Object.values(retroPlacements).filter(Boolean).length} Platzierungen + {retroParticipants.length} weitere Teilnehmer
              </p>
              </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRetroMatchDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={retroMode === 'matches' ? saveRetroMatches : saveRetroPlacements}
                disabled={isSavingRetroMatches || (
                  retroMode === 'matches'
                    ? Object.keys(retroScores).length === 0
                    : !retroPlacements[1]
                )}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isSavingRetroMatches ? "Speichert..." : "Turnier abschließen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Turnier löschen</DialogTitle>
              <DialogDescription>
                Möchtest du dieses Turnier wirklich löschen? Diese Aktion
                kann nicht rückgängig gemacht werden.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={deleteTournament}>
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Einstellungen bearbeiten */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Turnier-Einstellungen</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editTitle">Turniername</Label>
                <Input
                  id="editTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              {tournament?.status !== "draft" && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                  Spielregeln können nur im Draft-Status geändert werden. Nur der Turniername und die Anzahl der Dartscheiben sind editierbar.
                </div>
              )}

              <div className="grid gap-2 pt-2 border-t">
                <Label>Dartscheiben</Label>
                <Select value={String(editBoards)} onValueChange={(v) => setEditBoards(Number(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Scheibe" : "Scheiben"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2 pt-2 border-t">
                <Label>Tiebreak-Treffer pro Runde</Label>
                <Select value={String(editTiebreakHits)} onValueChange={(v) => setEditTiebreakHits(Number(v))}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "Pfeil" : "Pfeile"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">Anzahl Pfeile, die pro Runde auf die Zielzahl geworfen werden (Standard: 4)</p>
              </div>

              <fieldset disabled={tournament?.status !== "draft"} className="contents">
                <div className="grid gap-2 pt-2 border-t">
                  <Label>Checkout-Regel</Label>
                  <CheckoutBuilder
                    value={editCheckout}
                    onChange={setEditCheckout}
                    showInRule={true}
                  />
                </div>

                <div className="grid gap-2 pt-2 border-t">
                  <Label>Draw-Regel</Label>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id="editDrawEnabled"
                      checked={editDrawRule.enabled}
                      onChange={(e) => setEditDrawRule({ enabled: e.target.checked })}
                      className="mt-0.5"
                      disabled={tournament?.status !== "draft"}
                    />
                    <div>
                      <Label htmlFor="editDrawEnabled" className="font-normal">
                        Unentschieden erlaubt (Best of 1)
                      </Label>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Spieler 2 darf nach dem Checkout von Spieler 1 noch seinen Wurf vollenden.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 pt-2 border-t">
                  <Label>Anwurf-Konfiguration</Label>
                  <MatchStartSelector
                    value={editMatchStart}
                    onChange={setEditMatchStart}
                  />
                </div>
              </fieldset>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={saveSettings} disabled={isSavingEdit || !editTitle.trim()}>
                {isSavingEdit ? "Speichert..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
