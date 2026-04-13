'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudio } from './AudioProvider';
import { Pause, Play, Music2 } from 'lucide-react';

interface SongPlayerProps {
  playerId: string;
  songUrl: string;
  songTitle: string;
  songArtist: string;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SongPlayer({ playerId, songUrl, songTitle, songArtist }: SongPlayerProps) {
  const { playingSongId, requestPlay, notifyStop } = useAudio();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const isActive = playingSongId === playerId;

  // Audio-Element initialisieren
  useEffect(() => {
    const audio = new Audio(songUrl);
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => notifyStop(playerId);
    const onLoadStart = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, [songUrl, playerId, notifyStop]);

  // Anderen Song stoppen wenn dieser aktiv wird / inaktiv wird
  useEffect(() => {
    if (!audioRef.current) return;
    if (!isActive) {
      audioRef.current.pause();
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isActive) {
      audioRef.current.pause();
      notifyStop(playerId);
    } else {
      requestPlay(playerId);
      audioRef.current.play();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 w-full">
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-80 transition-opacity disabled:opacity-50"
        title={isActive ? 'Pausieren' : 'Abspielen'}
      >
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-white dark:border-zinc-900 border-t-transparent rounded-full animate-spin" />
        ) : isActive ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Music2 className="w-3 h-3 shrink-0 text-zinc-500" />
          <span className="truncate text-zinc-900 dark:text-zinc-100">{songTitle}</span>
          {songArtist && (
            <span className="text-zinc-400 shrink-0 truncate">· {songArtist}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 cursor-pointer accent-zinc-900 dark:accent-white"
          />
          <span className="text-xs text-zinc-400 tabular-nums shrink-0">
            {formatTime(currentTime)}&nbsp;/&nbsp;{formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
