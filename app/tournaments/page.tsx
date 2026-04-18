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
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { CheckoutBuilder } from "@/components/CheckoutBuilder";
import { CheckoutConfig, DEFAULT_CHECKOUT_CONFIG } from "@/lib/checkout-rules";
import { MatchStartSelector } from "@/components/MatchStartSelector";
import { DrawRule, MatchStartConfig, DEFAULT_DRAW_RULE, DEFAULT_MATCH_START } from "@/lib/match-rules";
import { Trash2 } from "lucide-react";

interface TournamentTemplate {
  id: string;
  name: string;
  checkoutRule: CheckoutConfig;
  drawRule: DrawRule;
  matchStartConfig: MatchStartConfig;
  numberOfBoards: number;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
}

export default function TournamentsPage() {
  const { user, isAuthReady, isAdmin, isSuperAdmin } = useFirebase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig>(DEFAULT_CHECKOUT_CONFIG);
  const [drawRule, setDrawRule] = useState<DrawRule>(DEFAULT_DRAW_RULE);
  const [matchStartConfig, setMatchStartConfig] = useState<MatchStartConfig>(DEFAULT_MATCH_START);
  const [numberOfBoards, setNumberOfBoards] = useState(1);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [tournamentNumber, setTournamentNumber] = useState<number | "">("");
  const [isFinalTournament, setIsFinalTournament] = useState(false);
  const [isRetroactive, setIsRetroactive] = useState(false);

  // Grand Final Config (nur wenn isFinalTournament)
  const [grandFinalQualifiers, setGrandFinalQualifiers] = useState(8);
  const [grandFinalQF, setGrandFinalQF] = useState("501_bo3");
  const [grandFinalSF, setGrandFinalSF] = useState("501_bo3");
  const [grandFinalF, setGrandFinalF] = useState("501_bo5");

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
        const allDocs = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        allDocs.sort((a: any, b: any) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setTournaments(
          allDocs.filter(
            (d) => d.type !== "single_match" && d.type !== "casual_tiebreak",
          ),
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "tournaments"),
    );

    // Templates laden (nur für Admins)
    if (isAdmin) {
      const unsubTemplates = onSnapshot(
        collection(db, "templates"),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as TournamentTemplate[];
          docs.sort((a, b) => a.name.localeCompare(b.name));
          setTemplates(docs);
        },
        () => { /* Templates sind optional – Fehler ignorieren */ },
      );
      return () => {
        unsubscribeSeasons();
        unsubscribeTournaments();
        unsubTemplates();
      };
    }

    return () => {
      unsubscribeSeasons();
      unsubscribeTournaments();
    };
  }, [user, isAuthReady, isAdmin]);

  const resetForm = () => {
    setTitle("");
    setCheckoutConfig(DEFAULT_CHECKOUT_CONFIG);
    setDrawRule(DEFAULT_DRAW_RULE);
    setMatchStartConfig(DEFAULT_MATCH_START);
    setNumberOfBoards(1);
    setSelectedSeasonId("");
    setTournamentNumber("");
    setIsFinalTournament(false);
    setIsRetroactive(false);
    setGrandFinalQualifiers(8);
    setGrandFinalQF("501_bo3");
    setGrandFinalSF("501_bo3");
    setGrandFinalF("501_bo5");
    setSelectedTemplateId("");
    setShowSaveTemplate(false);
    setTemplateName("");
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setCheckoutConfig(tmpl.checkoutRule ?? DEFAULT_CHECKOUT_CONFIG);
    setDrawRule(tmpl.drawRule ?? DEFAULT_DRAW_RULE);
    setMatchStartConfig(tmpl.matchStartConfig ?? DEFAULT_MATCH_START);
    setNumberOfBoards(tmpl.numberOfBoards ?? 1);
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      await deleteDoc(doc(db, "templates", templateId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `templates/${templateId}`);
    }
  };

  const saveTemplate = async () => {
    if (!user || !templateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      await addDoc(collection(db, "templates"), {
        name: templateName.trim(),
        checkoutRule: checkoutConfig,
        drawRule,
        matchStartConfig,
        numberOfBoards,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        createdByEmail: user.email ?? "",
      });
      setShowSaveTemplate(false);
      setTemplateName("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "templates");
    } finally {
      setIsSavingTemplate(false);
    }
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
        checkoutRule: checkoutConfig,
        drawRule,
        matchStartConfig,
        numberOfBoards,
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      };
      if (selectedSeasonId) data.seasonId = selectedSeasonId;
      if (isFinalTournament) {
        data.isFinalTournament = true;
        data.grandFinalConfig = {
          qualifierCount: grandFinalQualifiers,
          quarterFormat: grandFinalQF,
          semiFormat: grandFinalSF,
          finalFormat: grandFinalF,
        };
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
    <div className="page-pad">
      <div className="section-gap">
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

                  {/* Template laden */}
                  {isAdmin && templates.length > 0 && (
                    <div className="grid gap-2">
                      <Label>Von Template laden</Label>
                      <div className="flex gap-2">
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => applyTemplate(e.target.value)}
                          className="flex-1 border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        >
                          <option value="">— Kein Template —</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {isSuperAdmin && selectedTemplateId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 shrink-0"
                            onClick={() => { deleteTemplate(selectedTemplateId); setSelectedTemplateId(""); }}
                            title="Template löschen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

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
                          {isFinalTournament && (
                            <div className="mt-3 space-y-3 pl-6 border-l-2 border-yellow-300 dark:border-yellow-600">
                              <div>
                                <Label className="text-xs text-zinc-500 font-normal mb-1.5 block">Qualifier-Anzahl</Label>
                                <div className="flex gap-1.5">
                                  {[4, 6, 8, 10].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() => setGrandFinalQualifiers(n)}
                                      className={`w-10 h-8 rounded-md text-sm font-bold transition-colors ${
                                        grandFinalQualifiers === n
                                          ? "bg-yellow-500 text-white"
                                          : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                                      }`}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="grid gap-1.5">
                                <Label className="text-xs text-zinc-500 font-normal">KO-Formate</Label>
                                {[
                                  { label: "Viertelfinale", value: grandFinalQF, set: setGrandFinalQF },
                                  { label: "Halbfinale",    value: grandFinalSF, set: setGrandFinalSF },
                                  { label: "Finale",        value: grandFinalF,  set: setGrandFinalF  },
                                ].map(({ label, value, set }) => (
                                  <div key={label} className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-500 w-24">{label}</span>
                                    <select
                                      value={value}
                                      onChange={(e) => set(e.target.value)}
                                      className="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-xs bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                                    >
                                      <option value="501_bo1">501 · Best of 1</option>
                                      <option value="501_bo3">501 · Best of 3</option>
                                      <option value="501_bo5">501 · Best of 5</option>
                                      <option value="301_bo1">301 · Best of 1</option>
                                      <option value="301_bo3">301 · Best of 3</option>
                                    </select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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

                  {/* Dartscheiben */}
                  <div className="grid gap-2 pt-2 border-t">
                    <Label htmlFor="boards">Dartscheiben</Label>
                    <select
                      id="boards"
                      value={numberOfBoards}
                      onChange={(e) => setNumberOfBoards(Number(e.target.value))}
                      className="border border-zinc-200 rounded-md px-3 py-2 text-sm bg-white dark:bg-zinc-900 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n} Dartscheibe{n === 1 ? "" : "n"}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-400">
                      Wie viele Dartscheiben stehen gleichzeitig zur Verfügung?
                    </p>
                  </div>

                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Checkout-Regel</Label>
                    <CheckoutBuilder
                      value={checkoutConfig}
                      onChange={setCheckoutConfig}
                      showInRule={true}
                    />
                  </div>

                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Draw-Regel</Label>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="drawEnabled"
                        checked={drawRule.enabled}
                        onChange={(e) => setDrawRule({ enabled: e.target.checked })}
                        className="mt-0.5"
                      />
                      <div>
                        <Label htmlFor="drawEnabled" className="font-normal">
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
                      value={matchStartConfig}
                      onChange={setMatchStartConfig}
                    />
                  </div>

                  {/* Als Template speichern */}
                  {isAdmin && (
                    <div className="pt-2 border-t">
                      {showSaveTemplate ? (
                        <div className="flex gap-2">
                          <Input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="Template-Name"
                            maxLength={60}
                            className="flex-1"
                            onKeyDown={(e) => { if (e.key === 'Enter') saveTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false); }}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={saveTemplate}
                            disabled={isSavingTemplate || !templateName.trim()}
                          >
                            {isSavingTemplate ? "..." : "Speichern"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowSaveTemplate(false)}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowSaveTemplate(true)}
                          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                          + Als Template speichern
                        </button>
                      )}
                    </div>
                  )}
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
                  {t.numberOfBoards > 1 && (
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-zinc-100 text-zinc-600">
                      🎯 {t.numberOfBoards} Scheiben
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
