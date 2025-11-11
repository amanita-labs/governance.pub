export type FarmSoundId = 'baa' | 'moo' | 'cluck' | 'oink' | 'neigh';

export interface FarmSound {
  id: FarmSoundId;
  src: string;
  label: string;
}

export const farmSounds: FarmSound[] = [
  { id: 'baa', src: '/audio/baa.wav', label: 'Sheep bleat' },
  { id: 'moo', src: '/audio/moo.wav', label: 'Cow moo' },
  { id: 'cluck', src: '/audio/cluck.wav', label: 'Chicken cluck' },
  { id: 'oink', src: '/audio/oink.wav', label: 'Pig oink' },
  { id: 'neigh', src: '/audio/neigh.wav', label: 'Horse neigh' },
] as const;

const farmSoundMap = new Map<FarmSoundId, FarmSound>(farmSounds.map((sound) => [sound.id, sound]));

export const getFarmSound = (id: FarmSoundId): FarmSound => {
  const sound = farmSoundMap.get(id);
  if (!sound) {
    throw new Error(`Unknown farm sound id: ${id}`);
  }
  return sound;
};

export const getRandomFarmSound = (seed?: number): FarmSound => {
  if (!farmSounds.length) {
    throw new Error('No farm sounds have been registered.');
  }

  if (typeof seed === 'number' && Number.isFinite(seed)) {
    const index = Math.abs(Math.floor(seed)) % farmSounds.length;
    return farmSounds[index];
  }

  const index = Math.floor(Math.random() * farmSounds.length);
  return farmSounds[index];
};

