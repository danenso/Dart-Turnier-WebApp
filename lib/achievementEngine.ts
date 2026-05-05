import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EarnedAchievement {
  id: string;
  earnedAt: string;
  context: Record<string, any>;
}

export interface LeagueAchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'special';
  stackable: boolean;
}

// ─────────────────────────────────────────────────────────────
// League Achievement Catalog
// ─────────────────────────────────────────────────────────────

export const LEAGUE_ACHIEVEMENTS: LeagueAchievementDef[] = [
  // ── Turniersieg ──
  {
    id: 'matchday-winner',
    name: 'Tagessieg',
    description: 'Spieltag als Erster abgeschlossen',
    icon: 'mdi:trophy',
    tier: 'special',
    stackable: true,
  },
  {
    id: 'first-tournament-win',
    name: 'Erster Turniersieg',
    description: 'Zum ersten Mal ein Turnier gewonnen',
    icon: 'mdi:trophy-award',
    tier: 'bronze',
    stackable: false,
  },
  {
    id: 'wins-3-tournaments',
    name: 'Dreifach-Champion',
    description: '3 Turniere insgesamt gewonnen',
    icon: 'mdi:trophy-variant',
    tier: 'silver',
    stackable: false,
  },
  {
    id: 'wins-5-tournaments',
    name: 'Turnier-Legende',
    description: '5 Turniere insgesamt gewonnen',
    icon: 'mdi:crown-outline',
    tier: 'gold',
    stackable: false,
  },
  {
    id: 'wins-10-tournaments',
    name: 'Weltmeister',
    description: '10 Turniere insgesamt gewonnen',
    icon: 'mdi:crown-circle',
    tier: 'special',
    stackable: false,
  },
  // ── Turnier-Performance ──
  {
    id: 'tournament-unbeaten',
    name: 'Ungeschlagen',
    description: 'Ein Turnier gewonnen ohne eine einzige Niederlage',
    icon: 'mdi:shield-star',
    tier: 'gold',
    stackable: true,
  },
  {
    id: 'tournament-comeback',
    name: 'Comeback King',
    description: 'Ein Turnier gewonnen trotz mindestens einer Niederlage',
    icon: 'mdi:trending-up',
    tier: 'silver',
    stackable: true,
  },
  {
    id: 'tournament-underdog',
    name: 'Underdog',
    description: 'Ein Turnier gewonnen trotz mehr Niederlagen als Siegen',
    icon: 'mdi:arrow-up-bold-circle',
    tier: 'silver',
    stackable: true,
  },
  // ── Bracket-Platzierungen ──
  {
    id: 'tournament-finalist',
    name: 'Finalist',
    description: 'Das Finale eines Turniers erreicht',
    icon: 'mdi:podium-silver',
    tier: 'bronze',
    stackable: true,
  },
  {
    id: 'tournament-top4',
    name: 'Top 4',
    description: 'Das Halbfinale eines Turniers erreicht',
    icon: 'mdi:podium-bronze',
    tier: 'bronze',
    stackable: true,
  },
  // ── Gruppen-Performance ──
  {
    id: 'perfect-group',
    name: 'Perfekte Gruppe',
    description: 'Alle Gruppenspiele eines Spieltags gewonnen',
    icon: 'mdi:star-circle',
    tier: 'gold',
    stackable: true,
  },
  {
    id: 'matchday-hat-trick',
    name: 'Hat-Trick',
    description: '3 Spieltage einer Season in Folge gewonnen',
    icon: 'mdi:hat-fedora',
    tier: 'gold',
    stackable: false,
  },
  // ── Season ──
  {
    id: 'iron-man',
    name: 'Iron Man',
    description: 'An allen Spieltagen einer Season teilgenommen',
    icon: 'mdi:robot',
    tier: 'gold',
    stackable: false,
  },
  {
    id: 'season-table-1st',
    name: 'Saisonmeister',
    description: 'Eine Season auf Platz 1 der Tabelle beendet',
    icon: 'mdi:medal',
    tier: 'gold',
    stackable: true,
  },
  {
    id: 'season-table-2nd',
    name: 'Vizemeister',
    description: 'Eine Season auf Platz 2 der Tabelle beendet',
    icon: 'mdi:medal',
    tier: 'silver',
    stackable: true,
  },
  {
    id: 'season-table-3rd',
    name: 'Bronze-Platz',
    description: 'Eine Season auf Platz 3 der Tabelle beendet',
    icon: 'mdi:medal',
    tier: 'bronze',
    stackable: true,
  },
  // ── Grand Final ──
  {
    id: 'grand-final-qualified',
    name: 'Grand Final Qualifier',
    description: 'Für das Grand Final qualifiziert',
    icon: 'mdi:ticket-star',
    tier: 'special',
    stackable: true,
  },
  {
    id: 'grand-final-champion',
    name: 'Season-Champion',
    description: 'Das Grand Final gewonnen',
    icon: 'mdi:crown',
    tier: 'gold',
    stackable: true,
  },
  {
    id: 'grand-final-finalist',
    name: 'Finalist',
    description: 'Das Grand Final Finale erreicht',
    icon: 'mdi:podium-silver',
    tier: 'silver',
    stackable: true,
  },
  {
    id: 'grand-final-3rd',
    name: 'Grand Final Bronze',
    description: 'Das Halbfinale des Grand Finals erreicht',
    icon: 'mdi:podium-bronze',
    tier: 'bronze',
    stackable: true,
  },
];

// ─────────────────────────────────────────────────────────────
// Core Grant Function
// ─────────────────────────────────────────────────────────────

async function grantAchievement(
  playerId: string,
  achievementId: string,
  context: Record<string, any>,
): Promise<void> {
  const def = LEAGUE_ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!def) return;

  const playerRef = doc(db, 'players', playerId);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return;

  const existing: EarnedAchievement[] = playerSnap.data()?.earnedAchievements ?? [];

  if (!def.stackable && existing.some((a) => a.id === achievementId)) return;

  await updateDoc(playerRef, {
    earnedAchievements: arrayUnion({
      id: achievementId,
      earnedAt: new Date().toISOString(),
      context,
    }),
  });
}

// ─────────────────────────────────────────────────────────────
// Cumulative Win Milestone Helper
// ─────────────────────────────────────────────────────────────

async function checkCumulativeWinMilestones(
  playerId: string,
  context: Record<string, any>,
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'players', playerId));
    if (!snap.exists()) return;
    const earned: EarnedAchievement[] = snap.data()?.earnedAchievements ?? [];
    // Count all tournament wins: regular matchdays + grand final
    const totalWins = earned.filter(
      (a) => a.id === 'matchday-winner' || a.id === 'grand-final-champion',
    ).length;

    if (totalWins >= 1) await grantAchievement(playerId, 'first-tournament-win', context);
    if (totalWins >= 3) await grantAchievement(playerId, 'wins-3-tournaments', { ...context, totalWins });
    if (totalWins >= 5) await grantAchievement(playerId, 'wins-5-tournaments', { ...context, totalWins });
    if (totalWins >= 10) await grantAchievement(playerId, 'wins-10-tournaments', { ...context, totalWins });
  } catch (_) {
    // Non-critical
  }
}

// ─────────────────────────────────────────────────────────────
// Tournament Completion Handler
// ─────────────────────────────────────────────────────────────

/**
 * Grant achievements when a regular matchday tournament completes.
 */
export async function grantTournamentAchievements(
  tournamentId: string,
  tournament: {
    title: string;
    seasonId?: string;
    tournamentNumber?: number;
    isFinalTournament?: boolean;
  },
  players: { id: string; name: string; points: number; wins: number; losses: number }[],
  matches: {
    phase: string;
    status: string;
    playerAId: string;
    playerBId: string;
    winnerId?: string;
  }[],
): Promise<void> {
  // Only for regular season matchday tournaments
  if (!tournament.seasonId || tournament.isFinalTournament) return;

  const sorted = [...players].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.losses - b.losses,
  );

  const winner = sorted[0];
  if (!winner) return;

  const baseCtx = {
    tournamentId,
    seasonId: tournament.seasonId,
    tournamentTitle: tournament.title,
    tournamentNumber: tournament.tournamentNumber,
  };

  // ── Matchday winner (stackable) ──
  await grantAchievement(winner.id, 'matchday-winner', { ...baseCtx, placement: 1 });

  // ── Cumulative win milestones ──
  await checkCumulativeWinMilestones(winner.id, baseCtx);

  // ── Winner quality achievements ──
  if (winner.losses === 0) {
    // Won without a single defeat
    await grantAchievement(winner.id, 'tournament-unbeaten', baseCtx);
  } else {
    // Won despite at least one loss
    await grantAchievement(winner.id, 'tournament-comeback', { ...baseCtx, losses: winner.losses });
    if (winner.losses > winner.wins) {
      // More losses than wins overall — true underdog
      await grantAchievement(winner.id, 'tournament-underdog', {
        ...baseCtx,
        wins: winner.wins,
        losses: winner.losses,
      });
    }
  }

  // ── Bracket placement achievements ──
  const completedMatches = matches.filter((m) => m.status === 'completed' && m.winnerId);
  const finalMatch = completedMatches.find((m) => m.phase === 'final');
  const semiMatches = completedMatches.filter((m) => m.phase === 'semi');

  if (finalMatch) {
    // Runner-up: lost the final
    const finalistId =
      finalMatch.winnerId === finalMatch.playerAId
        ? finalMatch.playerBId
        : finalMatch.playerAId;
    await grantAchievement(finalistId, 'tournament-finalist', { ...baseCtx, placement: 2 });

    // Top 4: all semi-finalists
    for (const semi of semiMatches) {
      for (const pId of [semi.playerAId, semi.playerBId]) {
        await grantAchievement(pId, 'tournament-top4', { ...baseCtx, placement: 'top4' });
      }
    }
  }

  // ── Hat-Trick: 3 consecutive matchday wins in this season ──
  if (tournament.tournamentNumber && tournament.tournamentNumber >= 3) {
    try {
      const winnerRef = doc(db, 'players', winner.id);
      const winnerSnap = await getDoc(winnerRef);
      const earned: EarnedAchievement[] = winnerSnap.data()?.earnedAchievements ?? [];
      const seasonWins = earned
        .filter((a) => a.id === 'matchday-winner' && a.context.seasonId === tournament.seasonId)
        .map((a) => a.context.tournamentNumber as number)
        .filter(Boolean)
        .sort((a, b) => a - b);
      if (!seasonWins.includes(tournament.tournamentNumber)) {
        seasonWins.push(tournament.tournamentNumber);
        seasonWins.sort((a, b) => a - b);
      }
      const cur = tournament.tournamentNumber;
      if (seasonWins.includes(cur - 1) && seasonWins.includes(cur - 2)) {
        await grantAchievement(winner.id, 'matchday-hat-trick', {
          seasonId: tournament.seasonId,
          tournamentNumbers: [cur - 2, cur - 1, cur],
        });
      }
    } catch (_) {
      // Non-critical
    }
  }

  // ── Perfect group: won every group match ──
  const groupMatches = matches.filter(
    (m) => m.phase === 'group' && m.status === 'completed',
  );
  for (const player of sorted) {
    const myMatches = groupMatches.filter(
      (m) => m.playerAId === player.id || m.playerBId === player.id,
    );
    if (myMatches.length > 0 && myMatches.every((m) => m.winnerId === player.id)) {
      await grantAchievement(player.id, 'perfect-group', { ...baseCtx });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Grand Final Completion Handler
// ─────────────────────────────────────────────────────────────

/**
 * Grant achievements when a Grand Final tournament completes.
 */
export async function grantGrandFinalAchievements(
  tournamentId: string,
  tournament: {
    title: string;
    seasonId?: string;
    isFinalTournament?: boolean;
  },
  matches: {
    phase: string;
    status: string;
    playerAId: string;
    playerBId: string;
    winnerId?: string;
  }[],
): Promise<void> {
  if (!tournament.isFinalTournament) return;

  const finalMatch = matches.find(
    (m) => m.phase === 'final' && m.status === 'completed',
  );
  if (!finalMatch) return;

  const ctx = {
    tournamentId,
    seasonId: tournament.seasonId,
    tournamentTitle: tournament.title,
  };

  const champion =
    finalMatch.winnerId === finalMatch.playerAId
      ? finalMatch.playerAId
      : finalMatch.playerBId;
  const finalist =
    finalMatch.winnerId === finalMatch.playerAId
      ? finalMatch.playerBId
      : finalMatch.playerAId;

  await grantAchievement(champion, 'grand-final-champion', { ...ctx, placement: 1 });
  await grantAchievement(finalist, 'grand-final-finalist', { ...ctx, placement: 2 });

  // Cumulative win milestones also count Grand Final wins
  await checkCumulativeWinMilestones(champion, ctx);

  // Semi-final losers → Grand Final Bronze
  const semiMatches = matches.filter(
    (m) => m.phase === 'semi' && m.status === 'completed',
  );
  for (const semi of semiMatches) {
    const loser =
      semi.winnerId === semi.playerAId ? semi.playerBId : semi.playerAId;
    if (loser !== champion && loser !== finalist) {
      await grantAchievement(loser, 'grand-final-3rd', { ...ctx, placement: 3 });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Season Completion Handler
// ─────────────────────────────────────────────────────────────

/**
 * Grant season table achievements when a season is finalized.
 * Pass the standings sorted by totalPoints (desc).
 */
export async function grantSeasonAchievements(
  seasonId: string,
  seasonName: string,
  standings: { playerId: string; totalPoints: number }[],
  qualifierCount: number = 8,
): Promise<void> {
  const medals = [
    { id: 'season-table-1st', placement: 1 },
    { id: 'season-table-2nd', placement: 2 },
    { id: 'season-table-3rd', placement: 3 },
  ];

  for (const { id: achId, placement } of medals) {
    const entry = standings[placement - 1];
    if (entry) {
      await grantAchievement(entry.playerId, achId, {
        seasonId,
        seasonName,
        placement,
        totalPoints: entry.totalPoints,
      });
    }
  }

  // Grand Final qualifiers (Top N)
  const qualCount = Math.min(qualifierCount, standings.length);
  for (let i = 0; i < qualCount; i++) {
    await grantAchievement(standings[i].playerId, 'grand-final-qualified', {
      seasonId,
      seasonName,
      rank: i + 1,
    });
  }

  // Iron Man: check if any player participated in ALL regular matchdays
  try {
    const tournsSnap = await getDocs(
      query(collection(db, 'tournaments'), where('seasonId', '==', seasonId)),
    );
    const regularTourns = tournsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((t) => t.status === 'completed' && !t.isFinalTournament);

    if (regularTourns.length >= 3) {
      const participation = new Map<string, Set<string>>();
      for (const tourn of regularTourns) {
        const playersSnap = await getDocs(collection(db, 'tournaments', tourn.id, 'players'));
        for (const pd of playersSnap.docs) {
          const set = participation.get(pd.id) ?? new Set();
          set.add(tourn.id);
          participation.set(pd.id, set);
        }
      }

      for (const [playerId, tournSet] of participation) {
        if (tournSet.size === regularTourns.length) {
          await grantAchievement(playerId, 'iron-man', {
            seasonId,
            seasonName,
            matchdaysPlayed: regularTourns.length,
          });
        }
      }
    }
  } catch (_) {
    // Non-critical
  }
}
