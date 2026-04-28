# Dart-Turnier-WebApp

Next.js 15 App mit TypeScript, Tailwind CSS, Firebase und Gemini AI.
Läuft lokal (`npm run dev`) und auf Hostinger (Produktion).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Sprache**: TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Backend**: Firebase (Firestore, Auth, Storage)
- **E-Mail**: Nodemailer via SMTP
- **AI**: Google Gemini
- **PWA**: next-pwa

## Projektstruktur

```
app/              # Next.js App Router (Seiten & API Routes)
  api/            # Server-Side API Routes
  liga/           # Liga-Verwaltung
  tournament/     # Turnierspielansicht (aktives Turnier)
  tournaments/    # Turnierübersicht & -erstellung
  players/        # Spielerverwaltung
  standings/      # Rangliste
  seasons/        # Saisonverwaltung
  casual/         # Freundschaftsspiele
  settings/       # App-Einstellungen
  account/        # Benutzerkonto
components/       # Wiederverwendbare React-Komponenten
lib/              # Hilfsfunktionen (firebase.ts, email.ts, ...)
hooks/            # Custom React Hooks
public/           # Statische Assets
```

## Wichtige Dateien

- `lib/firebase.ts` – Firebase-Initialisierung
- `lib/email.ts` – E-Mail-Versand via SMTP
- `firebase-applet-config.json` – Firebase-Projektkonfiguration
- `firestore.rules` – Firestore-Sicherheitsregeln
- `.env.local` – Lokale Umgebungsvariablen (nicht in Git)
- `.env.example` – Vorlage für alle benötigten Env-Variablen
- `components/FirebaseProvider.tsx` – Auth-Context: `user`, `isAdmin`, `isSuperAdmin`, `accessDenied`
- `components/AppLayout.tsx` – Sidebar + Mobile-Nav, Liga-Query für Sidebar

## Schlüsselseiten & Dateipfade

| Route | Datei | Hinweis |
|---|---|---|
| `/tournaments` | `app/tournaments/page.tsx` | Turnierliste + Erstellen (nur Admin) |
| `/tournament/[id]` | `app/tournament/[id]/page.tsx` | Turnier-Detail & Ablauf |
| `/tournament/[id]/match/[matchId]` | `app/tournament/[id]/match/[matchId]/page.tsx` | Spiel-Eingabe |
| `/casual` | `app/casual/page.tsx` | Freie Spiele (Single Match & Tiebreak) |
| `/players` | `app/players/page.tsx` | Spielerliste (alle User sehen alle Spieler) |
| `/liga` | `app/liga/page.tsx` | Liga-Übersicht (alle User sehen alle Ligen) |
| `/liga/[id]` | `app/liga/[id]/page.tsx` | Liga-Detail; Redirect-Check ~Zeile 201 |
| `/standings` | `app/standings/page.tsx` | Saisonrangliste |

## Rollen & Berechtigungen

- **SuperAdmin**: `hello@danenso.com` / UID `xV97IDspMmYcUkXvPP1eOlJD3KI2` (hardcoded in Rules + FirebaseProvider)
- **Admin**: `users/{uid}.role == 'admin'` in Firestore
- **User**: Eingeladener Regular User (`users/{uid}.role == 'user'`)
- Rolle immer aus `useFirebase()` holen: `const { isAdmin, isSuperAdmin } = useFirebase();`

## Firestore-Zugriffsmuster

- `players`, `liga`, `liga/*/seasons`, `liga/*/seasons/*/games`, `seasons` → alle Auth-User können lesen
- `tournaments` lesen: Owner, Admin, `isPublic == true`, SuperAdmin-Content, `participantUids`
- `tournaments` erstellen: Admin (reguläre Turniere) oder alle User (type: `single_match`/`casual_tiebreak`)
- `tournaments/*/matches` → alle Auth-User via Collection-Group-Rule
- Firestore deploy: `npx firebase-tools@latest deploy --only firestore:rules --project gen-lang-client-0517497985`

## Casual-Spiele vs. Reguläre Turniere

- Casual: `type: "single_match"` oder `type: "casual_tiebreak"` in der `tournaments`-Collection
- Reguläre Turniere: kein `type`-Feld
- `isPublic: true` → für alle sichtbar; `participantUids` → private Spiel-Sichtbarkeit

## Häufige Fehlerquellen

- Liga-Detail Redirect: `app/liga/[id]/page.tsx` ~Zeile 201 – prüft Owner-Zugriff
- Sidebar-Liga-Query: `components/AppLayout.tsx` ~Zeile 51 – muss `isAdmin` berücksichtigen
- Spieler-Statistiken: `app/players/[id]/page.tsx` – Query muss alle Spieler laden, nicht nur eigene
- Firestore-Query ohne passende Rule → silenter Fehler oder leeres Ergebnis
- `isAdmin` ist asynchron (Firestore-Fetch) → immer in useEffect-Dependencies aufnehmen

## Git-Workflow

- **`dev`** – Entwicklungs-Branch (immer hierhin pushen)
- **`main`** – Produktions-Branch (nur bei Release, löst Auto-Deploy aus)
- **Nie direkt auf `main` pushen** – main ist mit Hostinger-Produktion verbunden

## Setup auf neuem Gerät

1. `npm install`
2. `.env.local` anlegen (siehe `.env.example`) und alle Werte eintragen
3. `npm run dev` starten

Zuletzt eingerichtet: 2026-04-14 auf macOS (danenso)

## Lokale Entwicklung

```bash
npm run dev      # Dev-Server starten (http://localhost:3000)
npm run build    # Produktions-Build
npm run lint     # ESLint
```

## Deployment

Push auf `main` → GitHub Actions baut und deployed automatisch auf Hostinger via SSH.
Secrets in GitHub eintragen: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PORT`, `APP_PATH`

## Umgebungsvariablen

Alle Variablen: siehe `.env.example`
Lokale Werte: `.env.local` (muss auf jedem Gerät angelegt werden)
