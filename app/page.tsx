"use client";

import { useFirebase } from "@/components/FirebaseProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@iconify/react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const { user, isAuthReady, signIn, signInWithEmail, accessDenied } = useFirebase();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const formLoadTime = useRef(Date.now());

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) {
      router.replace("/liga");
    }
  }, [isAuthReady, user, router]);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsSendingReset(true);
    setForgotMsg(null);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      setForgotMsg({ type: "success", text: "E-Mail zum Zurücksetzen wurde gesendet. Bitte prüfe deinen Posteingang (auch Spam)." });
    } catch (error: any) {
      const code = error?.code || "";
      if (code.includes("user-not-found") || code.includes("invalid-email")) {
        setForgotMsg({ type: "success", text: "Falls ein Konto mit dieser E-Mail existiert, wird eine E-Mail gesendet." });
      } else {
        setForgotMsg({ type: "error", text: "Fehler beim Senden. Bitte erneut versuchen." });
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex">
      {/* Branding-Panel – nur auf großen Bildschirmen */}
      <div className="hidden lg:flex flex-col flex-1 bg-zinc-900 items-center justify-center relative overflow-hidden p-12">
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
          <Icon icon="mdi:bullseye" className="w-20 h-20 mx-auto mb-6 text-amber-400" />
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
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-zinc-900 rounded-full mb-4">
              <Icon icon="mdi:bullseye" className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Pfeilwurf.de</h1>
          </div>

          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {forgotMode ? "Passwort zurücksetzen" : "Anmelden"}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 mb-8 text-sm">
            {forgotMode
              ? "Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen."
              : "Willkommen zurück – melde dich an um fortzufahren."}
          </p>

          {!forgotMode ? (
            <form onSubmit={handleEmailLogin} className="space-y-4" noValidate>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Passwort</Label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(loginEmail); setForgotMsg(null); }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    Passwort vergessen?
                  </button>
                </div>
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
                <p className="text-sm text-amber-400 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-md">
                  {loginError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Anmelden..." : "Anmelden"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-Mail-Adresse</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="deine@email.de"
                  autoComplete="email"
                  required
                />
              </div>
              {forgotMsg && (
                <p className={`text-sm px-3 py-2 rounded-md ${
                  forgotMsg.type === "success"
                    ? "text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400"
                    : "text-amber-400 bg-red-50 dark:bg-red-950/30"
                }`}>
                  {forgotMsg.text}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isSendingReset}>
                {isSendingReset ? "Wird gesendet..." : "Zurücksetzen-Link senden"}
              </Button>
              <button
                type="button"
                onClick={() => { setForgotMode(false); setForgotMsg(null); }}
                className="w-full text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors text-center"
              >
                ← Zurück zum Login
              </button>
            </form>
          )}

          {!forgotMode && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-400">oder</span>
                </div>
              </div>

              {accessDenied && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                  Kein Zugang. Deine E-Mail-Adresse ist nicht eingeladen. Bitte wende dich an den Administrator.
                </div>
              )}

              <Button onClick={signIn} variant="outline" className="w-full gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Mit Google anmelden
              </Button>
            </>
          )}

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-10">
            © {new Date().getFullYear()} Pfeilwurf.de
          </p>
        </div>
      </div>
    </div>
  );
}
