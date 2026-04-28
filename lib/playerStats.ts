import { db } from './firebase';
import { collectionGroup, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

export type GameType = 'bot' | 'casual' | 'tournament';
export type MatchResult = 'win' | 'loss' | 'draw';

export interface DartThrow {
  multiplier: 'single' | 'double' | 'triple';
  baseValue: number;
  scoredPoints: number;
}

export interface MatchTurn {
  playerId: string;
  darts: DartThrow[];
  totalScored: number;
  isBust: boolean;
}

export interface LegData {
  winnerId: string;
  playerTurns: MatchTurn[];
  playerDartsThrown: number;
  checkoutScore?: number;
  checkoutDarts?: number;
  first9Score: number;
  hadCheckoutAttempt: boolean;
}

export interface MatchStats {
  matchId: string;
  tournamentId: string;
  tournamentTitle: string;
  gameType: GameType;
  result: MatchResult;
  opponentName: string;
  opponentId: string;
  format: string;
  legsWon: number;
  legsLost: number;
  date: string;
  playerTurns: MatchTurn[];
  legs: LegData[];
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;

  legsPlayed: number;
  legsWon: number;
  legsLost: number;
  legWinRate: number;

  dartsThrown: number;
  totalScored: number;
  avg3: number;
  first9Avg: number;
  highestRound: number;
  bestLegDarts: number;
  dart1Avg: number;
  dart2Avg: number;
  dart3Avg: number;

  rate20: number;
  rate20or19: number;
  rateTriple: number;
  rateTurn60: number;
  rateTurn57: number;

  count60plus: number;
  count100plus: number;
  count140plus: number;
  count180: number;

  bustRate: number;
  fieldRates: Record<number, number>;

  checkoutsHit: number;
  checkoutAttempts: number;
  checkoutRate: number;
  highestCheckout: number;
  bestCheckoutDarts: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  tier?: 'bronze' | 'silver' | 'gold' | 'diamond';
}

// Re-export so components can use a single import
export type { EarnedAchievement } from './achievementEngine';
export { LEAGUE_ACHIEVEMENTS } from './achievementEngine';

function getStartScore(format: string): number {
  return format.startsWith('301') ? 301 : 501;
}

function simulateLegs(match: any, playerId: string): LegData[] {
  const startScore = getStartScore(match.format || '501_bo3');
  const playerAId = match.playerAId as string;
  const isPlayerA = playerAId === playerId;

  let restA = startScore;
  let restB = startScore;
  let turnsA: MatchTurn[] = [];
  let turnsB: MatchTurn[] = [];
  const legs: LegData[] = [];
  let playerHadCheckoutAttemptThisLeg = false;

  for (const turn of (match.turns || []) as MatchTurn[]) {
    const isA = turn.playerId === playerAId;
    const isTargetPlayer = turn.playerId === playerId;
    const currentRest = isA ? restA : restB;

    // Checkout attempt: player's rest ≤ 170 (can finish in one visit)
    if (isTargetPlayer && currentRest <= 170) {
      playerHadCheckoutAttemptThisLeg = true;
    }

    if (isA) {
      turnsA.push(turn);
      if (!turn.isBust) restA -= turn.totalScored;
      if (restA === 0) {
        const myTurns = isPlayerA ? turnsA : turnsB;
        const first3 = myTurns.slice(0, 3);
        legs.push({
          winnerId: playerAId,
          playerTurns: [...myTurns],
          playerDartsThrown: myTurns.reduce((s, t) => s + t.darts.length, 0),
          checkoutScore: isPlayerA ? turn.totalScored : undefined,
          checkoutDarts: isPlayerA ? turn.darts.length : undefined,
          first9Score: first3.reduce((s, t) => s + t.totalScored, 0),
          hadCheckoutAttempt: playerHadCheckoutAttemptThisLeg,
        });
        restA = startScore; restB = startScore;
        turnsA = []; turnsB = [];
        playerHadCheckoutAttemptThisLeg = false;
      }
    } else {
      turnsB.push(turn);
      if (!turn.isBust) restB -= turn.totalScored;
      if (restB === 0) {
        const myTurns = isPlayerA ? turnsA : turnsB;
        const first3 = myTurns.slice(0, 3);
        legs.push({
          winnerId: match.playerBId,
          playerTurns: [...myTurns],
          playerDartsThrown: myTurns.reduce((s, t) => s + t.darts.length, 0),
          checkoutScore: !isPlayerA ? turn.totalScored : undefined,
          checkoutDarts: !isPlayerA ? turn.darts.length : undefined,
          first9Score: first3.reduce((s, t) => s + t.totalScored, 0),
          hadCheckoutAttempt: playerHadCheckoutAttemptThisLeg,
        });
        restA = startScore; restB = startScore;
        turnsA = []; turnsB = [];
        playerHadCheckoutAttemptThisLeg = false;
      }
    }
  }
  return legs;
}

export async function fetchPlayerMatches(playerId: string): Promise<MatchStats[]> {
  // Single-field queries on collectionGroup work without composite index
  const [snapA, snapB] = await Promise.all([
    getDocs(query(collectionGroup(db, 'matches'), where('playerAId', '==', playerId))),
    getDocs(query(collectionGroup(db, 'matches'), where('playerBId', '==', playerId))),
  ]);

  const seen = new Set<string>();
  const allDocs = [...snapA.docs, ...snapB.docs].filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return d.data().status === 'completed';
  });

  const tournamentIds = [...new Set(allDocs.map(d => d.ref.parent.parent!.id))];
  const tournamentResults = await Promise.allSettled(tournamentIds.map(id => getDoc(doc(db, 'tournaments', id))));
  const tournaments = new Map(
    tournamentResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => [r.value.id, r.value.data()])
  );

  const matchStats: MatchStats[] = allDocs.map(matchDoc => {
    const m = matchDoc.data();
    const tid = matchDoc.ref.parent.parent!.id;
    const tournament = tournaments.get(tid);
    const isA = m.playerAId === playerId;

    let result: MatchResult;
    if (m.isDraw) result = 'draw';
    else if (m.winnerId === playerId) result = 'win';
    else result = 'loss';

    let gameType: GameType;
    if (tournament?.isVsAI) gameType = 'bot';
    else if (tournament?.type === 'single_match' || tournament?.type === 'casual_tiebreak') gameType = 'casual';
    else gameType = 'tournament';

    const playerTurns = ((m.turns || []) as MatchTurn[]).filter(t => t.playerId === playerId);
    const legs = simulateLegs(m, playerId);

    return {
      matchId: matchDoc.id,
      tournamentId: tid,
      tournamentTitle: tournament?.title || 'Unbekannt',
      gameType,
      result,
      opponentName: isA ? m.playerBName : m.playerAName,
      opponentId: isA ? m.playerBId : m.playerAId,
      format: m.format || '501_bo3',
      legsWon: isA ? (m.playerALegs ?? 0) : (m.playerBLegs ?? 0),
      legsLost: isA ? (m.playerBLegs ?? 0) : (m.playerALegs ?? 0),
      date: tournament?.createdAt || '',
      playerTurns,
      legs,
    };
  });

  return matchStats.sort((a, b) => b.date.localeCompare(a.date));
}

export function calculateStats(matches: MatchStats[]): PlayerStats {
  const gamesPlayed = matches.length;
  const wins = matches.filter(m => m.result === 'win').length;
  const losses = matches.filter(m => m.result === 'loss').length;
  const draws = matches.filter(m => m.result === 'draw').length;

  const allLegs = matches.flatMap(m => m.legs);
  const legsPlayed = allLegs.length;
  const legsWon = allLegs.filter(l => l.winnerId !== undefined && matches.find(m => m.legs.includes(l))?.result !== undefined
    ? l.winnerId === matches.find(m => m.legs.includes(l))?.opponentId ? false : true
    : false
  ).length;

  // Simpler leg calculation
  const legsWonCount = matches.reduce((s, m) => s + m.legsWon, 0);
  const legsLostCount = matches.reduce((s, m) => s + m.legsLost, 0);

  const allTurns = matches.flatMap(m => m.playerTurns);
  const allDarts = allTurns.flatMap(t => t.darts);
  const dartsThrown = allDarts.length;
  const totalScored = allTurns.reduce((s, t) => s + t.totalScored, 0);
  const avg3 = dartsThrown > 0 ? (totalScored / dartsThrown) * 3 : 0;

  // First 9 average
  const first9Scores = allLegs.map(l => l.first9Score).filter(s => s > 0);
  const first9Avg = first9Scores.length > 0 ? first9Scores.reduce((a, b) => a + b, 0) / first9Scores.length : 0;

  const highestRound = allTurns.reduce((max, t) => Math.max(max, t.totalScored), 0);

  // Best leg: fewest darts in a won leg (player won the leg)
  const wonLegs = allLegs.filter(l => {
    const match = matches.find(m => m.legs.includes(l));
    return match && l.winnerId !== match.opponentId;
  });
  const bestLegDarts = wonLegs.length > 0
    ? Math.min(...wonLegs.map(l => l.playerDartsThrown))
    : 0;

  // Per-dart averages
  const d1vals = allTurns.map(t => t.darts[0]?.scoredPoints ?? 0);
  const d2vals = allTurns.filter(t => t.darts.length >= 2).map(t => t.darts[1].scoredPoints);
  const d3vals = allTurns.filter(t => t.darts.length >= 3).map(t => t.darts[2].scoredPoints);
  const dart1Avg = d1vals.length > 0 ? d1vals.reduce((a, b) => a + b, 0) / d1vals.length : 0;
  const dart2Avg = d2vals.length > 0 ? d2vals.reduce((a, b) => a + b, 0) / d2vals.length : 0;
  const dart3Avg = d3vals.length > 0 ? d3vals.reduce((a, b) => a + b, 0) / d3vals.length : 0;

  // Hit rates
  const rate20 = dartsThrown > 0 ? allDarts.filter(d => d.baseValue === 20 && d.multiplier === 'single').length / dartsThrown : 0;
  const rate20or19 = dartsThrown > 0 ? allDarts.filter(d => d.baseValue === 20 || d.baseValue === 19).length / dartsThrown : 0;
  const rateTriple = dartsThrown > 0 ? allDarts.filter(d => d.multiplier === 'triple').length / dartsThrown : 0;
  const nonBustTurns = allTurns.filter(t => !t.isBust);
  const rateTurn60 = allTurns.length > 0 ? allTurns.filter(t => t.totalScored >= 60).length / allTurns.length : 0;
  const rateTurn57 = allTurns.length > 0 ? allTurns.filter(t => t.totalScored >= 57).length / allTurns.length : 0;

  // High scores
  const count60plus = allTurns.filter(t => t.totalScored >= 60).length;
  const count100plus = allTurns.filter(t => t.totalScored >= 100).length;
  const count140plus = allTurns.filter(t => t.totalScored >= 140).length;
  const count180 = allTurns.filter(t => t.totalScored === 180).length;

  // Bust rate
  const bustRate = allTurns.length > 0 ? allTurns.filter(t => t.isBust).length / allTurns.length : 0;

  // Field rates (1-20 + bull=25)
  const fieldRates: Record<number, number> = {};
  for (let i = 1; i <= 20; i++) {
    fieldRates[i] = dartsThrown > 0 ? allDarts.filter(d => d.baseValue === i).length / dartsThrown : 0;
  }
  fieldRates[25] = dartsThrown > 0 ? allDarts.filter(d => d.baseValue === 25).length / dartsThrown : 0;

  // Checkout stats
  const checkoutAttempts = allLegs.filter(l => l.hadCheckoutAttempt).length;
  const checkoutsHit = wonLegs.filter(l => l.checkoutScore !== undefined).length;
  const checkoutRate = checkoutAttempts > 0 ? checkoutsHit / checkoutAttempts : 0;
  const highestCheckout = wonLegs.reduce((max, l) => Math.max(max, l.checkoutScore ?? 0), 0);
  const bestCheckoutDarts = wonLegs.filter(l => l.checkoutDarts).reduce((min, l) => Math.min(min, l.checkoutDarts!), 99);

  return {
    gamesPlayed,
    wins,
    losses,
    draws,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
    legsPlayed: legsWonCount + legsLostCount,
    legsWon: legsWonCount,
    legsLost: legsLostCount,
    legWinRate: (legsWonCount + legsLostCount) > 0 ? legsWonCount / (legsWonCount + legsLostCount) : 0,
    dartsThrown,
    totalScored,
    avg3: Math.round(avg3 * 10) / 10,
    first9Avg: Math.round(first9Avg * 10) / 10,
    highestRound,
    bestLegDarts: bestLegDarts === 0 ? 0 : bestLegDarts,
    dart1Avg: Math.round(dart1Avg * 10) / 10,
    dart2Avg: Math.round(dart2Avg * 10) / 10,
    dart3Avg: Math.round(dart3Avg * 10) / 10,
    rate20,
    rate20or19,
    rateTriple,
    rateTurn60,
    rateTurn57,
    count60plus,
    count100plus,
    count140plus,
    count180,
    bustRate,
    fieldRates,
    checkoutsHit,
    checkoutAttempts,
    checkoutRate,
    highestCheckout,
    bestCheckoutDarts: bestCheckoutDarts === 99 ? 0 : bestCheckoutDarts,
  };
}

export function getAchievements(stats: PlayerStats, matches: MatchStats[]): Achievement[] {
  const has180 = stats.count180 > 0;
  const has5x180 = stats.count180 >= 5;
  const has9darter = matches.some(m => m.legs.some(l => {
    const match = matches.find(mx => mx.legs.includes(l));
    return match && l.winnerId !== match.opponentId && l.playerDartsThrown === 9;
  }));

  return [
    { id: 'first_win', name: 'Erster Sieg', description: 'Ersten Sieg errungen', icon: 'mdi:trophy-outline', unlocked: stats.wins >= 1, tier: 'bronze' },
    { id: 'wins10', name: '10 Siege', description: '10 Spiele gewonnen', icon: 'mdi:trophy', unlocked: stats.wins >= 10, tier: 'silver' },
    { id: 'wins50', name: '50 Siege', description: '50 Spiele gewonnen', icon: 'mdi:trophy', unlocked: stats.wins >= 50, tier: 'gold' },
    { id: 'wins100', name: '100 Siege', description: '100 Spiele gewonnen', icon: 'mdi:crown', unlocked: stats.wins >= 100, tier: 'diamond' },
    { id: 'played50', name: 'Veteran', description: '50 Spiele gespielt', icon: 'mdi:controller', unlocked: stats.gamesPlayed >= 50, tier: 'silver' },
    { id: 'played100', name: 'Profi', description: '100 Spiele gespielt', icon: 'mdi:star', unlocked: stats.gamesPlayed >= 100, tier: 'gold' },
    { id: 'first180', name: '180!', description: 'Erste 180 geworfen', icon: 'mdi:bullseye-arrow', unlocked: has180, tier: 'gold' },
    { id: '5x180', name: '180er-Meister', description: '5 mal 180 geworfen', icon: 'mdi:bullseye-arrow', unlocked: has5x180, tier: 'diamond' },
    { id: '9darter', name: '9-Darter!', description: 'Perfektes Leg mit 9 Darts', icon: 'mdi:lightning-bolt', unlocked: has9darter, tier: 'diamond' },
    { id: 'checkout100', name: 'Finisher', description: '100+ Checkout geschafft', icon: 'mdi:bullseye', unlocked: stats.highestCheckout >= 100, tier: 'silver' },
    { id: 'checkout170', name: '170-Checkout!', description: 'Maximales Checkout (170)', icon: 'mdi:fire', unlocked: stats.highestCheckout >= 170, tier: 'diamond' },
    { id: 'avg3_60', name: 'Solider Werfer', description: '3-Dart-Average über 60', icon: 'mdi:chart-line', unlocked: stats.avg3 >= 60, tier: 'bronze' },
    { id: 'avg3_80', name: 'Guter Werfer', description: '3-Dart-Average über 80', icon: 'mdi:chart-line', unlocked: stats.avg3 >= 80, tier: 'silver' },
    { id: 'avg3_100', name: 'Profi-Average', description: '3-Dart-Average über 100', icon: 'mdi:chart-bar', unlocked: stats.avg3 >= 100, tier: 'gold' },
    { id: 'bot_beater', name: 'Bot-Bezwinger', description: 'Gegen Bot gewonnen', icon: 'mdi:robot', unlocked: matches.filter(m => m.gameType === 'bot' && m.result === 'win').length > 0, tier: 'bronze' },
    { id: 'winrate80', name: 'Dominanz', description: 'Siegrate über 80%', icon: 'mdi:crown-outline', unlocked: stats.gamesPlayed >= 10 && stats.winRate >= 0.8, tier: 'gold' },
    { id: 'legrate80', name: 'Leg-Sammler', description: 'Leg-Siegrate über 80%', icon: 'mdi:podium', unlocked: stats.legsPlayed >= 10 && stats.legWinRate >= 0.8, tier: 'silver' },
    { id: 'highscore', name: 'High-Score-König', description: '10+ mal 140+ geworfen', icon: 'mdi:numeric-10-circle', unlocked: stats.count140plus >= 10, tier: 'gold' },
  ];
}
