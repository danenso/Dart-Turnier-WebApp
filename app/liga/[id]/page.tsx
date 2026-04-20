"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import {
  Upload,
  Settings2,
  Plus,
  Calendar,
  Link2,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Pencil,
  PlayCircle,
  ExternalLink,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoringRules {
  [key: string]: number; // "1" → 7, "2" → 6, etc. + "participation", "stayedUntilFinal"
}

interface LigaDoc {
  id: string;
  name: string;
  abbreviation?: string;
  themeColor?: string;
  scoringRules?: ScoringRules;
  gamesPerSeason: number;
  bannerUrl: string | null;
  bannerType: "image" | "video" | null;
  ownerId: string;
  createdAt: string;
}

interface SeasonDoc {
  id: string;
  name: string;
  year: number;
  status: "active" | "completed";
  createdAt: string;
}

interface GameDoc {
  id: string;
  gameNumber: number;
  scheduledDate: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  status: "scheduled" | "in_progress" | "completed";
}

interface LigaStanding {
  playerId: string;
  name: string;
  totalPoints: number;
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "Datum folgt";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function positionBg(idx: number) {
  if (idx === 0) return "bg-yellow-50 dark:bg-yellow-950/25 border-l-4 border-l-yellow-400";
  if (idx === 1) return "bg-zinc-100 dark:bg-zinc-800/60 border-l-4 border-l-zinc-400";
  if (idx === 2) return "bg-orange-50 dark:bg-orange-950/25 border-l-4 border-l-orange-400";
  if (idx < 8)  return "bg-emerald-50/60 dark:bg-emerald-950/20 border-l-4 border-l-emerald-400";
  return "bg-white dark:bg-zinc-900/40 border-l-4 border-l-transparent";
}

function PositionBadge({ idx }: { idx: number }) {
  if (idx === 0) return <Icon icon="mdi:medal" className="w-5 h-5 text-yellow-500" />;
  if (idx === 1) return <Icon icon="mdi:medal" className="w-5 h-5 text-zinc-400" />;
  if (idx === 2) return <Icon icon="mdi:medal" className="w-5 h-5 text-orange-400" />;
  if (idx < 8)  return <span className="w-5 h-5 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-emerald-400" /></span>;
  return <span className="w-5 h-5 flex items-center justify-center text-zinc-400 text-sm font-mono">{idx + 1}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LigaDetailPage() {
  const { id: ligaId } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin } = useFirebase();
  const router = useRouter();

  // ── Liga ──
  const [liga, setLiga] = useState<LigaDoc | null>(null);
  const [ligaLoading, setLigaLoading] = useState(true);

  // ── Seasons ──
  const [seasons, setSeasons] = useState<SeasonDoc[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // ── Games in selected season ──
  const [seasonGames, setSeasonGames] = useState<GameDoc[]>([]);

  // ── Standings (computed) ──
  const [standings, setStandings] = useState<LigaStanding[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // ── All players (for avatar/nickname lookup) ──
  const [players, setPlayers] = useState<any[]>([]);

  // ── Tournaments for linking ──
  const [tournaments, setTournaments] = useState<any[]>([]);

  // ── Banner upload ──
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ── New season dialog ──
  const [isNewSeasonOpen, setIsNewSeasonOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState(String(new Date().getFullYear()));
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);

  // ── Game edit dialog ──
  const [editingGame, setEditingGame] = useState<GameDoc | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTournamentId, setEditTournamentId] = useState("");
  const [editStatus, setEditStatus] = useState<GameDoc["status"]>("scheduled");
  const [isSavingGame, setIsSavingGame] = useState(false);

  // ── Liga settings dialog ──
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsAbbr, setSettingsAbbr] = useState("");
  const [settingsGames, setSettingsGames] = useState(10);
  const [settingsThemeColor, setSettingsThemeColor] = useState("#10b981");
  const [settingsScoringRules, setSettingsScoringRules] = useState<ScoringRules>({
    "1": 7, "2": 6, "3": 4, "4": 3, "5": 2, participation: 1, stayedUntilFinal: 1,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ── Delete dialog ──
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isAuthReady || !user || !ligaId) return;
    const ligaRef = doc(db, "liga", ligaId);
    const unsub = onSnapshot(
      ligaRef,
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as LigaDoc;
          // Security: ensure user owns this liga
          if (data.ownerId !== user.uid && !isAdmin) {
            router.push("/liga");
            return;
          }
          setLiga(data);
        } else {
          router.push("/liga");
        }
        setLigaLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, "liga");
        setLigaLoading(false);
      },
    );
    return () => unsub();
  }, [ligaId, user, isAuthReady, isAdmin, router]);

  // Seasons
  useEffect(() => {
    if (!ligaId) return;
    const q = query(
      collection(db, "liga", ligaId, "seasons"),
      orderBy("year", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as SeasonDoc[];
      setSeasons(docs);
      if (docs.length > 0 && !selectedSeasonId) {
        setSelectedSeasonId(docs[0].id);
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligaId]);

  // Games for selected season
  useEffect(() => {
    if (!ligaId || !selectedSeasonId) { setSeasonGames([]); return; }
    const q = query(
      collection(db, "liga", ligaId, "seasons", selectedSeasonId, "games"),
      orderBy("gameNumber", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as GameDoc[];
      setSeasonGames(docs);
    });
    return () => unsub();
  }, [ligaId, selectedSeasonId]);

  // Players
  useEffect(() => {
    if (!user || !isAuthReady) return;
    const q = query(collection(db, "players"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, isAuthReady]);

  // Tournaments
  useEffect(() => {
    if (!user || !isAuthReady) return;
    const q = query(collection(db, "tournaments"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((t: any) => t.type !== "single_match" && t.type !== "casual_tiebreak")
        .sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setTournaments(all);
    });
    return () => unsub();
  }, [user, isAuthReady]);

  // Standings calculation
  useEffect(() => {
    const completedGames = seasonGames.filter(
      (g) => g.status === "completed" && g.tournamentId,
    );
    if (completedGames.length === 0) { setStandings([]); return; }

    let cancelled = false;
    setStandingsLoading(true);

    (async () => {
      const acc: Record<string, LigaStanding> = {};
      for (const game of completedGames) {
        try {
          const playersSnap = await getDocs(
            collection(db, "tournaments", game.tournamentId!, "players"),
          );
          playersSnap.forEach((pd) => {
            const pData = pd.data() as any;
            const pid = pd.id;
            if (!acc[pid]) {
              acc[pid] = { playerId: pid, name: pData.name || "?", totalPoints: 0, gamesPlayed: 0, wins: 0, draws: 0, losses: 0 };
            }
            acc[pid].totalPoints += pData.points || 0;
            acc[pid].gamesPlayed += 1;
            acc[pid].wins += pData.wins || 0;
            acc[pid].draws += pData.draws || 0;
            acc[pid].losses += pData.losses || 0;
          });
        } catch { /* skip */ }
      }
      if (!cancelled) {
        const sorted = Object.values(acc).sort(
          (a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins || a.losses - b.losses,
        );
        setStandings(sorted);
        setStandingsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [seasonGames]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const createSeason = async () => {
    if (!liga || !newSeasonName.trim()) return;
    setIsCreatingSeason(true);
    try {
      const batch = writeBatch(db);
      const seasonRef = doc(collection(db, "liga", liga.id, "seasons"));
      batch.set(seasonRef, {
        name: newSeasonName.trim(),
        year: parseInt(newSeasonName) || new Date().getFullYear(),
        status: "active",
        createdAt: new Date().toISOString(),
      });
      for (let i = 1; i <= liga.gamesPerSeason; i++) {
        const gameRef = doc(collection(db, "liga", liga.id, "seasons", seasonRef.id, "games"));
        batch.set(gameRef, {
          gameNumber: i,
          scheduledDate: null,
          tournamentId: null,
          tournamentName: null,
          status: "scheduled",
          createdAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      setSelectedSeasonId(seasonRef.id);
      setIsNewSeasonOpen(false);
      setNewSeasonName(String(new Date().getFullYear()));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "liga/seasons");
    } finally {
      setIsCreatingSeason(false);
    }
  };

  const saveGame = async () => {
    if (!liga || !selectedSeasonId || !editingGame) return;
    setIsSavingGame(true);
    try {
      const linkedTournament = editTournamentId
        ? tournaments.find((t) => t.id === editTournamentId)
        : null;
      await updateDoc(
        doc(db, "liga", liga.id, "seasons", selectedSeasonId, "games", editingGame.id),
        {
          scheduledDate: editDate || null,
          tournamentId: editTournamentId || null,
          tournamentName: linkedTournament?.title || null,
          status: editStatus,
        },
      );
      setEditingGame(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "liga/seasons/games");
    } finally {
      setIsSavingGame(false);
    }
  };

  const saveSettings = async () => {
    if (!liga || !settingsName.trim()) return;
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, "liga", liga.id), {
        name: settingsName.trim(),
        abbreviation: settingsAbbr.trim().toUpperCase() || null,
        gamesPerSeason: settingsGames,
        themeColor: settingsThemeColor || null,
        scoringRules: settingsScoringRules,
      });
      setIsSettingsOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "liga");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const deleteLiga = async () => {
    if (!liga || deleteConfirmName !== liga.name) return;
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      // Delete all seasons and their games
      const seasonsSnap = await getDocs(collection(db, "liga", liga.id, "seasons"));
      for (const seasonDoc of seasonsSnap.docs) {
        const gamesSnap = await getDocs(
          collection(db, "liga", liga.id, "seasons", seasonDoc.id, "games"),
        );
        for (const gameDoc of gamesSnap.docs) {
          batch.delete(gameDoc.ref);
        }
        batch.delete(seasonDoc.ref);
      }
      batch.delete(doc(db, "liga", liga.id));
      await batch.commit();
      router.push("/liga");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "liga");
      setIsDeleting(false);
    }
  };

  const uploadBanner = async (file: File) => {
    if (!liga) return;
    setIsBannerUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const fileRef = storageRef(storage, `banners/${liga.id}/banner.${ext}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const type = file.type.startsWith("video/") ? "video" : "image";
      await updateDoc(doc(db, "liga", liga.id), { bannerUrl: url, bannerType: type });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "liga/banner");
    } finally {
      setIsBannerUploading(false);
    }
  };

  const openEditGame = (game: GameDoc) => {
    setEditingGame(game);
    setEditDate(game.scheduledDate ? game.scheduledDate.slice(0, 10) : "");
    setEditTournamentId(game.tournamentId ?? "");
    setEditStatus(game.status);
  };

  const getPlayer = useCallback(
    (playerId: string) => players.find((p) => p.id === playerId) ?? null,
    [players],
  );

  // ── Early returns ──────────────────────────────────────────────────────────

  if (!isAuthReady || ligaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (!user || !liga) return null;

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null;
  const completedGames = seasonGames.filter((g) => g.status === "completed").length;
  const displayName = liga.abbreviation
    ? `${liga.abbreviation} – ${liga.name}`
    : liga.name;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* ── Banner ── */}
      <div className="relative w-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"
        style={{ minHeight: liga.bannerUrl ? undefined : (isAdmin ? "160px" : "0px") }}
      >
        {liga.bannerUrl ? (
          liga.bannerType === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={liga.bannerUrl} autoPlay loop muted playsInline className="w-full max-h-[380px] object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={liga.bannerUrl} alt="Liga Banner" className="w-full max-h-[380px] object-cover" />
          )
        ) : isAdmin ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-400 dark:text-zinc-600">
            <Icon icon="mdi:image-plus" className="w-10 h-10" />
            <span className="text-sm">Kein Banner gesetzt</span>
          </div>
        ) : null}

        {isAdmin && (
          <div className="absolute bottom-3 right-3">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*,video/mp4,video/webm"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadBanner(file);
                e.target.value = "";
              }}
            />
            <Button
              size="sm" variant="outline"
              className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm"
              onClick={() => bannerInputRef.current?.click()}
              disabled={isBannerUploading}
            >
              {isBannerUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {isBannerUploading ? "Lädt hoch..." : "Banner hochladen"}
            </Button>
          </div>
        )}
      </div>

      <div className="page-pad section-gap">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href="/liga">
              <Button variant="ghost" size="icon" className="mt-1 shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
                <Icon icon="mdi:podium-gold" className="w-8 h-8 text-emerald-500 shrink-0" />
                {liga.name}
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 mt-1">
                {liga.abbreviation && (
                  <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300 mr-2">{liga.abbreviation}</span>
                )}
                {liga.gamesPerSeason} Spiele pro Season · Ligabetrieb
              </p>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setSettingsName(liga.name);
                  setSettingsAbbr(liga.abbreviation ?? "");
                  setSettingsGames(liga.gamesPerSeason);
                  setSettingsThemeColor(liga.themeColor ?? "#10b981");
                  setSettingsScoringRules(liga.scoringRules ?? { "1": 7, "2": 6, "3": 4, "4": 3, "5": 2, participation: 1, stayedUntilFinal: 1 });
                  setIsSettingsOpen(true);
                }}
              >
                <Settings2 className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Einstellungen</span>
              </Button>
              <Button
                variant="outline" size="sm"
                className="text-red-500 hover:text-red-600 hover:border-red-300"
                onClick={() => { setDeleteConfirmName(""); setIsDeleteOpen(true); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Season Tabs ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSeasonId(s.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                selectedSeasonId === s.id
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500",
              )}
            >
              {s.name}
              {s.status === "completed" && <CheckCircle2 className="inline w-3 h-3 ml-1.5 text-zinc-400" />}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setIsNewSeasonOpen(true)}
              className="px-4 py-2 rounded-full text-sm font-medium border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-zinc-500 hover:text-zinc-600 dark:hover:border-zinc-400 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Neue Season
            </button>
          )}
          {seasons.length === 0 && !isAdmin && (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">Noch keine Seasons angelegt.</p>
          )}
        </div>

        {/* ── Season Content ── */}
        {selectedSeason ? (
          <div className="space-y-6">
            {/* Progress */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Spielfortschritt — Season {selectedSeason.name}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                  {completedGames} / {seasonGames.length}
                </span>
              </div>
              <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: seasonGames.length ? `${(completedGames / seasonGames.length) * 100}%` : "0%" }}
                />
              </div>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />{completedGames} abgeschlossen
                </span>
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />{seasonGames.filter((g) => g.status === "in_progress").length} aktiv
                </span>
                <span className="text-xs text-zinc-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-400" />{seasonGames.filter((g) => g.status === "scheduled").length} geplant
                </span>
              </div>
            </div>

            {/* Games Schedule */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Spiele</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {seasonGames.map((game) => {
                  const statusColor =
                    game.status === "completed"
                      ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30"
                      : game.status === "in_progress"
                        ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900";

                  return (
                    <div
                      key={game.id}
                      className={cn(
                        "shrink-0 w-36 rounded-xl border p-3 transition-all",
                        statusColor,
                        isAdmin
                          ? "cursor-pointer hover:shadow-md dark:hover:shadow-zinc-900"
                          : game.tournamentId
                            ? "cursor-pointer hover:shadow-md dark:hover:shadow-zinc-900"
                            : "",
                      )}
                      onClick={() => {
                        if (isAdmin) openEditGame(game);
                        else if (game.tournamentId) router.push(`/tournament/${game.tournamentId}`);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                          Spiel {game.gameNumber}
                        </span>
                        {game.status === "completed" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : game.status === "in_progress" ? (
                          <PlayCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {game.tournamentName ?? (
                          <span className="text-zinc-400 dark:text-zinc-500 font-normal italic">Kein Turnier</span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{formatDate(game.scheduledDate)}</p>
                      <div className={cn(
                        "mt-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                        game.status === "completed"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          : game.status === "in_progress"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
                      )}>
                        {game.status === "completed" ? "Abgeschlossen" : game.status === "in_progress" ? "Läuft" : "Geplant"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Standings Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Tabelle — Season {selectedSeason.name}
                </h2>
                {standingsLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}
              </div>

              {standings.length === 0 && !standingsLoading ? (
                <div className="py-12 text-center border-2 border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
                  <Icon icon="mdi:podium" className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 dark:text-zinc-400">Noch keine abgeschlossenen Spiele — Tabelle leer.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <div className="grid grid-cols-[40px_1fr_64px_64px_80px] gap-0 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    <span className="text-center">#</span>
                    <span>Spieler</span>
                    <span className="text-center">GS</span>
                    <span className="text-center">S</span>
                    <span className="text-right pr-1">Punkte</span>
                  </div>
                  {standings.map((entry, idx) => {
                    const player = getPlayer(entry.playerId);
                    const isQualified = idx < 8;
                    return (
                      <div key={entry.playerId}>
                        {idx === 8 && (
                          <div className="flex items-center gap-3 px-4 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-y border-zinc-200 dark:border-zinc-700">
                            <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-600" />
                            <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1.5">
                              <Icon icon="mdi:close-circle-outline" className="w-3 h-3" /> Ausgeschieden
                            </span>
                            <div className="flex-1 h-px bg-zinc-300 dark:bg-zinc-600" />
                          </div>
                        )}
                        <div className={cn(
                          "grid grid-cols-[40px_1fr_64px_64px_80px] gap-0 items-center px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0 transition-colors",
                          positionBg(idx),
                        )}>
                          <div className="flex items-center justify-center"><PositionBadge idx={idx} /></div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                              {player?.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={player.avatar} alt={entry.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                              ) : (
                                <Icon icon="mdi:account" className="w-4 h-4 text-zinc-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate leading-tight font-bold">
                                {player?.nickname || entry.name}
                              </p>
                              {player?.nickname && (
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate leading-tight">{entry.name}</p>
                              )}
                            </div>
                            {isQualified && idx > 2 && (
                              <span className="ml-auto shrink-0 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                Endspiel
                              </span>
                            )}
                          </div>
                          <div className="text-center text-sm font-mono text-zinc-700 dark:text-zinc-300">{entry.gamesPlayed}</div>
                          <div className="text-center text-sm font-mono text-zinc-700 dark:text-zinc-300">{entry.wins}</div>
                          <div className="text-right pr-1">
                            <span className={cn(
                              "text-sm font-bold font-mono",
                              idx === 0 ? "text-yellow-600 dark:text-yellow-400" : isQualified ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300",
                            )}>
                              {entry.totalPoints}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {standings.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-200 dark:bg-yellow-800 inline-block" />Platz 1</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-800 inline-block" />Top 8 — qualifiziert für das Endspiel</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 inline-block" />Ausgeschieden</span>
                  <span className="flex items-center gap-1.5"><span className="font-mono">GS</span> = Gespielte Spiele &nbsp;<span className="font-mono">S</span> = Siege</span>
                </div>
              )}
            </div>
          </div>
        ) : seasons.length > 0 ? (
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">Season auswählen.</p>
        ) : (
          <div className="py-16 text-center border-2 border-dashed rounded-xl border-zinc-200 dark:border-zinc-800">
            <Icon icon="mdi:calendar-plus" className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500 dark:text-zinc-400 font-medium">Noch keine Season angelegt</p>
            {isAdmin && (
              <Button className="mt-4" variant="outline" onClick={() => setIsNewSeasonOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Erste Season erstellen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}

      {/* New Season */}
      <Dialog open={isNewSeasonOpen} onOpenChange={setIsNewSeasonOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Season erstellen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="seasonName">Season-Name (z.B. Jahr)</Label>
              <Input id="seasonName" placeholder="2026" value={newSeasonName} onChange={(e) => setNewSeasonName(e.target.value)} />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">Es werden automatisch {liga.gamesPerSeason} Spielslots erstellt.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewSeasonOpen(false)}>Abbrechen</Button>
            <Button onClick={createSeason} disabled={isCreatingSeason || !newSeasonName.trim()}>
              {isCreatingSeason ? "Erstelle..." : "Season erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Game Edit */}
      <Dialog open={!!editingGame} onOpenChange={(open) => { if (!open) setEditingGame(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Spiel {editingGame?.gameNumber} bearbeiten</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="gameDate">Datum</Label>
              <Input id="gameDate" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gameTournament">Verknüpftes Turnier</Label>
              <select
                id="gameTournament"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={editTournamentId}
                onChange={(e) => setEditTournamentId(e.target.value)}
              >
                <option value="">— Kein Turnier —</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                ))}
              </select>
              {editTournamentId && (
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => router.push(`/tournament/${editTournamentId}`)}
                >
                  <ExternalLink className="w-3 h-3" />
                  Turnier öffnen
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                {(["scheduled", "in_progress", "completed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEditStatus(s)}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-xs font-medium transition-all",
                      editStatus === s ? "border-primary bg-primary/5 text-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400",
                    )}
                  >
                    {s === "scheduled" ? "Geplant" : s === "in_progress" ? "Läuft" : "Abgeschlossen"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGame(null)}>Abbrechen</Button>
            <Button onClick={saveGame} disabled={isSavingGame}>{isSavingGame ? "Speichert..." : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liga Settings */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Liga-Einstellungen</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ligaSettingsName">Liga-Name</Label>
              <Input id="ligaSettingsName" value={settingsName} onChange={(e) => setSettingsName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ligaSettingsAbbr">Abkürzung (optional)</Label>
              <Input
                id="ligaSettingsAbbr"
                placeholder="z.B. DPL"
                maxLength={6}
                value={settingsAbbr}
                onChange={(e) => setSettingsAbbr(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-zinc-400">Max. 6 Zeichen, wird im Menü angezeigt</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ligaSettingsGames">Spiele pro Season</Label>
              <Input
                id="ligaSettingsGames"
                type="number" min={1} max={30}
                value={settingsGames}
                onChange={(e) => setSettingsGames(Number(e.target.value))}
              />
              <p className="text-xs text-zinc-400">Gilt nur für neu erstellte Seasons.</p>
            </div>
            <div className="space-y-2">
              <Label>Theme-Farbe</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settingsThemeColor}
                  onChange={(e) => setSettingsThemeColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"].map((c) => (
                    <button
                      key={c}
                      onClick={() => setSettingsThemeColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${settingsThemeColor === c ? "border-zinc-900 dark:border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-zinc-400">Markiert die Liga-Karten und zugehörige Turniere.</p>
            </div>
            <div className="space-y-2">
              <Label>Punkte-Vergabe (Platzierung → Punkte)</Label>
              <div className="grid grid-cols-2 gap-2">
                {["1", "2", "3", "4", "5"].map((place) => (
                  <div key={place} className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500 w-14">{place}. Platz</span>
                    <Input
                      type="number" min={0} max={20}
                      className="w-20 h-8 text-sm"
                      value={settingsScoringRules[place] ?? 0}
                      onChange={(e) => setSettingsScoringRules((prev) => ({ ...prev, [place]: Number(e.target.value) }))}
                    />
                    <span className="text-xs text-zinc-400">Pkt</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 w-14">Teiln.</span>
                  <Input
                    type="number" min={0} max={10}
                    className="w-20 h-8 text-sm"
                    value={settingsScoringRules.participation ?? 1}
                    onChange={(e) => setSettingsScoringRules((prev) => ({ ...prev, participation: Number(e.target.value) }))}
                  />
                  <span className="text-xs text-zinc-400">Pkt</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 w-14">Finale</span>
                  <Input
                    type="number" min={0} max={10}
                    className="w-20 h-8 text-sm"
                    value={settingsScoringRules.stayedUntilFinal ?? 1}
                    onChange={(e) => setSettingsScoringRules((prev) => ({ ...prev, stayedUntilFinal: Number(e.target.value) }))}
                  />
                  <span className="text-xs text-zinc-400">Pkt (bis Finale)</span>
                </div>
              </div>
              <p className="text-xs text-zinc-400">Punkte pro Platzierung in der Saisonwertung. Teiln. = Teilnahme-Bonus, Finale = Bonus für &quot;bis zum Finale geblieben&quot;.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Abbrechen</Button>
            <Button onClick={saveSettings} disabled={isSavingSettings || !settingsName.trim()}>
              {isSavingSettings ? "Speichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Liga */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) setIsDeleteOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Liga löschen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Diese Aktion löscht <strong>alle Seasons und Spielplaneinträge</strong> dieser Liga unwiderruflich.
              Verknüpfte Turniere bleiben erhalten.
            </p>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Zur Bestätigung Liga-Namen eingeben: <strong>{liga.name}</strong>
              </Label>
              <Input
                id="deleteConfirm"
                placeholder={liga.name}
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Abbrechen</Button>
            <Button
              variant="destructive"
              onClick={deleteLiga}
              disabled={isDeleting || deleteConfirmName !== liga.name}
            >
              {isDeleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Löscht...</> : "Liga endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
