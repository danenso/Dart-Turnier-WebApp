# App-Anpassungen & Bugfixes – Priorisiert für Opus Planning + Sonnet Implementation

**Stand**: 2026-04-19  
**Ziel**: Sortierten Plan für Opus (Architektur) → Sonnet (Implementierung)

---

## 🔴 KRITISCH – UI/UX Fundamentale

### 1. **Dark Theme Optimierung (All Pages)**
- **Komponenten**: Alle Pages, besonders Turnier-Creation, Matches, LEG
- **Issue**: Kontrast-Probleme, fehlende Dark-Palette
- **Lösung**: Global color-scheme Review + Dark-Variantenprüfung
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium (systematisch pro Page durchgehen)

### 2. **Englische UI-Texte ersetzen (Deutsch)**
- **Komponenten**: 
  - Turnier-Erstellung → Form-Labels
  - Turnier-Tabs (Group, Quarter, Semi, Final, Tiebreak, Bracket)
  - "Generate Bracket" Button
  - "Continue to Bracket" (Tiebreak Ende)
  - Match/Finals UI Labels
- **Lösung**: String-Übersetzung (i18n oder direkt)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low (Search-Replace + Context-Prüfung)

### 3. **Dashboard Navigation Icons austauschen**
- **Current**: Liga/Turniere Icons (welche genau?)
- **Change**: Icons tauschen (Liga/Turniere jeweils andere Icons)
- **Aufwand**: Minimal
- **Status**: Design-Entscheidung nötig (welche Icons?)

---

## 🟡 HOCH – Spieler-Darstellung (Konsistent)

### 4. **Nickname im Vordergrund (überall)**
- **Rule**: Nickname (Headerfont) wenn vorhanden, sonst Name
- **Betroffen**: 
  - Spielerliste (Tab: `/players`)
  - Match/LEG Screen
  - Finals/Quarter/Semi Ansicht
  - Tiebreak Rad
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium (6+ Komponenten prüfen)

### 5. **Avatar + Nickname in Finals/Match-Cards**
- **Betroffen**: Finals Übersicht, Match-Details
- **Design**: Avatar (20px links), Nickname (Header), Stats (W/L/Points)
- **Abhängig von**: #4
- **Sonnet-Aufwand**: Low

### 6. **Liga Theme-Farbe + Markierung**
- **Feature**: Liga-Admin kann Theme-Farbe setzen
- **Display**: Turnier-Karten in Liga mit Theme-Farbe markiert/gefärbt
- **DB**: Liga um `themeColor` Feld erweitern
- **Abhängig von**: Keine (unabhängig)
- **Sonnet-Aufwand**: Medium (DB + UI + Sidebar)

---

## 🟠 MITTEL – Match/Game Flow

### 7. **"Freies Spiel" Design für normale Matches**
- **Current**: Matches haben eigenes Design
- **Change**: Übernimmt "Freies Spiel" Layout (einfacher, sauberer)
- **Abhängig von**: #4 (Nickname)
- **Sonnet-Aufwand**: Medium

### 8. **Finals nicht in Match-Liste (separate Übersicht)**
- **Current**: Finals in `/tournament/[id]/matches`
- **Change**: Finals nur in `/tournament/[id]/finals` oder eigener Tab
- **Design**: Schöne Finals-Übersicht (Bracket-Style)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium (neue Komponente/Tab)

### 9. **Match-Liste: Karten + List View Toggle**
- **Current**: Nur eine Ansicht
- **Change**: Like Spieler-Seite: Karten-View + Listen-View wählbar
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low-Medium

### 10. **Generate Bracket deaktiviert darstellen (nicht Fehler)**
- **Current**: Grauer Button oder Fehler wenn nicht bereit
- **Change**: Visuell deaktiviert (disabled-State) bis alle Spiele vorbei und Plätze fest
- **Logic**: Check: `all games completed && all placements assigned`
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

---

## 🟠 MITTEL – LEG/Match-Play Screen

### 11. **Bildschirmhöhe optimiert (Responsive)**
- **Issue**: Nicht vollständig auf verfügbare Höhe optimiert (Nickname/Music/Stats)
- **Change**: Dynamisches Layout abhängig von Content
- **Abhängig von**: #4 (Nickname)
- **Sonnet-Aufwand**: Medium (CSS Flexbox tuning)

### 12. **Achievements in LEG anzeigen**
- **Feature**: Liga-Achievements des Spielers im LEG sichtbar
- **Design**: Kleine Trophy-Icons oder Badges im Header/Stats-Bereich
- **Abhängig von**: Phase 6/7 Achievement-System
- **Sonnet-Aufwand**: Low-Medium

---

## 🔵 SPIELER-REIHENFOLGE – Ausbullen Redesign (KOMPLEX)

### 13. **Ausbullen: Bull's Eye Nähe berechnen**
- **Current**: Einzelne Dartscheiben-Felder anklicken (verwirrend)
- **Change**: Jeder Spieler tippt auf Dartscheibe → Berechnung der Entfernung zur Mitte
- **Logic**: 
  - Spieler 1 tippt (X,Y auf Scheibe)
  - Spieler 2 tippt (X,Y auf Scheibe)
  - Distanz zur Mitte (Bull's Eye) berechnen
  - Wer näher dran = startet
- **UI**: Großer Dartscheibe-Canvas mit Click-Feedback
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: High (Canvas Math + UX)

### 14. **Reihenfolge-Dialog: "Ausbullen" vs "Münzwurf"**
- **Feature**: Vor jedem Match: Veranstalter wählt Methode
- **Option 1**: Ausbullen (siehe #13)
- **Option 2**: Münzwurf (Random oder Manual Select)
- **Fallback**: Manuell Spieler auswählen (falls nicht per App)
- **Abhängig von**: #13
- **Sonnet-Aufwand**: Low-Medium

### 15. **Starter-Farbe = Primary Color (nicht hart Blau)**
- **Change**: LEG-Screen: Spieler der startet = Primary Color Highlight
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

---

## 🔵 TIEBREAK – Redesign & Fixes

### 16. **Zielzahl erst beim Werfen anzeigen**
- **Current**: Zielzahl oben rechts sichtbar vor Rad-Drehung
- **Change**: Erst nach "Werfen"-Button sichtbar
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 17. **Auto-Stopp nach 3 Runden mit Gewinner**
- **Issue**: Unnötige weitere Runden speichern wenn Sieger fest
- **Change**: Nach jeder Runde: `if (winner found) → finish tiebreak` (kein "Next Round" speichern)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 18. **Rad-Pfeil Richtung: nach unten statt oben**
- **Change**: `rotate(-180deg)` statt aktuell
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Trivial

### 19. **Tiebreak Layout: Hintereinander vs Untereinander**
- **Logic**: 
  - Nur 1 Dartscheibe → mehrere TB hintereinander (horizontal scroll)
  - Mehrere Dartscheiben → untereinander (Grid)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 20. **Button-Farben: "Continue to Bracket" + "Tiebreak Abschließen"**
- **Issue**: Abgedunkelte Farbe wirkt deaktiviert obwohl aktiv
- **Change**: Normale Button-Farbe, nicht disabled-Style
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 21. **"Continue to Bracket" → Deutsche Sprache anpassen**
- **Change**: Label je nach Kontext (z.B. "Zu Viertelfinal" / "Zu Gruppenphasenergebnisse")
- **Abhängig von**: #2
- **Sonnet-Aufwand**: Low

---

## 🟠 TURNIER-ERSTELLUNG – Design Overhaul

### 22. **Turnier-Erstellung: Veraltetes Design modernisieren**
- **Current**: Old form layout
- **Change**: Modernes Design (wie Liga-Erstellung oder Spieler-Seite)
- **Sections**: 
  - Basic (Name, Type)
  - Format (Group Format: 301/501, Group Bo: 1/3/5)
  - QF/Semi/Finals (je Format + Bo wählbar)
  - Checkout Rules
- **Abhängig von**: #23 (Format-Einstellung)
- **Sonnet-Aufwand**: Medium

### 23. **Flexibles Format pro Phase (kritisch)**
- **Feature**: Nicht hartcodiert, sondern pro Phase (Group/QF/Semi/Final) konfigurierbar
- **Einstellung**: 
  - Score-Type (301/501/701)
  - Best-of (1/3/5/7)
- **Current Default** (Entwurf): 
  - Group: 301 Bo1
  - QF: 301 Bo3
  - Semi/Final: 501 Bo3
  - (aber Admin sollte ändern können)
- **DB**: Tournament → `phaseFormats: {group: {...}, quarter: {...}, semi: {...}, final: {...}}`
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium (DB-Schema + UI)

### 24. **QF vor Start: Format + Bo Dialog**
- **Trigger**: Vor erstem QF-Match (wenn nicht schon in #23 gesetzt)
- **Change**: Format (301/501/701) + Bo (3/5/7) wählbar
- **Abhängig von**: #23
- **Sonnet-Aufwand**: Low

---

## 🟢 BRACKET/FINALS – Visualisierung & Flow

### 25. **Sieger-Verbindungen mit Linien**
- **Feature**: QF Sieger → SF Sieger → Final mit Linien/Pfeilen verbunden
- **Style**: Sieger-Farbe (Primary oder Avatar-Farbe)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium (SVG/Canvas Linien)

### 26. **"Next Round" Button → Anpassungs-Icon**
- **Change**: Statt "Next Round" ein Settings/Edit Icon
- **Behavior**: 
  - Semi-Finals: Icon zum Format anpassen (wenn gewünscht)
  - Auto-Fortschritt wenn Semi fertig (kein Button nötig)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 27. **QF/SF/Final Ansicht nach Completion**
- **Flow**: Nach QF fertig → Automatisch zu SF Übersicht
- **Nach SF fertig** → Automatisch zu Final
- **Kein Extra "Next Round"** Button (nur Icon für Format-Anpassung)
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Low

### 28. **Finals: Schöne Results-Aufbereitung**
- **Current**: Einfache Text-Ausgabe
- **Change**: Card/Dashboard mit:
  - 1./2./3. Platz (Bilder/Avatars)
  - Matched gespielt/gewonnen
  - Besondere Achievements
- **Abhängig von**: Keine
- **Sonnet-Aufwand**: Medium

---

## 🔴 ARCHITEKTUR – Punkte/Liga Separation (KRITISCH)

### 29. **Punkte-Vergabe: Von Turnier zu Liga verschieben**
- **Current**: Turnier speichert Punkte (verknüpft mit Liga-Format)
- **Issue**: "Stayed until final" Regel ist Liga-spezifisch, nicht Turnier-spezifisch
- **Change**: 
  - Turnier speichert nur: Teilnahme + Platzierung (1./2./3./etc.)
  - Liga definiert Punkte-Regel
  - UI für Liga-Admin: Punkte-Tabelle (1.→7pts, 2.→6pts, etc.) konfigurierbar
- **Schema**:
  - `Tournament.results: {playerId → {placement, participated}}`
  - `League.scoringRules: {1: 7, 2: 6, 3: 4, 4: 3, 5+: 1}`
- **Abhängig von**: Keine (aber Breaking Change!)
- **Sonnet-Aufwand**: High (Datenmodell-Refactor)

### 30. **Turnier-Results Display: Unabhängig von Liga**
- **Feature**: Results zeigen:
  - Wer teilgenommen hat (Checkmark)
  - 1./2./3. Platz (Medaillen)
  - Matches gespielt
  - NICHT Liga-Punkte
- **Abhängig von**: #29
- **Sonnet-Aufwand**: Medium

### 31. **Multiple Ligen mit unterschiedlichen Regeln**
- **Feature**: Selbes Turnier kann in mehreren Ligen mit unterschiedlicher Punkte-Regel laufen
- **Logic**: Turnier → Results; jede Liga → eigene Scoring-Rules → eigene Punkte
- **Abhängig von**: #29
- **Sonnet-Aufwand**: Low (nur Liga-Reading + Calculation)

---

## 📊 Prioritäts-Matrix (für Opus Plan)

| Prio | Typ | Items | Aufwand |
|------|-----|-------|---------|
| 🔴 KRITISCH | Arch | #29 (Punkte-Separation) | **High** |
| 🔴 KRITISCH | UX | #2 (Englisch), #1 (Dark) | Medium |
| 🟡 HOCH | UX | #4 (Nickname), #23 (Formate) | Medium |
| 🟡 HOCH | Feature | #13 (Ausbullen) | **High** |
| 🟠 MITTEL | Design | #22 (Form Redesign), #28 (Results) | Medium |
| 🟠 MITTEL | UX | #11 (Responsive), #16-21 (Tiebreak) | Low-Medium |
| 🟢 NICE | UX | #3 (Icons), #6 (Theme-Farbe) | Low |
| 🟢 NICE | Feature | #25 (Linien), #12 (Achievements) | Medium |

---

## Dependency Graph für Sonnet

```
#29 (Punkte-Separation)
  └→ #30 (Results Display)
     └→ #31 (Multiple Ligen)

#23 (Flexibles Format)
  └→ #24 (QF Dialog)
  └→ #22 (Form Redesign)

#13 (Ausbullen)
  └→ #14 (Münzwurf Option)
  └→ #15 (Starter-Farbe)

#4 (Nickname)
  └→ #5 (Avatar Cards)
  └→ #11 (LEG Responsive)
  └→ #7 (Freies Spiel Design)

#2 (Englisch → Deutsch)
  └→ #21 (Button-Labels)

#1 (Dark Theme)
  └→ All Pages
```

---

## Opus-Task: Plan erstellen
**Input**: Diese Liste + bisherige Code
**Output**: 
- Sequenzialisierte Implementierungs-Reihenfolge
- Pro Item: Betroffene Dateien + Änderungen
- Blocking Dependencies aufgelöst
- Geschätzter Gesamtaufwand (in Sonnet-Stunden)

## Sonnet-Task: Implementieren
**Input**: Opus-Plan + Diese Spec
**Output**: Code-Commits pro Item
**Method**: Per Item committen, Tests im Browser
