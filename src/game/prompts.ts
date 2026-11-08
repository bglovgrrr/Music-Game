/** How deep a question goes: 1 light, 2 warm, 3 deep. */
export type Depth = 1 | 2 | 3
export type Question = { text: string; depth: Depth }
export type Theme = { id: string; name: string; blurb: string; questions: Question[] }

export const DEPTH_LABEL: Record<Depth, string> = { 1: 'Light', 2: 'Warm', 3: 'Deep' }

const q = (depth: Depth, ...texts: string[]): Question[] => texts.map((text) => ({ text, depth }))

/**
 * Four question categories, each a different kind of question, named like places music
 * lives. Every category runs from light (easy, funny) to deep (personal, tender).
 * Ids stay stable so older games still show their category.
 */
export const THEMES: Theme[] = [
  {
    id: 'basement',
    name: 'Basement Sessions',
    blurb: 'This room, these friends, tonight.',
    questions: [
      ...q(1, 'The song that plays when this group walks in', "A song you'd make everyone here sing", "Your 1am, nobody-wants-to-leave song"),
      ...q(2, 'A song that reminds you of someone here', 'The song that sounds like this friend group', 'A song you only play for people you trust'),
      ...q(3, 'Your best memory with someone here, as a song', 'A song for the friend who got you through it', "A song you'd want us to remember you by"),
    ],
  },
  {
    id: 'throwback',
    name: 'Back Seat Radio',
    blurb: 'Growing up, first cars, long summers.',
    questions: [
      ...q(1, 'What was playing in your first car?', 'A song you wore out on repeat as a kid', 'The first album you ever owned'),
      ...q(2, 'The summer you were 16, as a song', 'A song always on in your house growing up', 'A song a parent or grandparent loved'),
      ...q(3, 'A song for who you used to be', "A song for a place that isn't there anymore", 'A song for someone you miss'),
    ],
  },
  {
    id: 'love',
    name: 'Slow Dance',
    blurb: 'Crushes, first dances, heartbreak.',
    questions: [
      ...q(1, "The song you'd put on to set the mood", 'Your first-crush song', "The song you'd want for a first dance"),
      ...q(2, 'Your ultimate breakup song', 'A song for someone you lost touch with', 'The most romantic song you know'),
      ...q(3, 'A love you never said out loud, as a song', 'A song that helped you get over someone', 'A song for how you love people'),
    ],
  },
  {
    id: 'deep',
    name: 'Headphones On',
    blurb: 'Just you and the song.',
    questions: [
      ...q(1, 'Your guilty pleasure, no shame', 'A song nobody here would guess you love', 'Your go-to pick-me-up song'),
      ...q(2, 'The theme song for your life right now', 'A song with a lyric you live by', 'A song you play when you need to be alone'),
      ...q(3, 'A song that got you through a hard time', 'A song that makes you cry every time', "A song you'd want played at your funeral"),
    ],
  },
]

export const ALL_PROMPTS = THEMES.flatMap((t) => t.questions.map((x) => ({ themeId: t.id, prompt: x.text, depth: x.depth })))

/** Category name for a round's theme id (undefined for your own questions or retired categories). */
export function themeName(id?: string) {
  return id ? THEMES.find((t) => t.id === id)?.name : undefined
}

/**
 * The questions to show for a category this round: one light, one warm, one deep, plus one
 * more, all unused if possible, ordered light to deep.
 */
export function dealQuestions(theme: Theme, used: Set<string>, rand: () => number = Math.random): Question[] {
  const fresh = theme.questions.filter((x) => !used.has(x.text))
  const pool = fresh.length >= 4 ? fresh : theme.questions
  const pickOne = (xs: Question[]) => xs[Math.floor(rand() * xs.length)]
  const hand: Question[] = []
  for (const d of [1, 2, 3] as Depth[]) {
    const options = pool.filter((x) => x.depth === d && !hand.includes(x))
    if (options.length) hand.push(pickOne(options))
  }
  const rest = pool.filter((x) => !hand.includes(x))
  while (hand.length < 4 && rest.length) hand.push(rest.splice(Math.floor(rand() * rest.length), 1)[0])
  return hand.sort((a, b) => a.depth - b.depth)
}
