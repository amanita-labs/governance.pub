export interface WoolyQuote {
  id: string;
  text: string;
  author?: string;
  context?: string;
  mood?: 'cheeky' | 'inspirational' | 'reassuring' | 'playful';
}

export const woolyQuotes: WoolyQuote[] = [
  {
    id: 'flock-focus',
    text: 'Every great governance decision starts with a well-groomed plan and a patient flock.',
    author: 'Grandma Ewe-nice',
    mood: 'inspirational',
  },
  {
    id: 'counting-votes',
    text: 'Counting votes is just like counting sheep—except the sheep politely explain their rationale.',
    author: 'The Pasture Parliament',
    mood: 'playful',
  },
  {
    id: 'wool-over-eyes',
    text: 'Transparency keeps the wool from covering our eyes and the protocol from hitting a fence.',
    author: 'Cardano Farm Almanac',
    context: 'On open governance',
  },
  {
    id: 'delegate-dreams',
    text: 'Delegate wisely and your dreams will be as cozy as a freshly knitted cardigan.',
    author: 'Sleepless Stake Pooler',
    mood: 'reassuring',
  },
  {
    id: 'meadow-moments',
    text: 'Take a breath, sip some chamomile, and remember: the meadow is wide enough for every voice.',
    author: 'Councillor Cloudburst',
    mood: 'cheeky',
  },
  {
    id: 'woolniverse',
    text: 'In the Woolniverse, every token has a story—tell yours with care and a dash of sparkle.',
    author: 'Captain Cosmo-Sheep',
    context: 'On community storytelling',
    mood: 'playful',
  },
  {
    id: 'epoch-exhale',
    text: 'The chain never sleeps, but you should—rested minds build resilient governance.',
    author: 'Epoch Whisperer',
    mood: 'reassuring',
  },
  {
    id: 'fleece-release',
    text: 'Great ideas are like freshly shorn fleece: a little unruly at first, but ready to be woven into something lasting.',
    author: 'Weaver of Votes',
    mood: 'inspirational',
  },
];

export const getRandomWoolyQuote = (seed?: number): WoolyQuote => {
  if (!woolyQuotes.length) {
    return {
      id: 'default-wooly',
      text: 'The flock is momentarily silent, but the meadow still hums with possibility.',
      author: 'GovtWool',
      mood: 'reassuring',
    };
  }

  if (typeof seed === 'number') {
    const index = Math.abs(Math.floor(seed)) % woolyQuotes.length;
    return woolyQuotes[index];
  }

  const index = Math.floor(Math.random() * woolyQuotes.length);
  return woolyQuotes[index];
};


