'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface AudioContextType {
  playingSongId: string | null;
  requestPlay: (playerId: string) => void;
  notifyStop: (playerId: string) => void;
}

const AudioCtx = createContext<AudioContextType>({
  playingSongId: null,
  requestPlay: () => {},
  notifyStop: () => {},
});

export const useAudio = () => useContext(AudioCtx);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);

  const requestPlay = useCallback((playerId: string) => {
    setPlayingSongId(playerId);
  }, []);

  const notifyStop = useCallback((playerId: string) => {
    setPlayingSongId((prev) => (prev === playerId ? null : prev));
  }, []);

  return (
    <AudioCtx.Provider value={{ playingSongId, requestPlay, notifyStop }}>
      {children}
    </AudioCtx.Provider>
  );
}
