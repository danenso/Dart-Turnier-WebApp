# Code Snippets & Quick Reference

**Use this file for copy-paste patterns and common operations**

---

## Achievement Operations

### Import Achievement Engine
```typescript
import { 
  grantAchievement,
  grantTournamentAchievements, 
  grantGrandFinalAchievements,
  grantSeasonAchievements,
  LEAGUE_ACHIEVEMENTS,
  type EarnedAchievement,
  type LeagueAchievementDef 
} from '@/lib/achievementEngine';
```

### Grant Single Achievement
```typescript
await grantAchievement(playerId, 'matchday-winner', {
  tournamentId: 'abc123',
  seasonId: 'season-1',
  placement: 1,
  tournamentNumber: 5,
});
```

### Grant Tournament Achievements
```typescript
try {
  await grantTournamentAchievements(
    tournamentId,
    tournament,
    players, // sorted by points desc
    matches
  );
} catch (err) {
  console.error('Achievement grant failed (non-blocking):', err);
}
```

### Grant Grand Final Achievements
```typescript
try {
  await grantGrandFinalAchievements(
    tournamentId,
    tournament,
    matches
  );
} catch (err) {
  console.error('Grand Final achievements failed:', err);
}
```

### Grant Season Achievements
```typescript
await grantSeasonAchievements(
  seasonId,
  seasonName,
  standings, // sorted by totalPoints desc
  8 // qualifierCount
);
```

---

## Player Stats & Achievements

### Fetch Player Matches
```typescript
import { fetchPlayerMatches, calculateStats } from '@/lib/playerStats';

const matches = await fetchPlayerMatches(playerId);
const stats = calculateStats(matches);
```

### Get Achievement Definitions
```typescript
import { LEAGUE_ACHIEVEMENTS } from '@/lib/achievementEngine';

const def = LEAGUE_ACHIEVEMENTS.find(a => a.id === 'matchday-winner');
console.log(def.name); // "Tagessieg"
console.log(def.tier); // "gold"
```

### Filter Achievements by Tier
```typescript
const goldAchievements = LEAGUE_ACHIEVEMENTS.filter(a => a.tier === 'gold');
const stackable = LEAGUE_ACHIEVEMENTS.filter(a => a.stackable);
```

---

## Firestore Queries

### Get Player Profile
```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const playerRef = doc(db, 'players', playerId);
const playerSnap = await getDoc(playerRef);
const player = playerSnap.data();

const earnedAchievements = player?.earnedAchievements ?? [];
```

### Query Players by Auth UID
```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';

const q = query(
  collection(db, 'players'),
  where('authUid', '==', user.uid)
);
const snap = await getDocs(q);
const players = snap.docs.map(d => ({ id: d.id, ...d.data() }));
```

### Get Tournament with All Matches
```typescript
const tourRef = doc(db, 'tournaments', tournamentId);
const tourSnap = await getDoc(tourRef);
const tournament = tourSnap.data();

const matchesSnap = await getDocs(
  collection(db, `tournaments/${tournamentId}/matches`)
);
const matches = matchesSnap.docs.map(d => d.data());
```

### Update Player Achievement Array
```typescript
import { updateDoc, arrayUnion } from 'firebase/firestore';

await updateDoc(playerRef, {
  earnedAchievements: arrayUnion({
    id: 'matchday-winner',
    earnedAt: new Date().toISOString(),
    context: { tournamentId, seasonId, placement: 1 },
  }),
});
```

### Fetch All Tournaments by Season
```typescript
const q = query(
  collection(db, 'tournaments'),
  where('seasonId', '==', seasonId)
);
const tournsSnap = await getDocs(q);
const tournaments = tournsSnap.docs.map(d => d.data());
```

---

## UI Components

### Import Player Components
```typescript
import { TrophyShowcase } from '@/components/player/TrophyShowcase';
import { PlayerAchievements } from '@/components/player/PlayerAchievements';
import { RecentGames } from '@/components/player/RecentGames';
import { WinStatsSection } from '@/components/player/WinStatsSection';
```

### Display Trophy Showcase
```typescript
<TrophyShowcase achievements={leagueAchievements} />
```

### Display Player Achievements (with tabs)
```typescript
<PlayerAchievements 
  achievements={computedAchievements} 
  leagueAchievements={earnedAchievements} 
/>
```

### Achievement Item Rendering
```typescript
const def = LEAGUE_ACHIEVEMENTS.find(a => a.id === earned.id);
if (!def) return null;

return (
  <div title={`${def.name}: ${def.description}`}>
    <Icon icon={def.icon} className={`text-${def.tier}-500`} />
    <span>{def.name}</span>
  </div>
);
```

---

## Tournament Lifecycle

### Tournament Completion (Matches Mode)
```typescript
// Before:
const matches = []; // user created/played matches

// Call this function (in saveMatches):
await updateDoc(tournamentRef, { status: 'completed' });

// Grant achievements (non-blocking):
try {
  await grantTournamentAchievements(tournamentId, tournament, players, matches);
} catch (err) { /* silent fail */ }

// If Grand Final:
try {
  await grantGrandFinalAchievements(tournamentId, tournament, matches);
} catch (err) { /* silent fail */ }
```

### Tournament Completion (Placements Mode)
```typescript
// User selected placements:
const placements = { '1': playerId1, '2': playerId2, '3': playerId3, '4': playerId4 };

// 1. Delete old matches
const matchesSnap = await getDocs(collection(db, `tournaments/${tournamentId}/matches`));
for (const md of matchesSnap.docs) {
  await deleteDoc(md.ref);
}

// 2. Calculate standings from placements
const points = { '1': 7, '2': 6, '3': 4, '4': 3 };
const standings = [
  { id: placements['1'], points: 7, placement: 1 },
  { id: placements['2'], points: 6, placement: 2 },
  // ...
];

// 3. Update player docs
for (const s of standings) {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'players', s.id), {
    points: s.points,
    placement: s.placement,
  });
}

// 4. Mark tournament
await updateDoc(tournamentRef, {
  status: 'completed',
  entryMode: 'placements-only',
});

// 5. Grant achievements
await grantTournamentAchievements(tournamentId, tournament, standings, []);
```

### Season Completion (Achievement Grant)
```typescript
// Admin clicks button
const standings = []; // sorted by totalPoints desc

await grantSeasonAchievements(
  seasonId,
  seasonName,
  standings,
  8 // qualifierCount
);
```

---

## Retroactive Entry Modes

### Mode Toggle UI
```typescript
const [retroMode, setRetroMode] = useState<'matches' | 'placements'>('matches');

return (
  <div className="flex gap-2 mb-4">
    <button
      className={retroMode === 'matches' ? 'bg-primary' : 'bg-secondary'}
      onClick={() => setRetroMode('matches')}
    >
      Alle Ergebnisse
    </button>
    <button
      className={retroMode === 'placements' ? 'bg-primary' : 'bg-secondary'}
      onClick={() => setRetroMode('placements')}
    >
      Nur Platzierungen
    </button>
  </div>
);
```

### Placement Selection
```typescript
const [retroPlacements, setRetroPlacements] = useState<Record<string, string>>({});

const placements = ['1', '2', '3', '4'];
const pointsMap = { '1': 7, '2': 6, '3': 4, '4': 3 };

return placements.map(p => (
  <select
    key={p}
    value={retroPlacements[p] || ''}
    onChange={(e) => setRetroPlacements({...retroPlacements, [p]: e.target.value})}
  >
    <option value="">Platz {p} wählen ({pointsMap[p]} Punkte)</option>
    {players.map(player => (
      <option key={player.id} value={player.id}>
        {player.name}
      </option>
    ))}
  </select>
));
```

### Participant Toggle
```typescript
const [retroParticipants, setRetroParticipants] = useState<string[]>([]);

return players.map(player => (
  <button
    key={player.id}
    onClick={() => {
      setRetroParticipants(prev =>
        prev.includes(player.id)
          ? prev.filter(id => id !== player.id)
          : [...prev, player.id]
      );
    }}
    className={retroParticipants.includes(player.id) ? 'bg-primary' : 'bg-secondary'}
  >
    {player.name}
  </button>
));
```

---

## Grand Final Configuration

### Create Grand Final with Config
```typescript
const tournament = {
  title: 'Grand Final Season 1',
  isFinalTournament: true,
  grandFinalConfig: {
    qualifierCount: 8,
    quarterFormat: '501_bo3',
    semiFormat: '501_bo3',
    finalFormat: '501_bo5',
  },
  // ... other fields
};

await setDoc(doc(db, 'tournaments', tournamentId), tournament);
```

### Read Grand Final Config
```typescript
const gfc = tournament?.grandFinalConfig;
const qfFormat = gfc?.quarterFormat ?? tournament?.format ?? '501_bo3';
const sfFormat = gfc?.semiFormat ?? tournament?.format ?? '501_bo3';
const finalFormat = gfc?.finalFormat ?? tournament?.format ?? '501_bo5';
```

### Start Score from Format
```typescript
function startScoreFromFormat(format: string): number {
  return format.startsWith('301') ? 301 : 501;
}

// Usage:
const qfStartScore = startScoreFromFormat(qfFormat);
const sfStartScore = startScoreFromFormat(sfFormat);
const finalStartScore = startScoreFromFormat(finalFormat);
```

---

## Standing & Qualifier Display

### Build Standings with Qualifiers
```typescript
const qualifierCount = tournament.grandFinalConfig?.qualifierCount ?? 8;
const qualified = standings.slice(0, qualifierCount);
const waitlist = standings.slice(qualifierCount);

return (
  <>
    {qualified.map((entry, idx) => (
      <tr key={entry.playerId}>
        <td>{entry.playerId}</td>
        <td>{entry.totalPoints}</td>
        <td><Badge>Qualifiziert ✓</Badge></td>
      </tr>
    ))}
    {waitlist.length > 0 && (
      <tr><td colSpan="3">— Nachrücker-Zone —</td></tr>
    )}
    {waitlist.map((entry) => (
      <tr key={entry.playerId}>
        <td>{entry.playerId}</td>
        <td>{entry.totalPoints}</td>
      </tr>
    ))}
  </>
);
```

---

## Error Handling Patterns

### Non-Blocking Achievement Grant
```typescript
try {
  await grantTournamentAchievements(
    tournamentId, 
    tournament, 
    players, 
    matches
  );
} catch (err) {
  console.error('Achievement grant failed:', err);
  // Tournament completion NOT blocked
}
```

### Safe Array Operations
```typescript
// Safe: provides fallback
const earnedAchievements = playerSnap.data()?.earnedAchievements ?? [];

// Safe: filters out undefined
const achievements = earned
  .map(a => ({ earned: a, def: LEAGUE_ACHIEVEMENTS.find(d => d.id === a.id) }))
  .filter((item): item is { earned: EarnedAchievement; def: LeagueAchievementDef } => !!item.def);
```

### Firestore Error Handling
```typescript
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

getDocs(q)
  .catch(err => handleFirestoreError(err, OperationType.GET, 'tournaments'));
```

---

## Performance Tips

### Batch Query Optimization
```typescript
// ❌ Bad: N+1 queries
for (const tourn of tournaments) {
  const players = await getDocs(collection(db, `tournaments/${tourn.id}/players`));
}

// ✅ Good: Build participation map in one pass
const participation = new Map<string, Set<string>>();
for (const tourn of tournaments) {
  const playersSnap = await getDocs(collection(db, `tournaments/${tourn.id}/players`));
  for (const pd of playersSnap.docs) {
    const set = participation.get(pd.id) ?? new Set();
    set.add(tourn.id);
    participation.set(pd.id, set);
  }
}
```

### Cache Player Data
```typescript
const [playerProfile, setPlayerProfile] = useState<any>(null);

useEffect(() => {
  // Fetch once on component mount
  if (!playerId) return;
  
  getDoc(doc(db, 'players', playerId)).then(setPlayerProfile);
}, [playerId]);

// Use cached data throughout component
const achievements = playerProfile?.earnedAchievements ?? [];
```

---

## Debugging Helpers

### Log Achievement Grant
```typescript
const def = LEAGUE_ACHIEVEMENTS.find(a => a.id === achievementId);
console.log(`[Achievement] Granting ${def?.name} to ${playerId}`, context);
```

### Verify Player Has Achievement
```typescript
const player = await getDoc(doc(db, 'players', playerId));
const earned = player.data()?.earnedAchievements ?? [];
const hasIt = earned.some(a => a.id === 'matchday-winner');
console.log(`Player has matchday-winner: ${hasIt}`);
```

### Check Hat-Trick Logic
```typescript
const earned = player.data()?.earnedAchievements ?? [];
const seasonWins = earned
  .filter(a => a.id === 'matchday-winner' && a.context.seasonId === seasonId)
  .map(a => a.context.tournamentNumber)
  .filter(Boolean)
  .sort((a, b) => a - b);

console.log('Season wins:', seasonWins);
console.log('Current:', currentTournamentNumber);
console.log('Has Hat-Trick sequence:', 
  seasonWins.includes(currentTournamentNumber - 2) &&
  seasonWins.includes(currentTournamentNumber - 1)
);
```

---

## Type Definitions (Copy-Paste)

```typescript
interface EarnedAchievement {
  id: string;
  earnedAt: string; // ISO 8601
  context: Record<string, any>;
}

interface LeagueAchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string; // Iconify format
  tier: 'bronze' | 'silver' | 'gold' | 'special';
  stackable: boolean;
}

interface GrandFinalConfig {
  qualifierCount: number;
  quarterFormat: string; // '501_bo3' etc
  semiFormat: string;
  finalFormat: string;
}

interface Tournament {
  title: string;
  status: 'draft' | 'groups' | 'bracket' | 'completed';
  ownerId: string;
  createdAt: string;
  isFinalTournament?: boolean;
  grandFinalConfig?: GrandFinalConfig;
  entryMode?: 'matches-only' | 'placements-only';
}

interface PlayerInTournament {
  name: string;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws?: number;
  placement?: number;
  rank?: number;
}
```

---

**Last Updated**: Phase 7 Complete (2026-04-18)  
**Version**: Production 1.0
