"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/lib/firebase";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Shield, ShieldOff, Info } from "lucide-react";
import { useEffect, useState } from "react";

export default function AccountPage() {
  const { user, isAdmin, isSuperAdmin, logOut } = useFirebase();
  const [playerProfile, setPlayerProfile] = useState<any>(null);

  // Profil-Felder
  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Admin-Verwaltung (nur Super Admin)
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminMsg, setAdminMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isGoogleUser = user?.providerData.some((p) => p.providerId === "google.com") ?? false;
  const isEmailUser = user?.providerData.some((p) => p.providerId === "password") ?? false;

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || "");
    setNewEmail(user.email || "");
  }, [user]);

  // Spielerprofil laden (für Nicht-Admins)
  useEffect(() => {
    if (!user || isAdmin) return;
    const q = query(collection(db, "players"), where("authUid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setPlayerProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
    });
    return () => unsub();
  }, [user, isAdmin]);

  // Alle User laden (nur Super Admin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isSuperAdmin]);

  const handleSaveProfile = async () => {
    if (!user || !auth.currentUser) return;
    setIsSaving(true);
    setProfileMsg(null);

    try {
      // Name speichern (alle Nutzer)
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName });
      }

      // Nur für E-Mail/Passwort-Nutzer
      if (isEmailUser) {
        const emailChanged = newEmail && newEmail !== user.email;
        const passwordChanged = !!newPassword;

        if ((emailChanged || passwordChanged) && currentPassword) {
          const credential = EmailAuthProvider.credential(user.email!, currentPassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
        }

        if (emailChanged) await updateEmail(auth.currentUser, newEmail);
        if (passwordChanged) await updatePassword(auth.currentUser, newPassword);
      }

      setProfileMsg({ type: "success", text: "Profil erfolgreich gespeichert." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      let msg = "Fehler beim Speichern.";
      if (err.code === "auth/wrong-password") msg = "Aktuelles Passwort ist falsch.";
      else if (err.code === "auth/requires-recent-login") msg = "Bitte gib dein aktuelles Passwort ein.";
      else if (err.code === "auth/email-already-in-use") msg = "Diese E-Mail wird bereits verwendet.";
      setProfileMsg({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAdminRole = async (targetUser: any) => {
    if (!isSuperAdmin) return;
    setAdminMsg(null);
    const newRole = targetUser.role === "admin" ? "user" : "admin";
    try {
      await updateDoc(doc(db, "users", targetUser.id), { role: newRole });

      // Auch im players-Dokument aktualisieren falls vorhanden
      const playerSnap = await getDocs(
        query(collection(db, "players"), where("authUid", "==", targetUser.id))
      );
      if (!playerSnap.empty) {
        await updateDoc(doc(db, "players", playerSnap.docs[0].id), {});
      }

      setAdminMsg({
        type: "success",
        text: `${targetUser.email} ist jetzt ${newRole === "admin" ? "Admin" : "kein Admin mehr"}.`,
      });
    } catch {
      setAdminMsg({ type: "error", text: "Fehler beim Aktualisieren der Rolle." });
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-zinc-500">Verwalte deine Kontodaten.</p>
        </div>

        {/* Profil bearbeiten */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-5">
          <h2 className="text-xl font-semibold">Profil</h2>

          <div className="flex items-center gap-3 text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800 rounded-md px-3 py-2">
            <Info className="w-4 h-4 shrink-0" />
            {isGoogleUser
              ? "Du bist mit Google angemeldet. E-Mail und Passwort werden von Google verwaltet."
              : "E-Mail/Passwort-Konto. Gib dein aktuelles Passwort ein um E-Mail oder Passwort zu ändern."}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dein Name" />
            </div>

            <div className="space-y-1">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={isGoogleUser}
                placeholder="E-Mail-Adresse"
              />
            </div>

            {isEmailUser && (
              <>
                <div className="space-y-1">
                  <Label>Neues Passwort</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leer lassen = nicht ändern"
                  />
                </div>
                {(newPassword || newEmail !== user.email) && (
                  <div className="space-y-1">
                    <Label>Aktuelles Passwort <span className="text-red-500">*</span></Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Zur Bestätigung erforderlich"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {profileMsg && (
            <p className={`text-sm ${profileMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
              {profileMsg.text}
            </p>
          )}

          <Button onClick={handleSaveProfile} disabled={isSaving}>
            {isSaving ? "Wird gespeichert..." : "Speichern"}
          </Button>
        </div>

        {/* Spielerstatistik für normale Nutzer */}
        {playerProfile && !isAdmin && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Deine Statistik</h2>
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800">
              <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                {playerProfile.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playerProfile.avatar} alt={playerProfile.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-zinc-400" />
                )}
              </div>
              <div>
                <p className="text-xl font-bold">{playerProfile.name}</p>
                {playerProfile.nickname && <p className="text-zinc-500">&quot;{playerProfile.nickname}&quot;</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Spiele", value: playerProfile.matchesPlayed || 0, color: "" },
                { label: "Siege", value: playerProfile.wins || 0, color: "text-green-600" },
                { label: "Unentschieden", value: playerProfile.draws || 0, color: "text-orange-500" },
                { label: "Niederlagen", value: playerProfile.losses || 0, color: "text-red-600" },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-zinc-500">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Abmelden */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">Abmelden</p>
            <p className="text-sm text-zinc-500 mt-0.5">Du wirst aus deinem Konto abgemeldet.</p>
          </div>
          <Button
            variant="destructive"
            onClick={logOut}
            className="shrink-0 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Abmelden
          </Button>
        </div>

        {/* Super Admin Panel */}
        {isSuperAdmin && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
              <h2 className="text-xl font-semibold">Admin-Verwaltung</h2>
            </div>
            <p className="text-sm text-zinc-500">Nur du als Super Admin kannst anderen Nutzern Admin-Rechte geben oder entziehen.</p>

            {adminMsg && (
              <p className={`text-sm ${adminMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>
                {adminMsg.text}
              </p>
            )}

            <div className="divide-y divide-zinc-200 dark:divide-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden">
              {allUsers.length === 0 && (
                <p className="p-4 text-sm text-zinc-500">Keine Nutzer gefunden.</p>
              )}
              {allUsers.map((u) => {
                const isSelf = u.id === user.uid;
                const isUserAdmin = u.role === "admin";
                return (
                  <div key={u.id} className="flex items-center justify-between p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <div>
                      <p className="text-sm font-medium">{u.email || u.id}</p>
                      <p className="text-xs text-zinc-500">{isUserAdmin ? "Admin" : "Nutzer"}</p>
                    </div>
                    {!isSelf && (
                      <Button
                        variant={isUserAdmin ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => toggleAdminRole(u)}
                      >
                        {isUserAdmin ? (
                          <><ShieldOff className="w-4 h-4 mr-1" /> Admin entziehen</>
                        ) : (
                          <><Shield className="w-4 h-4 mr-1" /> Admin machen</>
                        )}
                      </Button>
                    )}
                    {isSelf && (
                      <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">Super Admin</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
