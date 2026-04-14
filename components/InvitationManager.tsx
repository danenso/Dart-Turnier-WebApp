"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useFirebase } from "@/components/FirebaseProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Trash2, UserPlus } from "lucide-react";

interface Invitation {
  email: string;
}

export function InvitationManager() {
  const { isSuperAdmin } = useFirebase();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchInvitations();
  }, [isSuperAdmin]);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "invitations"));
      setInvitations(snap.docs.map((d) => ({ email: d.id })));
    } finally {
      setLoading(false);
    }
  };

  const addInvitation = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    setError("");
    setAdding(true);
    try {
      await setDoc(doc(db, "invitations", email), {
        email,
        createdAt: serverTimestamp(),
      });
      setNewEmail("");
      await fetchInvitations();
    } catch {
      setError("Fehler beim Hinzufügen. Bitte erneut versuchen.");
    } finally {
      setAdding(false);
    }
  };

  const removeInvitation = async (email: string) => {
    await deleteDoc(doc(db, "invitations", email));
    setInvitations((prev) => prev.filter((i) => i.email !== email));
  };

  if (!isSuperAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Beta-Einladungen
        </CardTitle>
        <CardDescription>
          Nur eingeladene E-Mail-Adressen können sich registrieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="name@beispiel.de"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInvitation()}
          />
          <Button onClick={addInvitation} disabled={adding}>
            {adding ? "..." : "Einladen"}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
        {loading ? (
          <p className="text-sm text-zinc-400">Lade Einladungen...</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-zinc-400">Noch keine Einladungen.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {invitations.map((inv) => (
              <li key={inv.email} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <Mail className="w-4 h-4 text-zinc-400" />
                  {inv.email}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => removeInvitation(inv.email)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
