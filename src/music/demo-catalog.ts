import type { Track } from '@/game/types'

// Offline fallback catalog. Used when live search isn't reachable
// (for example inside sandboxed previews). No audio: playback is simulated.
const RAW: [string, string, number][] = [
  ['Bohemian Rhapsody', 'Queen', 8],
  ["Don't Stop Believin'", 'Journey', 210],
  ['Mr. Brightside', 'The Killers', 350],
  ['Dancing Queen', 'ABBA', 320],
  ['Smells Like Teen Spirit', 'Nirvana', 50],
  ['Hey Ya!', 'OutKast', 40],
  ['Africa', 'Toto', 25],
  ['Rolling in the Deep', 'Adele', 200],
  ['Landslide', 'Fleetwood Mac', 30],
  ['September', 'Earth, Wind & Fire', 15],
  ['Wonderwall', 'Oasis', 220],
  ['Billie Jean', 'Michael Jackson', 280],
  ['Take On Me', 'a-ha', 190],
  ['Juicy', 'The Notorious B.I.G.', 0],
  ['Fast Car', 'Tracy Chapman', 160],
  ['Mo Money Mo Problems', 'The Notorious B.I.G.', 45],
  ['Since U Been Gone', 'Kelly Clarkson', 330],
  ['Yellow', 'Coldplay', 55],
  ['Halo', 'Beyoncé', 42],
  ['Sweet Caroline', 'Neil Diamond', 12],
  ['Hallelujah', 'Jeff Buckley', 230],
  ["Sweet Child O' Mine", "Guns N' Roses", 5],
  ['Hotel California', 'Eagles', 35],
  ['Lose Yourself', 'Eminem', 0],
  ['Rocket Man', 'Elton John', 260],
  ['Dreams', 'Fleetwood Mac', 300],
  ['Uptown Funk', 'Mark Ronson ft. Bruno Mars', 20],
  ['Valerie', 'Amy Winehouse', 340],
  ['Here Comes the Sun', 'The Beatles', 48],
  ['I Will Always Love You', 'Whitney Houston', 315],
  ['Ms. Jackson', 'OutKast', 270],
  ['Stand By Me', 'Ben E. King', 200],
  ['Somebody That I Used to Know', 'Gotye', 180],
  ['Mamma Mia', 'ABBA', 330],
  ['No Scrubs', 'TLC', 290],
  ['Bitter Sweet Symphony', 'The Verve', 240],
  ['Teenage Dream', 'Katy Perry', 310],
  ['Blinding Lights', 'The Weeknd', 0],
  ['Cruel Summer', 'Taylor Swift', 300],
  ['Get Lucky', 'Daft Punk', 45],
  ["Free Fallin'", 'Tom Petty', 30],
  ['Crazy in Love', 'Beyoncé', 25],
  ['Vienna', 'Billy Joel', 210],
  ['Let It Be', 'The Beatles', 40],
  ['Gold Digger', 'Kanye West', 35],
  ['Everybody Wants to Rule the World', 'Tears for Fears', 195],
]

export const DEMO_CATALOG: Track[] = RAW.map(([title, artist, hue], i) => ({
  id: `demo_${i}`,
  title,
  artist,
  hue,
  durationMs: 30_000,
  source: 'demo',
}))

export function searchDemoCatalog(query: string): Track[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return DEMO_CATALOG.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q))
}
