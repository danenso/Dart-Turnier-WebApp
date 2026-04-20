'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// SVG-Koordinatensystem: Mittelpunkt (150,150), Radius bis ~145
const CX = 150, CY = 150;
const R_INNER_BULL  = 11;
const R_OUTER_BULL  = 21;
const R_TRIPLE_INNER = 87;
const R_TRIPLE_OUTER = 100;
const R_DOUBLE_INNER = 124;
const R_DOUBLE_OUTER = 137;
const R_BOARD        = 145; // Gesamtradius inkl. Außenring

const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function toXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function wedgePath(innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const p1 = toXY(startDeg, innerR);
  const p2 = toXY(endDeg,   innerR);
  const p3 = toXY(endDeg,   outerR);
  const p4 = toXY(startDeg, outerR);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

interface ThrowResult {
  x: number;   // SVG-Koordinaten
  y: number;
  dist: number; // Distanz vom Mittelpunkt (SVG-Einheiten)
}

interface Props {
  playerAId: string;
  playerBId: string;
  playerAName: string;
  playerBName: string;
  onDecide: (starterId: string) => void;
}

const DRAW_THRESHOLD = 3; // px SVG-Einheiten → Gleichstand

export function DartboardStarter({ playerAId, playerBId, playerAName, playerBName, onDecide }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState<'A' | 'B' | 'result'>('A');
  const [throwA, setThrowA] = useState<ThrowResult | null>(null);
  const [throwB, setThrowB] = useState<ThrowResult | null>(null);
  const [pending, setPending] = useState<ThrowResult | null>(null);

  const getSVGCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    // Skalierung: SVG viewBox 300×300 → tatsächliche Größe
    const svgX = ((clientX - rect.left) / rect.width)  * 300;
    const svgY = ((clientY - rect.top)  / rect.height) * 300;
    return { x: svgX, y: svgY };
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pending || phase === 'result') return;
    const coords = getSVGCoords(e);
    if (!coords) return;
    const dist = Math.sqrt((coords.x - CX) ** 2 + (coords.y - CY) ** 2);
    // Außerhalb der Scheibe → ignorieren
    if (dist > R_BOARD + 5) return;
    setPending({ x: coords.x, y: coords.y, dist });
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
      const diff = Math.abs(throwA!.dist - tB.dist);
      if (diff > DRAW_THRESHOLD) {
        // Wer näher dran ist (kleinere Distanz) beginnt
        onDecide(throwA!.dist < tB.dist ? playerAId : playerBId);
      }
      // diff <= threshold → Gleichstand, user muss retry klicken
    }
  };

  const retry = () => {
    setThrowA(null);
    setThrowB(null);
    setPending(null);
    setPhase('A');
  };

  const isDraw = phase === 'result' && throwA && throwB &&
    Math.abs(throwA.dist - throwB.dist) <= DRAW_THRESHOLD;

  // Distanz als prozentuale Angabe (0 = Bullseye, 100 = Außenrand)
  const distPct = (dist: number) => Math.min(100, Math.round((dist / R_BOARD) * 100));

  const distLabel = (t: ThrowResult) => {
    if (t.dist <= R_INNER_BULL)  return `Bullseye (${distPct(t.dist)}%)`;
    if (t.dist <= R_OUTER_BULL)  return `Bull (${distPct(t.dist)}%)`;
    return `${distPct(t.dist)}% vom Mittelpunkt`;
  };

  const currentName = phase === 'A' ? playerAName : playerBName;
  const currentColor = phase === 'A' ? '#3b82f6' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Spieler-Status */}
      <div className="flex items-center gap-3 text-sm font-medium">
        <span className={`px-3 py-1 rounded-full transition-all ${phase === 'A' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold' : throwA ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400'}`}>
          {playerAName}: {throwA ? distLabel(throwA) : '?'}
        </span>
        <span className="text-zinc-500">vs</span>
        <span className={`px-3 py-1 rounded-full transition-all ${phase === 'B' ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold' : throwB ? 'bg-red-500/10 text-red-400' : 'text-zinc-400'}`}>
          {playerBName}: {throwB ? distLabel(throwB) : '?'}
        </span>
      </div>

      {phase !== 'result' && (
        <>
          <p className="text-sm text-zinc-500 text-center">
            <span className="font-semibold" style={{ color: currentColor }}>{currentName}</span>
            {' '}— tippe genau wo du die Scheibe getroffen hast
          </p>

          {/* Dartboard SVG — klickbar */}
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox="0 0 300 300"
              width="300"
              height="300"
              className="select-none cursor-crosshair"
              style={{ touchAction: 'none' }}
              onClick={handleClick}
            >
              {/* Außenring */}
              <circle cx={CX} cy={CY} r="148" fill="#1a1a1a" />

              {/* Segmente */}
              {SEGMENT_ORDER.map((num, i) => {
                const startDeg = i * 18 - 9;
                const endDeg   = i * 18 + 9;
                const isEven   = i % 2 === 0;
                const labelPos = toXY(i * 18, R_DOUBLE_OUTER + 10);
                return (
                  <g key={num}>
                    <path d={wedgePath(R_OUTER_BULL, R_TRIPLE_INNER, startDeg, endDeg)}
                      fill={isEven ? '#e8d5b0' : '#1a1a1a'} stroke="#555" strokeWidth="0.5" />
                    <path d={wedgePath(R_TRIPLE_INNER, R_TRIPLE_OUTER, startDeg, endDeg)}
                      fill={isEven ? '#1e7a1e' : '#b01919'} stroke="#333" strokeWidth="0.5" />
                    <path d={wedgePath(R_TRIPLE_OUTER, R_DOUBLE_INNER, startDeg, endDeg)}
                      fill={isEven ? '#e8d5b0' : '#1a1a1a'} stroke="#555" strokeWidth="0.5" />
                    <path d={wedgePath(R_DOUBLE_INNER, R_DOUBLE_OUTER, startDeg, endDeg)}
                      fill={isEven ? '#1e7a1e' : '#b01919'} stroke="#333" strokeWidth="0.5" />
                    <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle"
                      fontSize="11" fontWeight="700" fill="#f5f5f5" className="pointer-events-none">
                      {num}
                    </text>
                  </g>
                );
              })}

              {/* Outer bull */}
              <circle cx={CX} cy={CY} r={R_OUTER_BULL} fill="#1e7a1e" stroke="#333" strokeWidth="1" />
              {/* Inner bull */}
              <circle cx={CX} cy={CY} r={R_INNER_BULL} fill="#b01919" stroke="#222" strokeWidth="1" />

              {/* Bereits geworfene Markierungen */}
              {throwA && (
                <circle cx={throwA.x} cy={throwA.y} r="7" fill="#3b82f6" stroke="white" strokeWidth="2"
                  className="pointer-events-none" opacity="0.85" />
              )}
              {throwB && (
                <circle cx={throwB.x} cy={throwB.y} r="7" fill="#ef4444" stroke="white" strokeWidth="2"
                  className="pointer-events-none" opacity="0.85" />
              )}

              {/* Pending-Markierung */}
              {pending && (
                <g className="pointer-events-none">
                  <circle cx={pending.x} cy={pending.y} r="9" fill={currentColor} stroke="white" strokeWidth="2.5" opacity="0.9" />
                  {/* Verbindungslinie zum Mittelpunkt */}
                  <line x1={CX} y1={CY} x2={pending.x} y2={pending.y}
                    stroke={currentColor} strokeWidth="1" opacity="0.4" strokeDasharray="4 3" />
                  {/* Mittelpunkt-Indikator */}
                  <circle cx={CX} cy={CY} r="3" fill={currentColor} opacity="0.6" />
                </g>
              )}

              {/* Ziel-Kreis am Mittelpunkt (Hinweis) */}
              {!pending && !throwA && !throwB && (
                <circle cx={CX} cy={CY} r="20" fill="none" stroke="white" strokeWidth="1"
                  strokeDasharray="3 3" opacity="0.2" className="pointer-events-none" />
              )}
            </svg>
          </div>

          {/* Bestätigung */}
          {pending ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-center">
                <div className="text-lg font-bold" style={{ color: currentColor }}>
                  {distLabel(pending)}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  Distanz: {pending.dist.toFixed(1)} px vom Mittelpunkt
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="sm" onClick={confirmThrow}>Bestätigen ✓</Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Nochmal</Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400">
              Tippe auf die Dartscheibe — wer näher an der Mitte liegt, beginnt
            </p>
          )}
        </>
      )}

      {/* Ergebnis */}
      {phase === 'result' && throwA && throwB && (
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Vergleichs-Anzeige */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span className="text-sm font-semibold">{playerAName}</span>
              <span className="text-2xl font-black">{distPct(throwA.dist)}%</span>
              <span className="text-xs text-zinc-400">{throwA.dist.toFixed(1)} px</span>
            </div>
            <div className="text-zinc-400 text-lg font-bold">vs</div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-sm font-semibold">{playerBName}</span>
              <span className="text-2xl font-black">{distPct(throwB.dist)}%</span>
              <span className="text-xs text-zinc-400">{throwB.dist.toFixed(1)} px</span>
            </div>
          </div>

          {isDraw ? (
            <>
              <p className="text-lg font-bold text-amber-500">Zu nah dran — Gleichstand!</p>
              <p className="text-sm text-zinc-400">Beide müssen nochmal werfen</p>
              <Button onClick={retry}>Nochmal werfen</Button>
            </>
          ) : (
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              {throwA.dist < throwB.dist ? playerAName : playerBName} beginnt!
              <span className="text-sm font-normal text-zinc-400 ml-2">(näher an der Mitte)</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
