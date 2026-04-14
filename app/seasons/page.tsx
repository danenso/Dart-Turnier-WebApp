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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Plus, Trash2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";

export default function SeasonsPage() {
  const { user, isAuthReady } = useFirebase();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    const q = query(
      collection(db, "seasons"),
      where("ownerId", "==", user.uid),
    );
    return onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        docs.sort((a, b) => a.number - b.number);
        setSeasons(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, "seasons"),
    );
  }, [user, isAuthReady]);

  const createSeason = async () => {
    if (!user || !seasonName.trim()) return;
    setIsCreating(true);
    try {
      await addDoc(collection(db, "seasons"), {
        name: seasonName.trim(),
        number: seasons.length + 1,
        status: "active",
        createdAt: new Date().toISOString(),
        ownerId: user.uid,
      });
      setSeasonName("");
      setIsDialogOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "seasons");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (season: any) => {
    const newStatus = season.status === "active" ? "completed" : "active";
    try {
      await updateDoc(doc(db, "seasons", season.id), {
        name: season.name,
        number: season.number,
        status: newStatus,
        createdAt: season.createdAt,
        ownerId: season.ownerId,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `seasons/${season.id}`);
    }
  };

  const deleteSeason = async (id: string) => {
    try {
      await deleteDoc(doc(db, "seasons", id));
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `seasons/${id}`);
    }
  };

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Laden...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Seasons</h1>
            <p className="text-zinc-500">
              Verwalte deine Saisons und verknüpfe Turniere damit.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Neue Season
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {seasons.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-zinc-500" />
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirmId(s.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 -mt-1 -mr-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>Season #{s.number}</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => toggleStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold cursor-pointer transition-colors ${
                    s.status === "active"
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {s.status === "active" ? "Aktiv" : "Abgeschlossen"}
                </button>
              </CardContent>
            </Card>
          ))}
          {seasons.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg border-zinc-200">
              <p className="text-zinc-500">
                Noch keine Seasons. Erstelle eine Season um zu beginnen.
              </p>
            </div>
          )}
        </div>

        {/* Create Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Season erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Season Name</Label>
                <Input
                  value={seasonName}
                  onChange={(e) => setSeasonName(e.target.value)}
                  placeholder="z.B. Saison 1 oder Winter 2024"
                  onKeyDown={(e) => e.key === "Enter" && createSeason()}
                />
                <p className="text-xs text-zinc-400">
                  Wird automatisch als Season #{seasons.length + 1} nummeriert.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={createSeason}
                disabled={isCreating || !seasonName.trim()}
              >
                {isCreating ? "Erstellen..." : "Season erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm Dialog */}
        <Dialog
          open={!!deleteConfirmId}
          onOpenChange={() => setDeleteConfirmId(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Season löschen?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-zinc-500">
              Die Season wird gelöscht. Bereits verknüpfte Turniere behalten
              ihre Daten, verlieren aber die Season-Zuordnung.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
              >
                Abbrechen
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteSeason(deleteConfirmId)}
              >
                Löschen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
