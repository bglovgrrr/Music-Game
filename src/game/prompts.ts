export type Theme = { id: string; name: string; prompts: string[] }

export const THEMES: Theme[] = [
  {
    id: 'throwback',
    name: 'Throwback',
    prompts: [
      'Pick a song that reminds you of high school',
      'What song takes you back to the summer you were 16?',
      'A song from the first concert you ever went to',
      'What was playing in your first car?',
      'A song you wore out on repeat as a kid',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    prompts: [
      'What song reminds you of your dad?',
      'What song reminds you of your mom?',
      'A song that was always on at family gatherings',
      'A song a grandparent loved',
      'A song you and a sibling would sing together',
    ],
  },
  {
    id: 'love',
    name: 'Love & heartbreak',
    prompts: [
      'A song that reminds you of your first crush',
      'Your ultimate breakup song',
      'A song you would want at your wedding',
      'A song that makes you think of someone you lost touch with',
      'The most romantic song you know',
    ],
  },
  {
    id: 'hype',
    name: 'Hype',
    prompts: [
      'Your go-to pump-up song',
      'Your karaoke song, no shame',
      'Your biggest guilty pleasure song',
      'A song that always gets you on the dance floor',
      'A song you would walk out to in a stadium',
    ],
  },
  {
    id: 'deep',
    name: 'Deep cuts',
    prompts: [
      'A song that got you through a hard time',
      'A song that changed how you see the world',
      'A song that makes you cry every single time',
      'A song with a lyric you live by',
      'A song you think everyone here should hear',
    ],
  },
  {
    id: 'places',
    name: 'Places',
    prompts: [
      'The perfect road trip song',
      'A song that reminds you of a specific city',
      'A song for a rainy day',
      'A song that sounds like summer',
      'A song that reminds you of a trip you took',
    ],
  },
  {
    id: 'wild',
    name: 'Wildcard',
    prompts: [
      'The theme song for your life right now',
      'A song that describes this friend group',
      'A song you would want played at your funeral',
      'A song you secretly know every word to',
      'A song that reminds you of someone in this room',
    ],
  },
]

export const ALL_PROMPTS = THEMES.flatMap((t) => t.prompts.map((p) => ({ themeId: t.id, prompt: p })))
