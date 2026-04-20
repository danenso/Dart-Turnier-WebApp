"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, secondaryAuth } from "@/lib/firebase";
import { handleFirestoreError, OperationType } from "@/lib/firestore-errors";
import { processAvatarToBase64, AvatarUploadError } from "@/lib/avatar-upload";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, updateDoc, deleteDoc, setDoc, where } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadSong, SongUploadError } from "@/lib/song-upload";
import { slugify } from "@/lib/slugify";
import { ArrowLeft, Trash2, Upload, User, Music2, X, Shield } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function PlayerEditPage() {
  const { id } = useParams() as { id: string };
  const { user, isAuthReady, isAdmin, isSuperAdmin } = useFirebase();
  const router = useRouter();

  const [player, setPlayer] = useState<any>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPlayerAdmin, setIsPlayerAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Song state
  const [songUrl, setSongUrl] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songFileName, setSongFileName] = useState("");
  const [songError, setSongError] = useState("");
  const [isUploadingSong, setIsUploadingSong] = useState(false);
  const songInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    if (!isAdmin) {
      router.push("/players");
      return;
    }

    const fetchPlayer = async () => {
      try {
        // Slug-basierter Lookup: alle Spieler des Admins laden und per Slug filtern
        const snap = await getDocs(
          query(collection(db, "players"), where("ownerId", "==", user.uid))
        );
        const found = snap.docs.find(d => slugify(d.data().name) === id);
        if (found) {
          const data = found.data();
          setPlayer({ id: found.id, ...data });
          setName(data.name || "");
          setNickname(data.nickname || "");
          setEmail(data.email || "");
          setAvatar(data.avatar || "");
          setSongUrl(data.songUrl || "");
          setSongTitle(data.songTitle || "");
          setSongArtist(data.songArtist || "");

          // Admin-Status laden falls authUid vorhanden
          if (data.authUid && isSuperAdmin) {
            const userDoc = await getDoc(doc(db, "users", data.authUid));
            setIsPlayerAdmin(userDoc.exists() && userDoc.data().role === "admin");
          }
        } else {
          router.push("/players");
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `players/${id}`);
      }
    };

    fetchPlayer();
  }, [id, user, isAuthReady, isAdmin, router]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Bild zu groß. Maximal 5 MB erlaubt.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarError("Nur Bilddateien sind erlaubt.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!player) return;
    setIsSaving(true);

    try {
      let authUid = player.authUid;
      let finalAvatar = avatar;

      // Avatar verarbeiten falls eine neue Datei ausgewählt wurde
      if (avatarFile) {
        setIsProcessing(true);
        try {
          finalAvatar = await processAvatarToBase64(avatarFile);
        } catch (err) {
          const msg = err instanceof AvatarUploadError
            ? err.message
            : `Verarbeitung fehlgeschlagen: ${(err as Error).message ?? "Unbekannter Fehler"}`;
          setAvatarError(msg);
          setIsSaving(false);
          setIsProcessing(false);
          return;
        } finally {
          setIsProcessing(false);
        }
      }

      // If email and password are provided and no authUid exists, create a user
      let invitationSent = false;
      if (email && password && !authUid && isAdmin) {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password,
        );
        authUid = userCredential.user.uid;

        // Einladungsmail senden
        try {
          const res = await fetch("/api/send-invitation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerName: name, email, password }),
          });
          if (res.ok) invitationSent = true;
        } catch {
          // Mail-Fehler sind nicht kritisch – Speichern geht weiter
        }
      }

      // Song hochladen falls neue Datei ausgewählt
      let finalSongUrl = songUrl;
      if (songFile) {
        setIsUploadingSong(true);
        try {
          finalSongUrl = await uploadSong(songFile, player.id, player.songUrl);
        } catch (err) {
          const msg = err instanceof SongUploadError
            ? err.message
            : `Song-Upload fehlgeschlagen: ${(err as Error).message ?? "Unbekannter Fehler"}`;
          setSongError(msg);
          setIsSaving(false);
          setIsUploadingSong(false);
          return;
        } finally {
          setIsUploadingSong(false);
        }
      }

      const updates: any = {
        name,
        nickname,
        avatar: finalAvatar,
        songUrl: finalSongUrl,
        songTitle,
        songArtist,
      };

      if (email) updates.email = email;
      if (authUid) updates.authUid = authUid;

      await updateDoc(doc(db, "players", player.id), updates);

      // Admin-Status in users-Collection speichern (nur Super Admin)
      const targetUid = authUid || player.authUid;
      if (isSuperAdmin && targetUid) {
        await setDoc(doc(db, "users", targetUid), {
          role: isPlayerAdmin ? "admin" : "user",
          email: email || player.email || "",
        }, { merge: true });
      }

      if (invitationSent) {
        router.push("/players?invited=1");
      } else {
        router.push("/players");
      }
    } catch (error) {
      console.error("Error updating player:", error);
      alert("Failed to update player. " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSongFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSongError("");
    if (file.size > 20 * 1024 * 1024) {
      setSongError("Datei zu groß. Maximal 20 MB erlaubt.");
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setSongError("Nur Audiodateien (.mp3) sind erlaubt.");
      return;
    }
    setSongFile(file);
    setSongFileName(file.name);
    if (!songTitle) setSongTitle(file.name.replace(/\.[^/.]+$/, ""));
  };

  const handleRemoveSong = async () => {
    if (!player) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "players", player.id), { songUrl: "", songTitle: "", songArtist: "" });
      setSongUrl("");
      setSongTitle("");
      setSongArtist("");
      setSongFile(null);
      setSongFileName("");
    } catch (error) {
      console.error("Error removing song:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!player) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "players", player.id), { avatar: "" });
      setAvatar("");
      setAvatarPreview(null);
      setAvatarFile(null);
    } catch (error) {
      console.error("Error removing avatar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!player || !isAdmin) return;

    setIsSaving(true);
    try {
      await deleteDoc(doc(db, "players", player.id));
      router.push("/players");
    } catch (error) {
      console.error("Error deleting player:", error);
      alert("Failed to delete player. " + (error as Error).message);
      setIsSaving(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (!isAuthReady || !player) return <div className="p-8">Loading...</div>;

  return (
    <div className="page-pad">
      <div className="section-gap">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/players">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Edit Player</h1>
          </div>
          {isAdmin && (
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isSaving}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete Player
            </Button>
          )}
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. The Power"
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0">
                  {avatarPreview || avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview ?? avatar}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <User className="w-8 h-8 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarFileChange}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing || isSaving}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isProcessing ? "Wird verarbeitet..." : "Bild auswählen"}
                    </Button>
                    {(avatar || avatarPreview) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={handleRemoveAvatar}
                        disabled={isProcessing || isSaving}
                      >
                        Avatar entfernen
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Max. 5 MB · wird automatisch auf 256×256 px skaliert und als WebP/AVIF gespeichert
                  </p>
                  {avatarError && (
                    <p className="text-xs text-red-500">{avatarError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Song Upload */}
            <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <Label>Einlaufsong</Label>
              <input
                ref={songInputRef}
                type="file"
                accept="audio/mpeg,audio/mp3,.mp3"
                className="hidden"
                onChange={handleSongFileChange}
              />
              {(songUrl || songFileName) && (
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-md px-3 py-2 text-sm">
                  <Music2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="truncate text-zinc-700 dark:text-zinc-300 flex-1">
                    {songFileName || "Aktueller Song"}
                  </span>
                  <button onClick={handleRemoveSong} disabled={isSaving} className="text-zinc-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => songInputRef.current?.click()}
                disabled={isUploadingSong || isSaving}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploadingSong ? "Wird hochgeladen..." : songUrl ? "Song ersetzen" : "MP3 auswählen"}
              </Button>
              {songError && <p className="text-xs text-red-500">{songError}</p>}
              <p className="text-xs text-zinc-500">Max. 20 MB · nur .mp3</p>

              {/* Metadaten */}
              {(songFile || songUrl) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Titel</Label>
                    <Input
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Song-Titel"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Interpret</Label>
                    <Input
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="Künstler"
                      maxLength={100}
                    />
                  </div>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="pt-6 mt-6 border-t border-zinc-200">
                <h4 className="font-medium mb-4">Login Credentials</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!!player?.authUid}
                    />
                  </div>
                  {!player?.authUid && (
                    <div className="space-y-2">
                      <Label>Password (for initial setup)</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  )}
                  {player?.authUid && (
                    <p className="text-sm text-green-600">✓ Login konfiguriert</p>
                  )}

                  {/* Admin-Toggle nur für Super Admin, wenn Spieler einen Account hat */}
                  {isSuperAdmin && (player?.authUid || (email && password)) && (
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-zinc-500" />
                        <div>
                          <p className="text-sm font-medium">Admin-Rechte</p>
                          <p className="text-xs text-zinc-500">Spieler kann Turniere und Spieler verwalten</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsPlayerAdmin(!isPlayerAdmin)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          isPlayerAdmin ? "bg-zinc-900 dark:bg-white" : "bg-zinc-200 dark:bg-zinc-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${
                            isPlayerAdmin ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Link href="/players">
              <Button variant="outline">Abbrechen</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving || isProcessing || isUploadingSong}>
              {isUploadingSong ? "Song wird hochgeladen..." : isProcessing ? "Wird verarbeitet..." : isSaving ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Player</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this player? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {isSaving ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
