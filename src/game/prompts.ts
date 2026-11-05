export type Theme = { id: string; name: string; prompts: string[] }

/**
 * Question topics, named like moments and places music lives in
 * (in the spirit of "Basement Sessions"). Ids stay stable for older games.
 */
export const THEMES: Theme[] = [
  {
    id: 'basement',
    name: 'Basement Sessions',
    prompts: [
      'A song that sounds like this room right now',
      "It's 1am and nobody wants to leave. What goes on next?",
      'A song you only play for people you trust',
      'A song that reminds you of someone in this room',
      'The theme song for this friend group',
    ],
  },
  {
    id: 'throwback',
    name: 'Back Seat Radio',
    prompts: [
      'What was playing in your first car?',
      'What song takes you back to the summer you were 16?',
      'A song from the first concert you ever went to',
      'A song you wore out on repeat as a kid',
      "The song you'd fight for the aux to play on a road trip",
    ],
  },
  {
    id: 'family',
    name: 'Kitchen Radio',
    prompts: [
      'A song that was always on in your house growing up',
      'What song reminds you of your mom?',
      'What song reminds you of your dad?',
      'A song a grandparent loved',
      'A song you and a sibling would sing together',
    ],
  },
  {
    id: 'love',
    name: 'Slow Dance',
    prompts: [
      'A song that reminds you of your first crush',
      'Your ultimate breakup song',
      "The song you'd want for a first dance",
      'A song for someone you lost touch with',
      'The most romantic song you know',
    ],
  },
  {
    id: 'hype',
    name: 'Front Row',
    prompts: [
      'Your go-to pump-up song',
      'Your karaoke song, no shame',
      "The guilty pleasure you'd defend to the end",
      'A song that always gets you on the dance floor',
      "The song you'd walk out to in a stadium",
    ],
  },
  {
    id: 'deep',
    name: 'Headphones On',
    prompts: [
      'A song that got you through a hard time',
      'A song that makes you cry every single time',
      'A song with a lyric you live by',
      'A song that changed how you see the world',
      'A song you play when you need to be alone',
    ],
  },
  {
    id: 'places',
    name: 'Window Seat',
    prompts: [
      'A song for a rainy day',
      'A song that sounds like summer',
      'A song that reminds you of a specific city',
      'A song that reminds you of a trip you took',
      'The soundtrack to a long walk home at night',
    ],
  },
  {
    id: 'wild',
    name: 'B-Sides',
    prompts: [
      'The theme song for your life right now',
      'A song you secretly know every word to',
      "A song you'd want played at your funeral",
      'A song nobody here would guess you love',
      "A song you'd put on a mixtape for your younger self",
    ],
  },
]

export const ALL_PROMPTS = THEMES.flatMap((t) => t.prompts.map((p) => ({ themeId: t.id, prompt: p })))

/** Topic name for a round's theme id (undefined for your own questions). */
export function themeName(id?: string) {
  return id ? THEMES.find((t) => t.id === id)?.name : undefined
}
