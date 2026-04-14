'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const CX = 150, CY = 150;
const R_INNER_BULL = 11;
const R_OUTER_BULL = 21;
const R_TRIPLE_INNER = 87;
const R_TRIPLE_OUTER = 100;
const R_DOUBLE_INNER = 124;
const R_DOUBLE_OUTER = 137;

function toXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function wedgePath(innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const p1 = toXY(startDeg, innerR);
  const p2 = toXY(endDeg, innerR);
  const p3 = toXY(endDeg, outerR);
  const p4 = toXY(startDeg, outerR);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

interface ThrowResult {
  score: number;
  label: string;
}

interface Props {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  onDecide: (starterId: string) => void;
}

export function DartboardStarter({ playerAId, playerBId, playerAName, playerBName, onDecide }: Props) {
  const [phase, setPhase] = useState<'A' | 'B' | 'result'>('A');
  const [throwA, setThrowA] = useState<ThrowResult | null>(null);
  const [throwB, setThrowB] = useState<ThrowResult | null>(null);
  const [pending, setPending] = useState<ThrowResult | null>(null);

  const handleThrow = (score: number, label: string) => {
    if (pending) return; // already threw this turn, wait for confirm
    setPending({ score, label });
  };

  const confirmThrow = () => {
    if (!pending) return;
    if (phase === 'A') {
      setThrowA(pending);
      setPending(null);
      setPhase('B');
    } else {
      const tB = pending;
      setThrowB(tB);
      setPending(null);
      setPhase('result');
      // determine winner
      const scoreA = throwA!.score;
      const scoreB = tB.score;
      if (scoreA !== scoreB) {
        onDecide(scoreA > scoreB ? playerAId : playerBId);
      }
      // if draw: show result, let user retry
    }
  };

  const retry = () => {
    setThrowA(null);
    setThrowB(null);
    setPending(null);
    setPhase('A');
  };

  const currentName = phase === 'A' ? playerAName : playerBName;
  const isDraw = phase === 'result' && throwA && throwB && throwA.score === throwB.score;

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Phase indicator */}
      <div className="flex items-center gap-3 text-sm font-medium">
        <span className={`px-3 py-1 rounded-full transition-all ${phase === 'A' || phase === 'result' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'text-zinc-400'}`}>
          {playerAName}: {throwA ? throwA.label : '?'}
        </span>
        <span className="text-zinc-500">vs</span>
        <span className={`px-3 py-1 rounded-full transition-all ${phase === 'B' || phase === 'result' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'text-zinc-400'}`}>
          {playerBName}: {throwB ? throwB.label : '?'}
        </span>
      </div>

      {phase !== 'result' && (
        <>
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{currentName}</span> wirft — tippe wo du getroffen hast
          </p>

          {/* Dartboard SVG */}
          <div className="relative">
            <svg
              viewBox="0 0 300 300"
              width="280"
              height="280"
              className="select-none"
              style={{ touchAction: 'manipulation' }}
            >
              {/* Black outer rim */}
              <circle cx={CX} cy={CY} r="145" fill="#1a1a1a" />

              {/* Segments */}
              {SEGMENT_ORDER.map((num, i) => {
                const startDeg = i * 18 - 9;
                const endDeg = i * 18 + 9;
                const isEven = i % 2 === 0;
                const labelPos = toXY(i * 18, R_DOUBLE_OUTER + 10);

                return (
                  <g key={num}>
                    {/* Single area (inner) */}
                    <path
                      d={wedgePath(R_OUTER_BULL, R_TRIPLE_INNER, startDeg, endDeg)}
                      fill={isEven ? '#e8d5b0' : '#1a1a1a'}
                      stroke="#555" strokeWidth="0.5"
                      onClick={() => handleThrow(num, String(num))}
                      className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
                    />
                    {/* Triple ring */}
                    <path
                      d={wedgePath(R_TRIPLE_INNER, R_TRIPLE_OUTER, startDeg, endDeg)}
                      fill={isEven ? '#1e7a1e' : '#b01919'}
                      stroke="#333" strokeWidth="0.5"
                      onClick={() => handleThrow(num * 3, `T${num}`)}
                      className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
                    />
                    {/* Single area (outer) */}
                    <path
                      d={wedgePath(R_TRIPLE_OUTER, R_DOUBLE_INNER, startDeg, endDeg)}
                      fill={isEven ? '#e8d5b0' : '#1a1a1a'}
                      stroke="#555" strokeWidth="0.5"
                      onClick={() => handleThrow(num, String(num))}
                      className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
                    />
                    {/* Double ring */}
                    <path
                      d={wedgePath(R_DOUBLE_INNER, R_DOUBLE_OUTER, startDeg, endDeg)}
                      fill={isEven ? '#1e7a1e' : '#b01919'}
                      stroke="#333" strokeWidth="0.5"
                      onClick={() => handleThrow(num * 2, `D${num}`)}
                      className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
                    />
                    {/* Number label */}
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontWeight="700"
                      fill={pending || false ? '#6b7280' : '#f5f5f5'}
                      className="pointer-events-none"
                    >
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Outer bull */}
              <circle
                cx={CX} cy={CY} r={R_OUTER_BULL}
                fill="#1e7a1e" stroke="#333" strokeWidth="1"
                onClick={() => handleThrow(25, '25')}
                className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
              />
              {/* Inner bull */}
              <circle
                cx={CX} cy={CY} r={R_INNER_BULL}
                fill="#b01919" stroke="#222" strokeWidth="1"
                onClick={() => handleThrow(50, 'Bull')}
                className="cursor-pointer hover:brightness-125 active:brightness-150 transition-all"
              />

              {/* Highlight pending throw */}
              {pending && (
                <circle cx={CX} cy={CY} r="148" fill="none" stroke="#3b82f6" strokeWidth="4" opacity="0.6" className="pointer-events-none" />
              )}
            </svg>

            {/* Miss button */}
            <button
              onClick={() => handleThrow(0, 'Miss')}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Miss (0)
            </button>
          </div>

          {/* Pending throw confirmation */}
          {pending ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-zinc-900 dark:text-white">{pending.label}</span>
              <span className="text-zinc-400 text-sm">= {pending.score} Punkte</span>
              <Button size="sm" onClick={confirmThrow} className="ml-2">Bestätigen</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Nochmal</Button>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Tippe auf die Dartscheibe</p>
          )}
        </>
      )}

      {/* Result */}
      {phase === 'result' && throwA && throwB && (
        <div className="flex flex-col items-center gap-3 text-center">
          {isDraw ? (
            <>
              <p className="text-lg font-bold text-amber-500">Gleichstand! ({throwA.label} = {throwB.label})</p>
              <p className="text-sm text-zinc-400">Beide müssen nochmal werfen</p>
              <Button onClick={retry}>Nochmal werfen</Button>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-zinc-900 dark:text-white">
                {throwA.score > throwB.score ? playerAName : playerBName} beginnt!
              </p>
              <p className="text-sm text-zinc-400">
                {playerAName}: {throwA.label} ({throwA.score}) · {playerBName}: {throwB.label} ({throwB.score})
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
