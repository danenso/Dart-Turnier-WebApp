# Architecture Overview

## System Layers

```
┌─────────────────────────────────────────┐
│   UI Layer (Next.js App Router)         │
│  ├─ Pages: tournaments, players, ...    │
│  └─ Components: Match, Bracket, Stats   │
├─────────────────────────────────────────┤
│   Business Logic (lib/)                 │
│  ├─ achievementEngine.ts (awards)       │
│  ├─ playerStats.ts (computation)        │
│  ├─ match-rules.ts (scoring)            │
│  └─ checkout.ts (validation)            │
├─────────────────────────────────────────┤
│   Database Layer (Firestore)            │
│  ├─ tournaments, players, seasons       │
│  ├─ matches, tiebreaks, standings       │
│  └─ Schema + Rules (firestore.rules)    │
├─────────────────────────────────────────┤
│   Authentication (Firebase Auth)        │
│  └─ FirebaseProvider context            │
└─────────────────────────────────────────┘
```

## Data Flow

### Tournament Completion → Achievement Grant
```
User finishes tournament
    ↓
app/tournament/[id]/page.tsx saveMatches()
    ↓
Update tournament.status = 'completed'
    ↓
Calculate final standings (sorted by points)
    ↓
lib/achievementEngine.grantTournamentAchievements()
    ├─ Grant 'matchday-winner' to 1st place
    ├─ Check Hat-Trick (consecutive 3 wins)
    └─ Grant 'perfect-group' (all group wins)
    ↓
players/{playerId} earnedAchievements += arrayUnion
```

### Season Completion → Medal + Qualifier Grant
```
Admin clicks "Saison-Achievements vergeben"
    ↓
app/standings/page.tsx grantSeasonAchievements()
    ├─ Grant season-table-1st/2nd/3rd
    ├─ Grant grand-final-qualified (top-N)
    └─ Check Iron Man (all regular tournaments)
    ↓
players/{playerId} earnedAchievements += arrayUnion
```

### Grand Final → Championship Grant
```
Grand Final tournament completes (isFinalTournament: true)
    ↓
app/tournament/[id]/page.tsx grantGrandFinalAchievements()
    ├─ Grant 'grand-final-champion' to final winner
    ├─ Grant 'grand-final-finalist' to 2nd
    └─ Grant 'grand-final-3rd' to semi-losers
    ↓
players/{playerId} earnedAchievements += arrayUnion
```

## Component Hierarchy

```
<AppLayout>
  ├─ <FirebaseProvider>
  ├─ <ThemeProvider>
  ├─ <AudioProvider>
  └─ Page Component
      ├─ <RecentGames> (player profile)
      ├─ <TrophyShowcase> (earned achievements)
      ├─ <PlayerAchievements> (stats + league achievements)
      └─ Stats sections (WinStats, ThrowStats, etc.)

Tournament Page
  ├─ Bracket display
  ├─ <MatchStartSelector> (format picker)
  ├─ <TiebreakManager> (tiebreak UI)
  └─ Retroactive entry UI
      ├─ Mode toggle (Matches / Placements)
      ├─ Placement dropdowns
      └─ Participant list
```

## State Management

### Player Context (FirebaseProvider)
- `user`: Firebase Auth user
- `isAdmin`: Computed from user.role
- `isAuthReady`: Auth initialization complete

### Page-Level State (Hooks)
- Tournament: matches, players, status, bracket
- Standings: standings array, qualifierCount
- Player Profile: playerProfile, matches, filter

### Retroactive Mode State
- `retroMode`: 'matches' | 'placements'
- `retroPlacements`: Record<'1'|'2'|'3'|'4', playerId>
- `retroParticipants`: string[] (5th+ places)

## Firestore Collections Map

```
├─ players/{playerId}
│  ├─ name, nickname, email
│  ├─ earnedAchievements[] ← ACHIEVEMENT STORAGE
│  ├─ authUid (link to Auth.uid)
│  └─ ownerId (who created this player)
│
├─ tournaments/{tournamentId}
│  ├─ title, status, ownerId, createdAt
│  ├─ isFinalTournament, grandFinalConfig
│  ├─ entryMode ('matches-only' | 'placements-only')
│  ├─ players/{playerId}
│  │  ├─ name, points, rank, placement
│  │  └─ matchesPlayed, wins, losses, draws
│  ├─ matches/{matchId}
│  │  ├─ playerAId, playerBId, winnerId
│  │  ├─ phase ('group'|'quarter'|'semi'|'final')
│  │  ├─ format ('301_bo3' etc)
│  │  └─ status ('completed'|'in_progress'|'pending')
│  └─ tiebreaks/{tiebreakId}
│     ├─ targetNumber, playerIds, playerNames
│     ├─ status, currentRound
│     └─ winnerId
│
├─ seasons/{seasonId}
│  ├─ name, number, status
│  ├─ ownerId, createdAt
│  └─ (references to tournaments via seasonId field)
│
├─ users/{userId}
│  └─ role ('user'|'admin')
│
└─ templates/{templateId}
   ├─ name, format, createdBy
   └─ (template config)
```

## Achievement Storage & Retrieval

### Storage (Write)
```typescript
// In players/{playerId} document
earnedAchievements: [
  {
    id: 'matchday-winner',
    earnedAt: '2026-04-18T14:30:00Z',
    context: {
      tournamentId: 'abc123',
      seasonId: 'season-1',
      tournamentNumber: 3,
      placement: 1
    }
  },
  // ... more
]
```

### Retrieval (Read)
```typescript
// In player profile page
const leagueAchievements: EarnedAchievement[] = playerProfile?.earnedAchievements ?? [];

// In stats calculation (optional)
import { getAchievements } from '@/lib/playerStats';
const computedAchievements = getAchievements(stats, matches);
```

### Display (UI)
```typescript
// TrophyShowcase.tsx
const sorted = achievements
  .map(a => ({earned: a, def: LEAGUE_ACHIEVEMENTS.find(...)}))
  .sort(by tier, then by date)
  .map(({earned, def}) => <TrophyItem .../>)
```

## Key Algorithms

### Hat-Trick Detection
```
For season S, tournament number N:
1. Fetch player.earnedAchievements
2. Filter by id='matchday-winner' && context.seasonId=S
3. Extract tournament numbers → [1, 3, 5, 8]
4. Add current N if not present
5. Check if includes [N-2, N-1, N]
6. If yes → grant 'matchday-hat-trick'
```

### Iron Man Detection
```
For season S:
1. Fetch all tournaments where seasonId=S && status='completed' && !isFinalTournament
2. For each regular tournament T:
   - Fetch players subcollection
   - Add playerId to participationMap[playerId].add(T.id)
3. For each player in participationMap:
   - If participationMap[player].size == total_regular_tournaments
   - Grant 'iron-man'
```

### Retroactive Points Calculation
```
Placements mode:
  1st → 7 points
  2nd → 6 points
  3rd → 4 points
  4th → 3 points
  5th+ → 1 point each

Then:
  - Update tournament.players[playerId].points = calculated
  - Set tournament.entryMode = 'placements-only'
  - Call grantTournamentAchievements(tournament, sortedPlayers)
```

### Bracket Generation (Grand Final)
```
Tournament config has grandFinalConfig:
  - qualifierCount: 8
  - quarterFormat: '501_bo3'
  - semiFormat: '501_bo3'
  - finalFormat: '501_bo5'

For each phase:
  phase='quarter' → use quarterFormat
  phase='semi'    → use semiFormat
  phase='final'   → use finalFormat

Derive startScore from format:
  '301_*' → startScore = 301
  '501_*' → startScore = 501

Create matches:
  playerARest = startScore
  playerBRest = startScore
```

## Error Handling Strategy

- **Firestore Validation**: Rules enforce schema at write time
- **Achievement Non-Blocking**: Try-catch with silent fail (achievements never block tournament)
- **Auth Errors**: Redirect via router.push('/'); show toast
- **Data Consistency**: arrayUnion for atomic appends, transactions for critical ops

## Performance Considerations

- **Caching**: Player profile cache via useState
- **Batch Queries**: Fetch all matches at once, not per-match
- **Subcollection Reads**: Query matches/tiebreaks as needed
- **Participation Map**: Build once per season, not per player

## Extensibility Points

1. **New Achievement Types**: Add to LEAGUE_ACHIEVEMENTS array + grantXxx function
2. **New Phases**: Add to match.phase enum + calculateStats logic
3. **New Retroactive Modes**: Add mode state + saveRetro function variant
4. **New Stats Sections**: Create new component in `/components/player/` + import in profile

---

**Version**: Phase 7 Complete | **Last Update**: 2026-04-18
