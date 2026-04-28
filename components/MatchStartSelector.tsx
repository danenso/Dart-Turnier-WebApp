'use client';

import {
  MatchStartConfig,
  MatchStartRule,
  MATCH_START_LABELS,
} from '@/lib/match-rules';

interface MatchStartSelectorProps {
  value: MatchStartConfig;
  onChange: (config: MatchStartConfig) => void;
}

const FIRST_LEG_OPTIONS: MatchStartRule[] = ['manual', 'bull-throw'];

export function MatchStartSelector({ value, onChange }: MatchStartSelectorProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        Erstes Leg
      </p>
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
          </span>
        </label>
      ))}
      <p className="text-xs text-zinc-400 dark:text-zinc-500 pt-1">
        Folge-Legs wechseln automatisch — wer Leg 1 beginnt, beginnt Leg 2 als zweiter.
      </p>
    </div>
  );
}
