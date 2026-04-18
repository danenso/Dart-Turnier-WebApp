'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

// Dartboard-Reihenfolge (im Uhrzeigersinn, beginnend oben)
const SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const SEGMENT_COUNT = 20;
const SEGMENT_DEG = 360 / SEGMENT_COUNT; // 18°

// Farben (alternierend wie echte Dartscheibe)
const COLORS_EVEN = { bg: '#1a1a1a', text: '#f5f5f5' };
const COLORS_ODD  = { bg: '#e8d5b0', text: '#1a1a1a' };

interface SpinWheelProps {
  targetNumber: number;   // 1–20, vom System vorgegeben
  onComplete: () => void; // Callback wenn Bestätigen geklickt
  size?: number;          // Default 280
}

function getSegmentAngle(num: number): number {
  const idx = SEGMENT_ORDER.indexOf(num);
  // Mitte des Segments: idx * 18° (Segment 0 = 20 ist ganz oben = 0°)
  return idx * SEGMENT_DEG;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(cx: number, cy: number, innerR: number, outerR: number, startDeg: number, endDeg: number) {
  const p1 = polarToXY(cx, cy, innerR, startDeg);
  const p2 = polarToXY(cx, cy, innerR, endDeg);
  const p3 = polarToXY(cx, cy, outerR, endDeg);
  const p4 = polarToXY(cx, cy, outerR, startDeg);
  return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${innerR} ${innerR} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${outerR} ${outerR} 0 0 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
}

export function SpinWheel({ targetNumber, onComplete, size = 280 }: SpinWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const spinRef = useRef(false);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size / 2) - 8;
  const innerR = outerR * 0.18; // Bullseye-Bereich

  const spin = () => {
    if (spinRef.current) return;
    spinRef.current = true;
    setSpinning(true);

    // Ziel: Segment des targetNumber zeigt nach oben (0°)
    // Das Segment-Zentrum liegt bei getSegmentAngle(targetNumber)°
    // Damit es nach oben zeigt, muss das Rad um -segmentAngle rotieren
    const targetAngle = getSegmentAngle(targetNumber);
    // Mehrere volle Umdrehungen + Endposition
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5–7 Umdrehungen
    const finalRotation = fullSpins * 360 + (360 - targetAngle);

    setRotation(finalRotation);

    setTimeout(() => {
      setSpinning(false);
      setDone(true);
    }, 3500);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-zinc-500">
        Zielzahl für diesen Tiebreak wird ausgelost
      </p>

      {/* Zeiger oben */}
      <div className="relative" style={{ width: size, height: size + 20 }}>
        {/* Pfeil-Zeiger */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-10"
          style={{ top: 0 }}
        >
          <svg width="20" height="28" viewBox="0 0 20 28">
            <polygon points="10,0 20,20 10,14 0,20" fill="#ef4444" />
          </svg>
        </div>

        {/* Rad */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            width: size,
            height: size,
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)`
              : 'none',
          }}
        >
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
            {/* Hintergrund */}
            <circle cx={cx} cy={cy} r={outerR + 4} fill="#111" />

            {/* Segmente */}
            {SEGMENT_ORDER.map((num, i) => {
              const startDeg = i * SEGMENT_DEG - SEGMENT_DEG / 2;
              const endDeg   = i * SEGMENT_DEG + SEGMENT_DEG / 2;
              const isEven   = i % 2 === 0;
              const colors   = isEven ? COLORS_EVEN : COLORS_ODD;
              const labelPos = polarToXY(cx, cy, outerR * 0.75, i * SEGMENT_DEG);
              const isTarget = num === targetNumber;

              return (
                <g key={num}>
                  <path
                    d={segmentPath(cx, cy, innerR, outerR, startDeg, endDeg)}
                    fill={isTarget && done ? '#f59e0b' : colors.bg}
                    stroke="#333"
                    strokeWidth="0.5"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={size * 0.05}
                    fontWeight="700"
                    fill={isTarget && done ? '#1a1a1a' : colors.text}
                    className="pointer-events-none select-none"
                  >
                    {num}
                  </text>
                </g>
              );
            })}

            {/* Bull */}
            <circle cx={cx} cy={cy} r={innerR} fill="#b01919" stroke="#222" strokeWidth="1" />
            <circle cx={cx} cy={cy} r={innerR * 0.45} fill="#1e7a1e" stroke="#111" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Ergebnis-Anzeige */}
      {done && (
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500">
          <div className="text-5xl font-black text-amber-500">
            {targetNumber}
          </div>
          <p className="text-sm text-zinc-500">
            Zielzahl für diesen Tiebreak
          </p>
          <Button onClick={onComplete} className="mt-1">
            Bestätigen & Reihenfolge festlegen
          </Button>
        </div>
      )}

      {!spinning && !done && (
        <Button onClick={spin} size="lg">
          Rad drehen
        </Button>
      )}

      {spinning && (
        <p className="text-sm text-zinc-400 animate-pulse">Dreht sich…</p>
      )}
    </div>
  );
}
