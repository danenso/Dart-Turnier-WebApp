# Dart Turnier WebApp – Code Cache & Navigation

**Generated**: 2026-04-18 | **Total Lines**: 14,790 TS/TSX | **Phases**: 2–7 Complete

---

## 1. Quick Navigation

### Core Systems
| System | Files | Purpose |
|--------|-------|---------|
| **Achievement Engine** | `lib/achievementEngine.ts` | 11 League Achievements (grant logic, definitions) |
| **Player Stats** | `lib/playerStats.ts` | Match analysis, statistics, earned achievements |
| **Match Rules** | `lib/match-rules.ts` | Scoring, leg logic, phase management |
| **Checkout** | `lib/checkout.ts`, `lib/checkout-rules.ts` | Checkout validation, rule engine |
| **Firebase Config** | `lib/firebase.ts` | Client SDK initialization |
| **Avatar/Song Upload** | `lib/avatar-upload.ts`, `lib/song-upload.ts` | Storage bucket handling |

### Pages (Routes)
| Route | File | Feature |
|-------|------|---------|
| `/tournaments` | `app/tournaments/page.tsx` | Create tournaments (regular/grand final) |
| `/tournament/[id]` | `app/tournament/[id]/page.tsx` | Bracket generation, match management, retroactive entry |
| `/standings` | `app/standings/page.tsx` | Season rankings, qualifier badges, achievement grant |
| `/players` | `app/players/page.tsx` | Player list, search, filters |
| `/players/[id]` | `app/players/[id]/page.tsx` | Player profile, stats, trophy showcase |
| `/seasons` | `app/seasons/page.tsx` | Season creation, management |
| `/casual` | `app/casual/page.tsx` | Casual matches (no tournament) |
| `/liga` | `app/liga/page.tsx` | Liga/League management |

### Components
| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| **TrophyShowcase** | `components/player/TrophyShowcase.tsx` | 91 | Display earned league achievements |
| **PlayerAchievements** | `components/player/PlayerAchievements.tsx` | ~150 | Tab UI (game/league achievements) |
| **MatchStartSelector** | `components/MatchStartSelector.tsx` | 260+ | Format picker, start score selection |
| **CheckoutBuilder** | `components/CheckoutBuilder.tsx` | 260+ | Checkout mode builder |
| **TiebreakManager** | `components/TiebreakManager.tsx` | ~200 | Tiebreak phase handler |
| **SpinWheel** | `components/SpinWheel.tsx` | ~150 | Target number selection |
| **FirebaseProvider** | `components/FirebaseProvider.tsx` | ~100 | Auth context + user state |

---

## 2. Data Model Overview

### Firestore Collections

```
tournaments/{tournamentId}
  ├─ title, status, ownerId, createdAt
  ├─ isFinalTournament, grandFinalConfig? {qualifierCount, quarterFormat, semiFormat, finalFormat}
  ├─ entryMode? 'matches-only' | 'placements-only'
  ├─ players/{playerId} {name, points, rank, placement}
  ├─ matches/{matchId} {phase, playerAId, playerBId, format, winnerId, status}
  └─ tiebreaks/{tiebreakId} {targetNumber, playerIds, playerNames, status}

players/{playerId}
  ├─ name, nickname, email, avatar, ownerId
  ├─ wins, losses, draws, matchesPlayed, points
  ├─ earnedAchievements[] {id, earnedAt, context}
  └─ authUid? (linked to Auth user)

seasons/{seasonId}
  ├─ name, number, status, ownerId
  └─ createdAt

users/{userId}
  └─ role ('user' | 'admin')
```

### Achievement Types (11 Total)
```
matchday-winner          // Won single matchday (stackable)
perfect-group            // Won all group matches (stackable)
matchday-hat-trick       // 3 consecutive matchday wins (non-stackable)
iron-man                 // Participated all matchdays in season (non-stackable)
season-table-1st/2nd/3rd // Season placings (stackable)
grand-final-qualified    // Top-8 qualifier (stackable)
grand-final-champion     // Grand Final winner (stackable)
grand-final-finalist     // Grand Final 2nd (stackable)
grand-final-3rd          // Grand Final semi-loser (stackable)
```

---

## 3. Key Functions & Algorithms

### Match Scoring
```typescript
// Scoring logic: lib/match-rules.ts
- Phase: 'group' | 'quarter' | 'semi' | 'final'
- Format: '301_bo1/bo3/bo5' | '501_bo1/bo3/bo5'
- Leg win = phase-dependent points
  • Group/Quarter: normal points
  • Semi: increased points
  • Final: multiplied points
```

### Achievement Grant Flow
```typescript
// lib/achievementEngine.ts
grantAchievement(playerId, id, context)
├─ Check definition exists
├─ Fetch player doc
├─ If non-stackable, check not already earned
└─ arrayUnion to earnedAchievements

grantTournamentAchievements(tournament, players, matches)
├─ Grant 'matchday-winner' to first place
├─ Check Hat-Trick: 3 consecutive tournament numbers in season
└─ Grant 'perfect-group' if won all group matches

grantSeasonAchievements(standings)
├─ Grant season-table medals (1st/2nd/3rd)
├─ Grant 'grand-final-qualified' to top-N
└─ Check Iron Man: participated in all regular tournaments
```

### Bracket Generation
```typescript
// app/tournament/[id]/page.tsx generateBracket()
- Reads tournament.grandFinalConfig for format strings
- Phase 'quarter' → quarterFormat, 'semi' → semiFormat, 'final' → finalFormat
- Derives startScore from format prefix (301=301, 501=501)
- Creates matches with playerARest/playerBRest = startScore
```

### Retroactive Entry Modes
```typescript
// app/tournament/[id]/page.tsx

Mode 1: Matches-only (default)
- Save each match with scores, legs, winnerId
- calculateStats from match results
- Call grantTournamentAchievements with computed standings

Mode 2: Placements-only (for old seasons)
- Dropdown select 1st-4th placement
- Define extra participants (5th onwards)
- Points: 1st→7, 2nd→6, 3rd→4, 4th→3, others→1
- Set entryMode: 'placements-only' in tournament doc
- Call grantTournamentAchievements with constructed standings
```

---

## 4. Critical File Locations (By Purpose)

### League/Season Features
- **Creation**: `app/tournaments/page.tsx` (line 1–100: form + state)
- **Management**: `app/tournament/[id]/page.tsx` (line 1–450: full lifecycle)
- **Standings**: `app/standings/page.tsx` (line 1–200: season rank + qualifiers)
- **Season Finish**: `app/standings/page.tsx` (line ~150: achievementGrant button)

### Achievement System
- **Engine**: `lib/achievementEngine.ts` (345 lines, all grant + detection logic)
- **Display**: `components/player/TrophyShowcase.tsx` (91 lines, trophy grid)
- **Profile Tab**: `components/player/PlayerAchievements.tsx` (~150 lines, achievement list)
- **Player Profile**: `app/players/[id]/page.tsx` (line 145–147: TrophyShowcase integration)

### Match Management
- **Bracket Gen**: `app/tournament/[id]/page.tsx` (line 369–392: QF/SF, line 465–490: bracket building)
- **Match Play**: `app/tournament/[id]/match/[matchId]/page.tsx` (full match UI)
- **Match Rules**: `lib/match-rules.ts` (scoring, legs, phase logic)

### Retroactive Features
- **Retro UI**: `app/tournament/[id]/page.tsx` (line ~640–750: mode toggle + placement dropdowns)
- **Retro Save (Matches)**: `app/tournament/[id]/page.tsx` (line ~500–600: saveMatches function)
- **Retro Save (Placements)**: `app/tournament/[id]/page.tsx` (line ~600–680: saveRetroPlacements function)

---

## 5. Firestore Rules Summary

```firestore
// Helper: isSuperAdmin() → checks email or hardcoded UID
// Helper: isAdmin() → superadmin OR user.role == 'admin'

tournaments/{tournamentId}
├─ read: owner OR admin OR participant
├─ create: authenticated + valid
├─ update: owner OR admin + valid
└─ delete: owner OR admin

tournaments/{tournamentId}/players/{playerId}
├─ read: tournament owner OR admin
└─ write: tournament owner OR admin + valid

tournaments/{tournamentId}/matches/{matchId}
├─ read: owner OR admin OR tournament participant
└─ write: owner OR admin OR participant + valid

tournaments/{tournamentId}/tiebreaks/{tiebreakId}
├─ read/write: tournament owner OR admin

players/{playerId}
├─ read: authenticated
├─ create: authenticated + valid global player
├─ update: owner OR admin + ownerId unchanged
└─ earnedAchievements: validated as list

validation: isValidTournament() checks grandFinalConfig as map
validation: isValidGlobalPlayer() checks earnedAchievements as list
validation: isValidPlayer() checks placement as number
```

---

## 6. Configuration & Constants

### Match Formats
- **Group/QF/SF**: `301_bo1`, `301_bo3`, `501_bo1`, `501_bo3`
- **Final**: `501_bo3`, `501_bo5` (Grand Final typically `501_bo5`)
- **Points Multiplier**: Phase-dependent (group 1x, semi 1.5x, final 2x)

### Grand Final Defaults
- **Qualifier Count**: 8 (configurable per tournament)
- **QF Format**: `501_bo3`
- **SF Format**: `501_bo3`
- **Final Format**: `501_bo5`

### Retroactive Points (Placements-only)
- **1st Place**: 7 points
- **2nd Place**: 6 points
- **3rd Place**: 4 points
- **4th Place**: 3 points
- **5th+ Place**: 1 point each

---

## 7. Environment & Setup

### Firebase
- **Project**: Firestore + Storage + Auth
- **Rules**: `firestore.rules` (deployed)
- **Storage**: `/avatars/*`, `/songs/*`, `/logos/*`

### Dependencies
- **Next.js 14+** (App Router)
- **Firebase SDK** (firestore, storage, auth)
- **Tailwind CSS** (styling)
- **shadcn/ui** (components)
- **Iconify** (icons)
- **Zustand** (state, if used)

### Build
- **TypeScript**: `npx tsc --noEmit` (0 errors)
- **Linting**: ESLint configured
- **Deployment**: Firebase deploy (rules + hosting)

---

## 8. Common Patterns

### Fetch Player Profile
```typescript
getDocs(query(collection(db, 'players'), where('authUid', '==', user.uid)))
```

### Fetch Tournament with Bracket
```typescript
const tourDoc = await getDoc(doc(db, 'tournaments', tournamentId));
const matches = await getDocs(collection(db, `tournaments/${tournamentId}/matches`));
```

### Grant Achievement
```typescript
import { grantAchievement } from '@/lib/achievementEngine';
await grantAchievement(playerId, 'matchday-winner', {
  tournamentId, seasonId, placement: 1
});
```

### Calculate Player Stats
```typescript
import { fetchPlayerMatches, calculateStats } from '@/lib/playerStats';
const matches = await fetchPlayerMatches(playerId);
const stats = calculateStats(matches);
```

---

## 9. Error Handling

- **Firestore Errors**: `lib/firestore-errors.ts` (OperationType enum, handleFirestoreError)
- **Achievement Errors**: Silent try/catch (non-blocking)
- **Auth Errors**: Redirect to login, show message

---

## 10. Testing Checklist

**Phase 6 (Achievements)**
- [ ] Tournament completion grants 'matchday-winner'
- [ ] Perfect group detected correctly
- [ ] Hat-Trick triggers on 3 consecutive wins
- [ ] Iron Man triggers on 100% attendance
- [ ] Non-stackables prevent duplicates

**Phase 7 (Placements + Trophy)**
- [ ] Retroactive placements mode creates matches
- [ ] Trophy showcase displays all tier groups
- [ ] Qualifier badge shows on standings (top-N)
- [ ] Grand Final uses correct format strings

**Phase 5 (Grand Final)**
- [ ] Grand Final qualifier count respected
- [ ] Bracket generates with phase-specific formats
- [ ] Season standings exclude final tournament points
- [ ] Achievement grant for grand final results

---

## 11. Deployment Checklist

```bash
# Before deploy
npm run build          # 0 errors
npm run lint          # 0 errors
firebase deploy --only firestore:rules  # Validate rules syntax

# After deploy
- Test tournament creation
- Test match saving
- Test achievement appearance
- Test standings display
```

---

**Last Updated**: Phase 7 Complete (2026-04-18)  
**Status**: Production Ready ✅
