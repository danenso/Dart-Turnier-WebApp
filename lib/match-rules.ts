// Draw-Regel: greift automatisch bei Best-of-1
export interface DrawRule {
  enabled: boolean;
}

export const DEFAULT_DRAW_RULE: DrawRule = { enabled: false };

// Wer beginnt?
export type MatchStartRule =
  | 'bull-throw'    // 1 Pfeil auf Bull, näher dran beginnt
  | 'coin-flip'     // Münzwurf (App entscheidet zufällig)
  | 'manual'        // Veranstalter wählt manuell
  | 'winner-starts' // Leg-Sieger beginnt nächstes Leg
  | 'loser-starts'; // Leg-Verlierer beginnt nächstes Leg (PDC-Standard)

export interface MatchStartConfig {
  firstLeg: MatchStartRule;
  subsequentLegs: MatchStartRule;
}

export const DEFAULT_MATCH_START: MatchStartConfig = {
  firstLeg: 'bull-throw',
  subsequentLegs: 'loser-starts',
};

export const MATCH_START_LABELS: Record<MatchStartRule, string> = {
  'bull-throw':    'Bull-Wurf (1 Pfeil, näher = Anfang)',
  'coin-flip':     'Münzwurf (App entscheidet zufällig)',
  'manual':        'Veranstalter legt fest',
  'winner-starts': 'Sieger des Legs beginnt',
  'loser-starts':  'Verlierer des Legs beginnt (PDC)',
};
