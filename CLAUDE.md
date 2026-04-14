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
