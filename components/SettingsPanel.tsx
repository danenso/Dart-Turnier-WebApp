"use client";

import { useTheme } from "next-themes";
import { useLanguage } from "@/components/LanguageProvider";
import {
  useThemeCustomizer,
  GOOGLE_FONTS,
  ICON_LIBRARIES,
  DEFAULT_THEME_SETTINGS,
} from "@/components/ThemeCustomizerProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import {
  Monitor,
  Moon,
  Sun,
  Globe,
  Palette,
  Type,
  RotateCcw,
  ExternalLink,
  Search,
  Layers,
  ImageIcon,
  X,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { storage, db } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, collectionGroup, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { useFirebase } from "@/components/FirebaseProvider";
import { InvitationManager } from "@/components/InvitationManager";

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
        {hint && <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm"
          style={{ backgroundColor: value }}
        />
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="h-9 px-3 flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-xs font-mono text-zinc-600 dark:text-zinc-400 min-w-[90px] cursor-pointer">
            {value.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

function FontPreview({
  headingFont,
  bodyFont,
  headingTransform,
  headingStyle,
  headingWeight,
}: {
  headingFont: string;
  bodyFont: string;
  headingTransform: string;
  headingStyle: string;
  headingWeight: string;
}) {
  return (
    <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-1.5">
      <p
        className="text-lg text-zinc-900 dark:text-zinc-100"
        style={{
          fontFamily: `"${headingFont}", sans-serif`,
          textTransform: headingTransform as any,
          fontStyle: headingStyle,
          fontWeight: headingWeight,
        }}
      >
        Dart Turnier Manager
      </p>
      <p
        className="text-sm text-zinc-500 dark:text-zinc-400"
        style={{ fontFamily: `"${bodyFont}", sans-serif` }}
      >
        Spielergebnisse, Gruppen, K.O.-Runden und mehr.
      </p>
    </div>
  );
}

export function SettingsPanel() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { settings, updateSettings, resetSettings } = useThemeCustomizer();
  const { user, isSuperAdmin } = useFirebase();
  const [mounted, setMounted] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [cleanupLog, setCleanupLog] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const selectedLib = ICON_LIBRARIES.find((l) => l.id === settings.iconLibrary) ?? ICON_LIBRARIES[0];
  const filteredIcons = iconSearch.trim()
    ? selectedLib.preview.filter((icon) => icon.toLowerCase().includes(iconSearch.toLowerCase()))
    : selectedLib.preview;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return;
    setIsUploadingLogo(true);
    try {
      const path = `logos/${user.uid}/app-logo`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      updateSettings({ logoUrl: url });
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setIsUploadingLogo(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Beta-Einladungen (nur SuperAdmin) */}
      {isSuperAdmin && <InvitationManager />}

      {/* Reset */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("settings.title")}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("settings.description")}</p>
        </div>
        {showResetConfirm ? (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-sm text-zinc-500">Alles zurücksetzen?</span>
            <Button size="sm" variant="destructive" onClick={() => { resetSettings(); setShowResetConfirm(false); }}>
              Ja, zurücksetzen
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowResetConfirm(false)}>Abbrechen</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" onClick={() => setShowResetConfirm(true)}>
            <RotateCcw className="w-4 h-4 mr-1.5" />Zurücksetzen
          </Button>
        )}
      </div>

      {/* ─── Logo ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            App-Logo
          </CardTitle>
          <CardDescription>
            Eigenes Logo hochladen. Wird in der Seitenleiste und im Header angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
              {settings.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <ImageIcon className="w-8 h-8 text-zinc-400" />
              )}
            </div>
            <div className="space-y-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploadingLogo ? "Wird hochgeladen..." : settings.logoUrl ? "Logo ersetzen" : "Logo hochladen"}
                </Button>
                {settings.logoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => updateSettings({ logoUrl: "" })}>
                    <X className="w-4 h-4 mr-1" /> Entfernen
                  </Button>
                )}
              </div>
              <p className="text-xs text-zinc-500">Max. 5 MB · PNG, SVG oder JPG empfohlen</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Theme ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Monitor className="w-5 h-5" />{t("settings.appearance")}</CardTitle>
          <CardDescription>{t("settings.appearance.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Label>{t("settings.theme")}</Label>
            <div className="flex gap-2">
              {[
                { value: "light", label: t("settings.theme.light"), icon: Sun },
                { value: "dark",  label: t("settings.theme.dark"),   icon: Moon },
                { value: "system",label: t("settings.theme.system"), icon: Monitor },
              ].map(({ value, label, icon: Icon2 }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-sm ${
                    theme === value
                      ? "border-primary bg-primary/5 text-primary font-semibold"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"
                  }`}
                >
                  <Icon2 className="w-5 h-5" />{label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Typography ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Type className="w-5 h-5" />Typographie</CardTitle>
          <CardDescription>Google Fonts für Überschriften und Fließtext.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Überschriften-Schrift</Label>
              <Select value={settings.headingFont} onValueChange={(v) => updateSettings({ headingFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {GOOGLE_FONTS.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      <span style={{ fontFamily: `"${f.name}", sans-serif` }}>{f.name}</span>
                      <span className="ml-2 text-xs text-zinc-400">{f.category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fließtext-Schrift</Label>
              <Select value={settings.bodyFont} onValueChange={(v) => updateSettings({ bodyFont: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {GOOGLE_FONTS.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      <span style={{ fontFamily: `"${f.name}", sans-serif` }}>{f.name}</span>
                      <span className="ml-2 text-xs text-zinc-400">{f.category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Überschriften-Stil</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "none",       label: "Aa",  title: "Normal" },
                { value: "uppercase",  label: "AA",  title: "Großbuchstaben" },
                { value: "lowercase",  label: "aa",  title: "Kleinbuchstaben" },
                { value: "capitalize", label: "Aa+", title: "Erster Buchstabe groß" },
              ] as const).map((opt) => (
                <button key={opt.value} title={opt.title} onClick={() => updateSettings({ headingTransform: opt.value })}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-mono transition-all ${settings.headingTransform === opt.value ? "border-primary bg-primary/5 text-primary font-semibold" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"}`}>
                  {opt.label}
                </button>
              ))}
              <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700 self-center" />
              <button title="Kursiv" onClick={() => updateSettings({ headingStyle: settings.headingStyle === "italic" ? "normal" : "italic" })}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-all italic ${settings.headingStyle === "italic" ? "border-primary bg-primary/5 text-primary font-semibold" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"}`}>
                I
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Schriftdicke</Label>
            <div className="flex flex-wrap gap-2">
              {([
                { value: "300", label: "Dünn" },
                { value: "400", label: "Normal" },
                { value: "500", label: "Mittel" },
                { value: "600", label: "Halb-Fett" },
                { value: "700", label: "Fett" },
                { value: "800", label: "Extra-Fett" },
              ] as const).map((opt) => (
                <button key={opt.value} title={opt.label} onClick={() => updateSettings({ headingWeight: opt.value })}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${settings.headingWeight === opt.value ? "border-primary bg-primary/5 text-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-300"}`}
                  style={{ fontWeight: opt.value }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <FontPreview headingFont={settings.headingFont} bodyFont={settings.bodyFont} headingTransform={settings.headingTransform} headingStyle={settings.headingStyle} headingWeight={settings.headingWeight} />
        </CardContent>
      </Card>

      {/* ─── Colors ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" />Farben</CardTitle>
          <CardDescription>Primär- und Sekundärfarben sowie Schriftfarben anpassen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 rounded-xl overflow-hidden h-10">
            <div className="flex-1" style={{ backgroundColor: settings.primaryColor }} />
            <div className="flex-1" style={{ backgroundColor: settings.secondaryColor }} />
            <div className="flex-[0.5]" style={{ backgroundColor: settings.primaryFgColor }} />
            <div className="flex-[0.5]" style={{ backgroundColor: settings.secondaryFgColor }} />
            <div className="flex-[0.5]" style={{ backgroundColor: settings.lightForeground }} />
            <div className="flex-[0.5]" style={{ backgroundColor: settings.darkForeground }} />
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <div className="py-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Primärfarbe</p>
              <div className="space-y-3">
                <ColorField label="Primärfarbe" hint="Schaltflächen, aktive Elemente, Highlights" value={settings.primaryColor} onChange={(v) => updateSettings({ primaryColor: v })} />
                <ColorField label="Text auf Primärfarbe" hint="Schriftfarbe auf primär-farbigem Hintergrund" value={settings.primaryFgColor} onChange={(v) => updateSettings({ primaryFgColor: v })} />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: settings.primaryColor, color: settings.primaryFgColor }}>Schaltfläche</button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: settings.primaryColor, color: settings.primaryColor, backgroundColor: "transparent" }}>Outline</button>
              </div>
            </div>
            <div className="py-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Sekundärfarbe</p>
              <div className="space-y-3">
                <ColorField label="Sekundärfarbe" hint="Sekundäre Schaltflächen, Hintergründe" value={settings.secondaryColor} onChange={(v) => updateSettings({ secondaryColor: v })} />
                <ColorField label="Text auf Sekundärfarbe" value={settings.secondaryFgColor} onChange={(v) => updateSettings({ secondaryFgColor: v })} />
              </div>
            </div>
            <div className="py-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Schriftfarben</p>
              <div className="space-y-3">
                <ColorField label="Schriftfarbe (Hell-Modus)" hint="Haupttextfarbe im Light-Theme" value={settings.lightForeground} onChange={(v) => updateSettings({ lightForeground: v })} />
                <ColorField label="Schriftfarbe (Dunkel-Modus)" hint="Haupttextfarbe im Dark-Theme" value={settings.darkForeground} onChange={(v) => updateSettings({ darkForeground: v })} />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Schnell-Presets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { name: "Gold",     primary: "#D4AF37", fg: "#1a1a1a" },
                { name: "Standard", primary: "#171717", fg: "#fafafa" },
                { name: "Blau",     primary: "#2563eb", fg: "#ffffff" },
                { name: "Grün",     primary: "#16a34a", fg: "#ffffff" },
                { name: "Rot",      primary: "#dc2626", fg: "#ffffff" },
                { name: "Lila",     primary: "#7c3aed", fg: "#ffffff" },
                { name: "Orange",   primary: "#ea580c", fg: "#ffffff" },
                { name: "Cyan",     primary: "#0891b2", fg: "#ffffff" },
                { name: "Pink",     primary: "#db2777", fg: "#ffffff" },
              ].map((preset) => (
                <button key={preset.name} onClick={() => updateSettings({ primaryColor: preset.primary, primaryFgColor: preset.fg })}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs hover:border-zinc-400 transition-colors">
                  <span className="w-3.5 h-3.5 rounded-full border border-zinc-200 shrink-0" style={{ backgroundColor: preset.primary }} />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Icon Library ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />Icon-Bibliothek</CardTitle>
          <CardDescription>Wähle die Icon-Bibliothek. Standard: Material Design Icons (MDI).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ICON_LIBRARIES.map((lib) => (
              <button key={lib.id} onClick={() => updateSettings({ iconLibrary: lib.id })}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${settings.iconLibrary === lib.id ? "border-primary bg-primary/5 text-primary" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300"}`}>
                <Icon icon={lib.preview[0]} className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{lib.name}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{lib.prefix}:icon-name</p>
                </div>
                {settings.iconLibrary === lib.id && <div className="ml-auto shrink-0 w-2 h-2 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div>
              <p className="text-sm font-semibold">{selectedLib.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Präfix: <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{selectedLib.prefix}:</code></p>
            </div>
            <a href={selectedLib.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />Alle Icons
            </a>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" placeholder={`Icons in ${selectedLib.name} suchen...`} value={iconSearch} onChange={(e) => setIconSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50" />
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
              {filteredIcons.map((iconId) => (
                <button key={iconId} title={iconId.split(":")[1]} onClick={() => navigator.clipboard?.writeText(iconId)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                  <Icon icon={iconId} className="w-6 h-6 text-zinc-600 dark:text-zinc-400 group-hover:text-primary transition-colors" />
                  <span className="text-[9px] text-zinc-400 truncate w-full text-center leading-tight">{iconId.split(":")[1]}</span>
                </button>
              ))}
              {filteredIcons.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm text-zinc-400">Keine Icons für &ldquo;{iconSearch}&rdquo;</div>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 text-center">Icon-ID klicken zum Kopieren</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Daten-Bereinigung (nur SuperAdmin) ─── */}
      {isSuperAdmin && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Icon icon="mdi:refresh" className="w-5 h-5" />
              Statistiken zurücksetzen
            </CardTitle>
            <CardDescription>
              Setzt alle Spieler-Statistiken, Ränge und Achievements auf 0 zurück — für einen Neustart.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
              ⚠ Diese Aktion ist nicht rückgängig machbar. Match-Historie und Achievements werden auf 0 zurückgesetzt.
            </div>
            <Button
              variant="destructive"
              disabled={cleanupStatus === "running"}
              onClick={async () => {
                if (!confirm("Wirklich alle Statistiken zurücksetzen? Alle Match-Daten und Achievements werden auf 0 gesetzt.")) return;
                setCleanupStatus("running");
                setCleanupLog("Starte Bereinigung...");
                try {
                  // 1. Alle Spieler-Dokumente: earnedAchievements leeren
                  const playersSnap = await getDocs(collection(db, "players"));
                  let playerCount = 0;
                  for (const playerDoc of playersSnap.docs) {
                    const data = playerDoc.data();
                    if (data.earnedAchievements?.length) {
                      await updateDoc(doc(db, "players", playerDoc.id), { earnedAchievements: [] });
                      playerCount++;
                    }
                  }
                  setCleanupLog(`✓ ${playerCount} Spieler-Achievements geleert.\nLösche verwaiste Match-Dokumente...`);

                  // 2. Verwaiste matches-Subcollection löschen
                  const matchesSnap = await getDocs(collectionGroup(db, "matches"));
                  let matchCount = 0;
                  for (const matchDoc of matchesSnap.docs) {
                    await deleteDoc(matchDoc.ref);
                    matchCount++;
                  }
                  setCleanupLog(`✓ ${playerCount} Spieler-Achievements geleert.\n✓ ${matchCount} verwaiste Match-Dokumente gelöscht.\n\nBereinigung abgeschlossen.`);
                  setCleanupStatus("done");
                } catch (err: any) {
                  setCleanupLog(`Fehler: ${err?.message ?? "Unbekannter Fehler"}`);
                  setCleanupStatus("error");
                }
              }}
            >
              {cleanupStatus === "running" ? "Wird zurückgesetzt..." : "Statistiken auf 0 zurücksetzen"}
            </Button>
            {cleanupLog && (
              <pre className="text-xs bg-zinc-100 dark:bg-zinc-900 rounded p-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {cleanupLog}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Language ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.language.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-2">
            <Label>{t("settings.language")}</Label>
            <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("settings.language.en")}</SelectItem>
                <SelectItem value="de">{t("settings.language.de")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
