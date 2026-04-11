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

export default function Home() {
  const { user, isAuthReady, signIn, signInWithEmail } = useFirebase();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [allowSingleOut, setAllowSingleOut] = useState(false);
  const [allowDoubleOut, setAllowDoubleOut] = useState(true);
  const [allowTripleOut, setAllowTripleOut] = useState(false);
  const [allowDraw, setAllowDraw] = useState(false);

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

        const t = allDocs.filter(
          (doc) =>
            doc.type !== "single_match" && doc.type !== "casual_tiebreak",
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
      unsubscribeTournaments();
      unsubscribePlayers();
    };
  }, [user, isAuthReady]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
    } catch (error: any) {
      setLoginError(error.message || "Failed to sign in");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const createTournament = async () => {
    if (!user || !title.trim()) return;
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, "tournaments"), {
        title: title.trim(),
        status: "draft",
        allowSingleOut,
        allowDoubleOut,
        allowTripleOut,
        allowDraw,
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      });
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-zinc-900 text-white rounded-full flex items-center justify-center mb-4">
              <Target size={24} />
            </div>
            <CardTitle className="text-2xl font-bold">
              Dart Tournament Manager
            </CardTitle>
            <CardDescription>
              Sign in to organize and manage your dart events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-red-500">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in..." : "Sign in with Email"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-zinc-950 px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button onClick={signIn} variant="outline" className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Your Tournaments
            </h1>
            <p className="text-zinc-500">
              Manage your dart events and track results.
            </p>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
                New Tournament
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Tournament</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">Tournament Name *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Freitagsturnier April"
                      required
                    />
                  </div>
                  <div className="grid gap-2 mt-4">
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
                  <div className="grid gap-2 mt-4">
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
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createTournament}
                    disabled={isCreating || !title.trim()}
                  >
                    {isCreating ? "Creating..." : "Create Tournament"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
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
                  {t.status.toUpperCase()}
                </div>
              </CardContent>
            </Card>
          ))}
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
