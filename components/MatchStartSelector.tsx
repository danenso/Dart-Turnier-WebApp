'use client';

import {
  MatchStartConfig,
  MatchStartRule,
  MATCH_START_LABELS,
  DEFAULT_MATCH_START,
} from '@/lib/match-rules';

interface MatchStartSelectorProps {
  value: MatchStartConfig;
  onChange: (config: MatchStartConfig) => void;
}

const FIRST_LEG_OPTIONS: MatchStartRule[] = ['bull-throw', 'coin-flip', 'manual'];
const SUBSEQUENT_OPTIONS: MatchStartRule[] = ['loser-starts', 'winner-starts', 'bull-throw', 'coin-flip'];

export function MatchStartSelector({ value, onChange }: MatchStartSelectorProps) {
  return (
    <div className="space-y-4">
      {/* Erstes Leg */}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Erstes Leg
        </p>
        <div className="space-y-2">
          {FIRST_LEG_OPTIONS.map((rule) => (
            <label key={rule} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="firstLeg"
                value={rule}
                checked={value.firstLeg === rule}
                onChange={() => onChange({ ...value, firstLeg: rule })}
                className="mt-0.5 accent-primary"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {MATCH_START_LABELS[rule]}
                {rule === 'coin-flip' && (
                  <span className="block text-xs text-zinc-400 mt-0.5">
                    App entscheidet zufällig beim Match-Start
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Folge-Legs */}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Folge-Legs
        </p>
        <div className="space-y-2">
          {SUBSEQUENT_OPTIONS.map((rule) => (
            <label key={rule} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="subsequentLegs"
                value={rule}
                checked={value.subsequentLegs === rule}
                onChange={() => onChange({ ...value, subsequentLegs: rule })}
                className="mt-0.5 accent-primary"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                {MATCH_START_LABELS[rule]}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
