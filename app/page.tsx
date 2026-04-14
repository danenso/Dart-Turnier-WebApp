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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";

export default function Home() {
  const { user, isAuthReady, signIn, signInWithEmail } = useFirebase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  // Bot protection
  const [honeypot, setHoneypot] = useState("");
  const formLoadTime = useRef(Date.now());

  // Form state
  const [title, setTitle] = useState("");
  const [allowSingleOut, setAllowSingleOut] = useState(false);
  const [allowDoubleOut, setAllowDoubleOut] = useState(true);
  const [allowTripleOut, setAllowTripleOut] = useState(false);
  const [allowDraw, setAllowDraw] = useState(false);
  // Season & Retroaktiv
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
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "seasons");
      },
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
        const t = allDocs.filter(
          (doc) => doc.type !== "single_match" && doc.type !== "casual_tiebreak",
        );
        setTournaments(t);
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
        // Just keeping this for backward compatibility if needed, 
        // though players aren't strictly needed on the dashboard anymore
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "players");
      },
    );

    return () => {
      unsubscribeSeasons();
      unsubscribeTournaments();
      unsubscribePlayers();
    };
  }, [user, isAuthReady]);

  const getLoginError = (error: any): string => {
    const code = error?.code || "";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      return "E-Mail oder Passwort ist falsch.";
    }
    if (code.includes("too-many-requests")) {
      return "Zu viele Versuche. Bitte später erneut versuchen.";
    }
    if (code.includes("network")) {
      return "Netzwerkfehler. Bitte Verbindung prüfen.";
    }
    return "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bot protection: honeypot must be empty and form must take >1.5s to fill
    if (honeypot || Date.now() - formLoadTime.current < 1500) return;
    setLoginError("");
    setIsLoggingIn(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
    } catch (error: any) {
      setLoginError(getLoginError(error));
    } finally {
      setIsLoggingIn(false);
    }
  };

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex">
        {/* Branding-Panel – nur auf großen Bildschirmen */}
        <div className="hidden lg:flex flex-col flex-1 bg-zinc-900 items-center justify-center relative overflow-hidden p-12">
          {/* Dekorative Zielscheiben-Ringe */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            {[700, 560, 420, 280, 140].map((size, i) => (
              <div
                key={size}
                className="absolute rounded-full border border-zinc-700"
                style={{ width: size, height: size, opacity: 0.25 - i * 0.03 }}
              />
            ))}
          </div>
          <div className="relative z-10 text-center">
            <Icon icon="mdi:bullseye" className="w-20 h-20 mx-auto mb-6 text-red-500" />
            <h1 className="text-5xl font-black text-white tracking-tight">Pfeilwurf.de</h1>
            <p className="mt-4 text-zinc-400 text-lg max-w-sm mx-auto leading-relaxed">
              Turniere, Liga &amp; Statistiken –<br />alles für dein Dart-Team
            </p>
            <div className="mt-12 grid grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-xl font-bold text-white">Liga</div>
                <div className="text-zinc-500 text-sm mt-1">Saisonverwaltung</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">Turniere</div>
                <div className="text-zinc-500 text-sm mt-1">Live-Verwaltung</div>
              </div>
              <div>
                <div className="text-xl font-bold text-white">Statistiken</div>
                <div className="text-zinc-500 text-sm mt-1">Spielerprofile</div>
              </div>
            </div>
          </div>
        </div>

        {/* Login-Panel */}
        <div className="flex flex-1 flex-col items-center justify-center p-8 bg-white dark:bg-zinc-950">
          <div className="w-full max-w-sm">
            {/* Logo für mobile */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-full mb-4">
                <Icon icon="mdi:bullseye" className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Pfeilwurf.de</h1>
            </div>

            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Anmelden</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1 mb-8 text-sm">
              Willkommen zurück – melde dich an um fortzufahren.
            </p>

            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
              {/* Honeypot – für Bots unsichtbar */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="deine@email.de"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
                  {loginError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Anmelden..." : "Anmelden"}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-400">oder</span>
              </div>
            </div>

            <Button onClick={signIn} variant="outline" className="w-full gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Mit Google anmelden
            </Button>

            <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-10">
              © {new Date().getFullYear()} Pfeilwurf.de
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Deine Turniere
            </h1>
            <p className="text-zinc-500">
              Verwalte deine Dart-Events und verfolge Ergebnisse.
            </p>
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

                  {/* Season-Zuordnung */}
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
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
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
                              <Label className="whitespace-nowrap font-normal">
                                Turnier Nr.
                              </Label>
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={tournamentNumber}
                                onChange={(e) =>
                                  setTournamentNumber(
                                    e.target.value === ""
                                      ? ""
                                      : Number(e.target.value),
                                  )
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

                  {/* Retroaktiv */}
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
                        <span className="text-zinc-400 text-xs">
                          (Ergebnisse manuell eintragen)
                        </span>
                      </Label>
                    </div>
                  </div>

                  <div className="grid gap-2 pt-2 border-t">
                    <Label>Out Rules</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="singleOut"
                        checked={allowSingleOut}
                        onChange={(e) => setAllowSingleOut(e.target.checked)}
                      />
                      <Label htmlFor="singleOut" className="font-normal">
                        Single Out (incl. Bull)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="doubleOut"
                        checked={allowDoubleOut}
                        onChange={(e) => setAllowDoubleOut(e.target.checked)}
                      />
                      <Label htmlFor="doubleOut" className="font-normal">
                        Double Out (incl. Bull&apos;s Eye)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="tripleOut"
                        checked={allowTripleOut}
                        onChange={(e) => setAllowTripleOut(e.target.checked)}
                      />
                      <Label htmlFor="tripleOut" className="font-normal">
                        Triple Out (incl. Bull&apos;s Eye)
                      </Label>
                    </div>
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
                  <Button
                    variant="outline"
                    onClick={() => { setIsDialogOpen(false); resetForm(); }}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={createTournament}
                    disabled={isCreating || !title.trim()}
                  >
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
                    {new Date(t.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-zinc-100 text-zinc-900">
                    {t.status.toUpperCase()}
                  </div>
                  {season && (
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-blue-100 text-blue-800">
                      {season.name}
                      {t.isFinalTournament
                        ? " · Final"
                        : t.tournamentNumber
                          ? ` · #${t.tournamentNumber}`
                          : ""}
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
              <p className="text-zinc-500">
                No tournaments yet. Create one to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
