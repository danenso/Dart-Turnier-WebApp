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
import { Plus, Loader2, ChevronRight, Calendar, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigaDoc {
  id: string;
  name: string;
  abbreviation?: string;
  themeColor?: string;
  gamesPerSeason: number;
  bannerUrl: string | null;
  bannerType: "image" | "video" | null;
  ownerId: string;
  createdAt: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LigaOverviewPage() {
  const { user, isAuthReady, isAdmin } = useFirebase();

  const [ligen, setLigen] = useState<LigaDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Season counts per liga
  const [seasonCounts, setSeasonCounts] = useState<Record<string, number>>({});

  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAbbr, setCreateAbbr] = useState("");
  const [createGames, setCreateGames] = useState(10);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Load all ligen for this user
  useEffect(() => {
    if (!isAuthReady || !user) return;
    const q = query(collection(db, "liga"), where("ownerId", "==", user.uid));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LigaDoc[];
        // Sort by createdAt desc
        docs.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
        setLigen(docs);
        setLoading(false);

        // Fetch season counts
        const counts: Record<string, number> = {};
        for (const liga of docs) {
          try {
            const seasonsSnap = await getDocs(collection(db, "liga", liga.id, "seasons"));
            counts[liga.id] = seasonsSnap.size;
          } catch {
            counts[liga.id] = 0;
          }
        }
        setSeasonCounts(counts);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, "liga");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user, isAuthReady]);

  const createLiga = async () => {
    if (!user || !createName.trim()) return;
    setIsCreating(true);
    setCreateError("");
    try {
      await addDoc(collection(db, "liga"), {
        name: createName.trim(),
        abbreviation: createAbbr.trim().toUpperCase() || null,
        gamesPerSeason: Number(createGames) || 10,
        bannerUrl: null,
        bannerType: null,
        scoringRules: { "1": 7, "2": 6, "3": 4, "4": 3, "5": 2, participation: 1, stayedUntilFinal: 1 },
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
      });
      setIsCreateOpen(false);
      setCreateName("");
      setCreateAbbr("");
      setCreateGames(10);
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      setCreateError(
        msg.includes("permission")
          ? "Keine Berechtigung – bitte als Admin einloggen."
          : `Fehler: ${msg}`,
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="page-pad section-gap">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
            <Icon icon="mdi:podium-gold" className="w-8 h-8 text-emerald-500" />
            Ligen
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            {ligen.length === 0 ? "Noch keine Liga erstellt" : `${ligen.length} Liga${ligen.length !== 1 ? "en" : ""} verwaltet`}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setCreateError(""); setIsCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Neue Liga
          </Button>
        )}
      </div>

      {/* ── Liga cards ── */}
      {ligen.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <Icon icon="mdi:podium-gold" className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Noch keine Liga vorhanden</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              Erstelle deine erste Liga, um Seasons, Spielpläne und Ranglisten zu verwalten.
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => { setCreateError(""); setIsCreateOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Liga erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ligen.map((liga) => (
            <Link key={liga.id} href={`/liga/${liga.id}`} className="group block">
              <div
                className="relative bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-md transition-all duration-200"
                style={liga.themeColor ? { borderTopColor: liga.themeColor, borderTopWidth: 3 } : undefined}
              >

                {/* Banner strip or gradient fallback */}
                {liga.bannerUrl && liga.bannerType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={liga.bannerUrl}
                    alt={liga.name}
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-emerald-500/20 to-teal-600/10 flex items-center justify-center">
                    {liga.abbreviation ? (
                      <span className="text-4xl font-black text-emerald-600/40 dark:text-emerald-400/30 tracking-tight select-none">
                        {liga.abbreviation}
                      </span>
                    ) : (
                      <Icon icon="mdi:podium-gold" className="w-10 h-10 text-emerald-500/40" />
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {liga.abbreviation && (
                        <span className="inline-block text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded mb-1.5">
                          {liga.abbreviation}
                        </span>
                      )}
                      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate leading-snug">
                        {liga.name}
                      </h2>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-500 transition-colors mt-1 shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {seasonCounts[liga.id] ?? "–"} Season{(seasonCounts[liga.id] ?? 0) !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon icon="mdi:table-tennis" className="w-3 h-3" />
                      {liga.gamesPerSeason} Spiele/Season
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* Create button as last card */}
          {isAdmin && (
            <button
              onClick={() => { setCreateError(""); setIsCreateOpen(true); }}
              className="group flex flex-col items-center justify-center gap-3 p-8 bg-white dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-600 transition-all text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium">Neue Liga erstellen</span>
            </button>
          )}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Liga erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="createName">Liga-Name *</Label>
              <Input
                id="createName"
                placeholder="z.B. Dart Premier League Uelzen"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createAbbr">Abkürzung (optional)</Label>
              <Input
                id="createAbbr"
                placeholder="z.B. DPL"
                maxLength={6}
                value={createAbbr}
                onChange={(e) => setCreateAbbr(e.target.value.toUpperCase())}
              />
              <p className="text-xs text-zinc-400">Max. 6 Zeichen – wird im Menü und auf der Liga-Karte angezeigt</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="createGames">Spiele pro Season</Label>
              <Input
                id="createGames"
                type="number"
                min={1}
                max={30}
                value={createGames}
                onChange={(e) => setCreateGames(Number(e.target.value))}
              />
              <p className="text-xs text-zinc-400">Anzahl der Spielabende pro Saison (z.B. 10)</p>
            </div>
          </div>
          {createError && (
            <p className="text-sm text-red-500 dark:text-red-400 px-1 pb-1">{createError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setCreateError(""); }}>
              Abbrechen
            </Button>
            <Button onClick={createLiga} disabled={isCreating || !createName.trim()}>
              {isCreating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Erstelle...</>
              ) : "Liga erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
