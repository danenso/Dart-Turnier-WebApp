// Draw-Regel: greift automatisch bei Best-of-1
export interface DrawRule {
  enabled: boolean;
}

export const DEFAULT_DRAW_RULE: DrawRule = { enabled: false };

// Wer beginnt Leg 1?
export type MatchStartRule =
  | 'manual'       // Spieler wählen aus
  | 'bull-throw';  // 1 Pfeil auf Bull, näher dran beginnt

export interface MatchStartConfig {
  firstLeg: MatchStartRule;
}

export const DEFAULT_MATCH_START: MatchStartConfig = {
  firstLeg: 'manual',
};

export const MATCH_START_LABELS: Record<MatchStartRule, string> = {
  'manual':     'Spieler wählen aus',
  'bull-throw': 'Bull-Wurf (1 Pfeil, näher = Anfang)',
};
