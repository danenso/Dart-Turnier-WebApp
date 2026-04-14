export const BOT_PLAYER_ID = "ai-bot-player";
export type AIDifficulty = "easy" | "medium" | "hard";

export interface AIDart {
  multiplier: "single" | "double" | "triple";
  baseValue: number;
  scoredPoints: number;
}

export interface AITurnResult {
  darts: AIDart[];
  isBust: boolean;
  isCheckout: boolean;
  newRest: number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gauss(mean: number, stddev: number): number {
  // Box-Muller Transform
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(mean + z * stddev);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Häufige Doppelfelder für Checkout (Profi kennt sie auswendig)
const COMMON_DOUBLES = [20, 16, 10, 8, 4, 2, 1];

// ── Einzelner Dart-Wurf ────────────────────────────────────────────────────────

function throwDart(difficulty: AIDifficulty, rest: number): AIDart {
  const rand = Math.random();

  // ── PROFI ──────────────────────────────────────────────────────────────
  if (difficulty === "hard") {
    // Checkout-Versuch wenn möglich
    if (rest <= 50 && rest > 1 && rest % 2 === 0 && rand < 0.72) {
      const base = rest / 2;
      return { multiplier: "double", baseValue: base, scoredPoints: rest };
    }
    if (rest === 50 && rand < 0.60) {
      return { multiplier: "double", baseValue: 25, scoredPoints: 50 };
    }

    // Normaler Wurf: vor allem T20, T19, T18
    if (rand < 0.03) return { multiplier: "single", baseValue: 0, scoredPoints: 0 }; // miss
    if (rand < 0.55) return { multiplier: "triple", baseValue: 20, scoredPoints: 60 };
    if (rand < 0.70) return { multiplier: "triple", baseValue: 19, scoredPoints: 57 };
    if (rand < 0.80) return { multiplier: "triple", baseValue: 18, scoredPoints: 54 };
    if (rand < 0.87) return { multiplier: "single", baseValue: 20, scoredPoints: 20 };
    if (rand < 0.92) return { multiplier: "double", baseValue: 20, scoredPoints: 40 };
    if (rand < 0.95) return { multiplier: "triple", baseValue: 17, scoredPoints: 51 };
    if (rand < 0.97) return { multiplier: "single", baseValue: 25, scoredPoints: 25 };
    return { multiplier: "double", baseValue: 25, scoredPoints: 50 };
  }

  // ── FORTGESCHRITTENER ──────────────────────────────────────────────────
  if (difficulty === "medium") {
    if (rest <= 40 && rest > 1 && rest % 2 === 0 && rand < 0.42) {
      const base = rest / 2;
      return { multiplier: "double", baseValue: base, scoredPoints: rest };
    }

    if (rand < 0.10) return { multiplier: "single", baseValue: 0, scoredPoints: 0 };
    if (rand < 0.30) {
      // Triple-Versuch, trifft aber oft daneben
      const target = [20, 19, 18][rnd(0, 2)];
      if (Math.random() < 0.45) {
        return { multiplier: "triple", baseValue: target, scoredPoints: target * 3 };
      }
      // Verfehlt → Single auf Nachbarfeld
      return { multiplier: "single", baseValue: target, scoredPoints: target };
    }
    if (rand < 0.65) {
      const base = rnd(14, 20);
      return { multiplier: "single", baseValue: base, scoredPoints: base };
    }
    if (rand < 0.80) {
      const base = rnd(5, 13);
      return { multiplier: "single", baseValue: base, scoredPoints: base };
    }
    if (rand < 0.92) {
      const base = rnd(10, 20);
      return { multiplier: "double", baseValue: base, scoredPoints: base * 2 };
    }
    return { multiplier: "single", baseValue: 25, scoredPoints: 25 };
  }

  // ── ANFÄNGER ────────────────────────────────────────────────────────────
  if (rand < 0.28) return { multiplier: "single", baseValue: 0, scoredPoints: 0 }; // miss
  if (rand < 0.85) {
    const base = rnd(1, 20);
    return { multiplier: "single", baseValue: base, scoredPoints: base };
  }
  if (rand < 0.95) {
    const base = rnd(1, 8);
    return { multiplier: "double", baseValue: base, scoredPoints: base * 2 };
  }
  return { multiplier: "single", baseValue: 25, scoredPoints: 25 };
}

// ── Gesamte KI-Runde ──────────────────────────────────────────────────────────

export function generateAITurn(
  rest: number,
  difficulty: AIDifficulty,
  allowSingleOut: boolean,
  allowDoubleOut: boolean,
  allowTripleOut: boolean,
): AITurnResult {
  const darts: AIDart[] = [];
  let remaining = rest;

  for (let i = 0; i < 3; i++) {
    const dart = throwDart(difficulty, remaining);
    const newRemaining = remaining - dart.scoredPoints;

    if (newRemaining < 0) {
      // Bust
      darts.push(dart);
      return { darts, isBust: true, isCheckout: false, newRest: rest };
    }

    if (newRemaining === 1 && !allowSingleOut) {
      // Kein Checkout möglich – Bust
      darts.push(dart);
      return { darts, isBust: true, isCheckout: false, newRest: rest };
    }

    if (newRemaining === 0) {
      const isBull = dart.baseValue === 25 && dart.multiplier === "single";
      const isBullseye = dart.baseValue === 25 && dart.multiplier === "double";
      let validCheckout =
        (allowSingleOut && (dart.multiplier === "single" || isBull || isBullseye)) ||
        (allowDoubleOut && (dart.multiplier === "double" || isBull || isBullseye)) ||
        (allowTripleOut && (dart.multiplier === "triple" || isBull || isBullseye));

      if (validCheckout) {
        darts.push(dart);
        return { darts, isBust: false, isCheckout: true, newRest: 0 };
      } else {
        // Falscher Checkout-Typ → Bust
        darts.push(dart);
        return { darts, isBust: true, isCheckout: false, newRest: rest };
      }
    }

    darts.push(dart);
    remaining = newRemaining;
  }

  return { darts, isBust: false, isCheckout: false, newRest: remaining };
}

// ── Labels & Anzeige ──────────────────────────────────────────────────────────

export const AI_DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy:   "Anfänger",
  medium: "Fortgeschrittener",
  hard:   "Profi",
};

export function getBotName(difficulty: AIDifficulty) {
  return `🤖 ${AI_DIFFICULTY_LABELS[difficulty]}`;
}
