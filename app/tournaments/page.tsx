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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function TournamentsPage() {
  const { user, isAuthReady } = useFirebase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [allowSingleOut, setAllowSingleOut] = useState(false);
  const [allowDoubleOut, setAllowDoubleOut] = useState(true);
  const [allowTripleOut, setAllowTripleOut] = useState(false);
  const [allowDraw, setAllowDraw] = useState(false);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [tournamentNumber, setTournamentNumber] = useState<number | "">("");
  const [isFinalTournament, setIsFinalTournament] = useState(false);
  const [isRetroactive, setIsRetroactive] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const qSeasons = query(
      collection(db, "seasons"),
      where("ownerId", "==", user.uid),
    );
    const unsubscribeSeasons = onSnapshot(
      qSeasons,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => a.number - b.number);
        setSeasons(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "seasons"),
    );

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
        allDocs.sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setTournaments(
          allDocs.filter(
            (doc) => doc.type !== "single_match" && doc.type !== "casual_tiebreak",
          ),
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "tournaments"),
    );

    return () => {
      unsubscribeSeasons();
      unsubscribeTournaments();
    };
  }, [user, isAuthReady]);

  const resetForm = () => {
    setTitle("");
    setAllowSingleOut(false);
    setAllowDoubleOut(true);
    setAllowTripleOut(false);
    setAllowDraw(false);
    setSelectedSeasonId("");
    setTournamentNumber("");
    setIsFinalTournament(false);
    setIsRetroactive(false);
  };

  const createTournament = async () => {
    if (!user || !title.trim()) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 100) return;
    setIsCreating(true);
    try {
      const data: any = {
        title: trimmedTitle,
        status: "draft",
        allowSingleOut,
        allowDoubleOut,
        allowTripleOut,
        allowDraw,
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      };
      if (selectedSeasonId) data.seasonId = selectedSeasonId;
      if (isFinalTournament) {
        data.isFinalTournament = true;
      } else if (tournamentNumber !== "") {
        data.tournamentNumber = Number(tournamentNumber);
      }
      if (isRetroactive) data.isRetroactive = true;

      const docRef = await addDoc(collection(db, "tournaments"), data);
      resetForm();
      router.push(`/tournament/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tournaments");
      setIsCreating(false);
    }
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Turniere</h1>
            <p className="text-zinc-500">Verwalte deine Dart-Events und verfolge Ergebnisse.</p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
                Neues Turnier
              </Button>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Neues Turnier erstellen</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Turniername *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="z.B. Freitagsturnier April"
                      maxLength={100}
                      required
                    />
                    {title.trim().length > 80 && (
                      <p className="text-xs text-zinc-400">{title.trim().length}/100 Zeichen</p>
                    )}
                  </div>

                  {seasons.length > 0 && (
                    <div className="grid gap-2 pt-2 border-t">
                      <Label>Season (optional)</Label>
                      <select
                        value={selectedSeasonId}
                        onChange={(e) => setSelectedSeasonId(e.target.value)}
                        className="border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                      >
                        <option value="">Keine Season</option>
                        {seasons.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      {selectedSeasonId && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="isFinal"
                              checked={isFinalTournament}
                              onChange={(e) => {
                                setIsFinalTournament(e.target.checked);
                                if (e.target.checked) setTournamentNumber("");
                              }}
                            />
                            <Label htmlFor="isFinal" className="font-normal">
                              Final-Turnier dieser Season
                            </Label>
                          </div>
                          {!isFinalTournament && (
                            <div className="flex items-center gap-2">
                              <Label className="whitespace-nowrap font-normal">Turnier Nr.</Label>
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={tournamentNumber}
                                onChange={(e) =>
                                  setTournamentNumber(e.target.value === "" ? "" : Number(e.target.value))
                                }
                                placeholder="1–10"
                                className="w-24"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isRetroactive"
                        checked={isRetroactive}
                        onChange={(e) => setIsRetroactive(e.target.checked)}
                      />
                      <Label htmlFor="isRetroactive" className="font-normal">
                        Retroaktives Turnier{" "}
                        <span className="text-zinc-400 text-xs">(Ergebnisse manuell eintragen)</span>
                      </Label>
                    </div>
                  </div>

                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Out Rules</Label>
                    {[
                      { id: "singleOut", checked: allowSingleOut, onChange: setAllowSingleOut, label: "Single Out (incl. Bull)" },
                      { id: "doubleOut", checked: allowDoubleOut, onChange: setAllowDoubleOut, label: "Double Out (incl. Bull's Eye)" },
                      { id: "tripleOut", checked: allowTripleOut, onChange: setAllowTripleOut, label: "Triple Out (incl. Bull's Eye)" },
                    ].map(({ id, checked, onChange, label }) => (
                      <div key={id} className="flex items-center gap-2">
                        <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} />
                        <Label htmlFor={id} className="font-normal">{label}</Label>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <Label>Match Rules</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="allowDraw"
                        checked={allowDraw}
                        onChange={(e) => setAllowDraw(e.target.checked)}
                      />
                      <Label htmlFor="allowDraw" className="font-normal">
                        Allow Draw (Best of 1 only)
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                    Abbrechen
                  </Button>
                  <Button onClick={createTournament} disabled={isCreating || !title.trim()}>
                    {isCreating ? "Erstelle..." : "Turnier erstellen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => {
            const season = seasons.find((s) => s.id === t.seasonId);
            return (
              <Card
                key={t.id}
                className="cursor-pointer hover:border-zinc-400 transition-colors"
                onClick={() => router.push(`/tournament/${t.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{t.title}</CardTitle>
                  <CardDescription>
                    {new Date(t.createdAt).toLocaleDateString("de-DE")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-zinc-100 text-zinc-900">
                    {t.status.toUpperCase()}
                  </div>
                  {season && (
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-blue-100 text-blue-800">
                      {season.name}
                      {t.isFinalTournament ? " · Final" : t.tournamentNumber ? ` · #${t.tournamentNumber}` : ""}
                    </div>
                  )}
                  {t.isRetroactive && (
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-orange-100 text-orange-700">
                      Retroaktiv
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {tournaments.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
              <p className="text-zinc-500">Noch keine Turniere. Erstelle dein erstes Turnier.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
