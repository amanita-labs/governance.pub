import { useCallback, useEffect, useMemo, useRef } from 'react';
import { farmSounds, type FarmSound, type FarmSoundId } from '@/lib/audio/farmSounds';

const MIN_INTERVAL_MS = 180;
const sharedAudioMap = new Map<FarmSoundId, HTMLAudioElement>();

interface UseFarmSoundsOptions {
  /** Clamp how loud the samples should play. */
  volume?: number;
  /** Optional deterministic seed for picking the initial sound. */
  seed?: number;
}

interface UseFarmSoundsResult {
  playRandom: () => void;
  playById: (id: FarmSoundId) => void;
  sounds: readonly FarmSound[];
}

export function useFarmSounds(options: UseFarmSoundsOptions = {}): UseFarmSoundsResult {
  const { volume = 0.6, seed } = options;
  const audioMapRef = useRef<Map<FarmSoundId, HTMLAudioElement>>(sharedAudioMap);
  const lastPlayRef = useRef<number>(0);
  const lastSoundIndexRef = useRef<number | null>(null);

  const orderedSounds = useMemo(() => {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
      const index = Math.abs(Math.floor(seed)) % farmSounds.length;
      return [...farmSounds.slice(index), ...farmSounds.slice(0, index)];
    }
    return farmSounds;
  }, [seed]);

  useEffect(() => {
    const audioMap = audioMapRef.current;

    orderedSounds.forEach((sound) => {
      if (!audioMap.has(sound.id)) {
        const audio = new Audio(sound.src);
        audio.preload = 'auto';
        audio.volume = Math.max(0, Math.min(1, volume));
        audioMap.set(sound.id, audio);
      } else {
        const audio = audioMap.get(sound.id);
        if (audio) {
          audio.volume = Math.max(0, Math.min(1, volume));
        }
      }
    });

    return () => {
      // Do not dispose survivors; allow reuse between component mounts.
    };
  }, [orderedSounds, volume]);

  const playSound = useCallback(
    (id: FarmSoundId) => {
      const now = performance.now();
      if (now - lastPlayRef.current < MIN_INTERVAL_MS) {
        return;
      }

      const audio = audioMapRef.current.get(id);
      if (!audio) {
        return;
      }

      audio.currentTime = 0;
      void audio.play().catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[farm-sounds] Failed to play clip', id, error);
        }
      });

      lastPlayRef.current = now;
    },
    []
  );

  const playRandom = useCallback(() => {
    if (!orderedSounds.length) {
      return;
    }

    const nextIndex = (() => {
      if (orderedSounds.length === 1) {
        return 0;
      }

      const previousIndex = lastSoundIndexRef.current;
      let index = Math.floor(Math.random() * orderedSounds.length);

      if (previousIndex != null && index === previousIndex) {
        index = (index + 1) % orderedSounds.length;
      }
      return index;
    })();

    lastSoundIndexRef.current = nextIndex;
    playSound(orderedSounds[nextIndex].id);
  }, [orderedSounds, playSound]);

  const playById = useCallback(
    (id: FarmSoundId) => {
      const index = orderedSounds.findIndex((sound) => sound.id === id);
      if (index >= 0) {
        lastSoundIndexRef.current = index;
        playSound(id);
      }
    },
    [orderedSounds, playSound]
  );

  return useMemo(
    () => ({
      playRandom,
      playById,
      sounds: orderedSounds,
    }),
    [orderedSounds, playById, playRandom]
  );
}

