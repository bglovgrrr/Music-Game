# Side B

**Every song has a story.**

Side B is a relaxed music game for 2–8 friends in the same room. Someone asks a question, everyone secretly answers with a song, and then you listen to each one together and talk about why it was picked.

**▶ Play: [music-game-virid.vercel.app](https://music-game-virid.vercel.app)**

> **Status:** live on Vercel, backed by Supabase. Not yet played in a real game with friends.

## How a game works

1. **Ask.** The asker writes a question or picks one from a theme, such as *"What song reminds you of your dad?"*
2. **Pick.** Everyone searches for a song on their own phone and locks it in. Picks stay secret, and you can add a short note about why.
3. **Listen & talk.** Songs are revealed one at a time and play on the host's phone, hooked up to a speaker. Anyone can play, pause, or skip. After each song, the person who picked it tells the story.
4. **Next round.** The next person asks. When you're done, the recap shows every round's mixtape.

## Features

- **No accounts.** Start a game and friends scan the QR code (or enter the 4-letter code) and join with just a name.
- **Guess who picked it** (optional). Everyone guesses whose song is playing before the reveal. 1 point per correct guess.
- **Pick timer** (optional). 60s, 90s, or 2 min; listening starts automatically when time's up.
- **Reactions.** Tap ❤️ 😂 😭 🔥 🙌 while a song plays and they float up on every screen.
- **Song of the round.** Vote for your favourite after each round; the winner gets a crown.
- **Group selfies.** Snap a selfie after any round; it's saved privately with the game, shown as polaroids in the recap, and added to the recap card.
- **Recap card.** A shareable image of the night's mixtape.
- **Save to Spotify.** Turn the whole game into a playlist.
- **Gentle chimes.** A soft sound when it's your turn to ask, when picking starts, and when 10 seconds are left.
- **Live sync.** Every phone stays in step: questions, picks, play/pause, and the progress bar.
- **Rejoin anytime.** Refresh or lock your phone and you land back in the same game.
- **Question themes.** Throwback, Family, Love & heartbreak, Hype, Deep cuts, Places, and Wildcard, plus your own questions and "Surprise me".
- **Search any song (Spotify) and play it in full** on the host's Spotify. Falls back to 30-second iTunes previews.
- **Demo mode.** Play a full game on one device with three bot friends.
- **Made for phones and desktops.** Light, dark, or match-device theme. You can add it to your home screen like an app.

## Getting started

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # also open it on your phone (same Wi-Fi)
npm run build          # production build in dist/
npm test               # automated tests (game rules + online sync)
npm run lint
```

### Tests

`npm test` runs the automated tests with Vitest:

- `src/game/engine.test.ts` covers every game rule: joining, turns, picks, playback, rounds, and leaving.
- `src/game/online-client.test.ts` simulates several phones against a stand-in for Supabase, including two people tapping at the same moment and reactions.
- `src/music/spotify.test.ts` checks the Spotify export against a stand-in for Spotify's API.

GitHub runs lint, type check, tests, and a build on every push (`.github/workflows/ci.yml`). The result shows as ✅ or ❌ next to each commit.

Online play reads the Supabase project from `.env`. The publishable key in that file is meant to be public; the database's row-level security rules control access.

## Hosting (Vercel)

The app is hosted on Vercel (project `music-game`, team `personal`):

- **Production:** every push to `main` deploys to [music-game-virid.vercel.app](https://music-game-virid.vercel.app).
- **Previews:** every other branch gets its own test link. Those links require a Vercel login (Deployment Protection → Standard Protection); the production address is public.
- Environment variables on Vercel: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (for Spotify search; see below). The Supabase address, publishable key and `VITE_SPOTIFY_CLIENT_ID` are public and live in `.env`. After changing a variable, redeploy for it to take effect.

## Spotify (full songs)

Side B uses a Spotify developer app (in Development Mode) for three things:

- **Search for everyone:** `api/spotify-search.ts` runs on Vercel and searches Spotify's catalogue with the app's credentials. Guests don't need a Spotify account. Results are cached on Vercel's CDN.
- **Full songs:** the host taps **Connect** (lobby). Songs then play in full on the host's Spotify app or Spotify Connect speaker; anyone's play / pause / skip / seek controls it. Without Spotify, songs play as 30-second previews.
- **Save to Spotify** at the end of a game.

Setup (done for the live site):
1. App at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) with **Web API**, Redirect URI `https://music-game-virid.vercel.app/`.
2. `VITE_SPOTIFY_CLIENT_ID` in `.env` (public). In Vercel: `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (secret: never commit it).
3. **User Management:** add every person who will host (max 5 in Development Mode). The app owner needs Spotify Premium; hosts need Premium to play full songs.

If search can't reach Spotify, it falls back to iTunes (30s previews), then a small built-in list.

## Backend (Supabase)

The project uses Supabase's free tier for live rooms.

| What | How |
| --- | --- |
| Sign-in | Anonymous. Each device gets a player id with no account needed. Turn on **Authentication → Sign In / Providers → Allow anonymous sign-ins**. |
| Games | One row per game in `rooms`, with the whole game state stored as JSON. |
| Security | Row-level security means you can only read or change games you joined. Players can only join through the `create_room` and `join_room` functions. |
| Conflicts | Every save checks a version number, so two people tapping at once can't overwrite each other. |
| Live updates | Supabase Realtime, plus a server clock sync so progress bars match. |
| Selfies | Private Storage bucket `selfies`. Files live in a folder named after the room, and only that room's players can upload, view (short-lived signed links) or delete them. Photos are shrunk to 1600px JPEG before upload. |

**Database changes** live in [`supabase/migrations/`](supabase/migrations). The Supabase GitHub integration applies new migrations when they reach the production branch. To set up a brand-new project in one go, paste [`supabase/schema.sql`](supabase/schema.sql) into **SQL Editor → New query** and press **Run**.

**Free tier:** Supabase pauses a free project after a week without use. Open the dashboard and press **Restore** to wake it.

## Project structure

```
src/
  game/
    engine.ts          All game rules in one pure function: reduce(state, action, player)
    types.ts           Players, rounds, picks, playback
    prompts.ts         Question themes
    client.ts          How screens talk to a game (demo or online)
    local-client.ts    Demo mode with bot players
    online-client.ts   Online mode: Supabase rooms, realtime, versioned saves
  screens/             One screen per phase: lobby, asking, picking, listening, between, recap
  components/          Shared game UI, audio player, and shadcn/ui components (ui/)
  music/               Song search and the offline song list
  hooks/               useGame, useTheme
  lib/                 Supabase client, clock sync, helpers
supabase/
  migrations/          Database changes, in order
  schema.sql           Full setup for a new project
```

To change how the game plays, start in `src/game/engine.ts`. Demo and online modes use the same rules.

## Built with

| Layer | Choice |
| --- | --- |
| App | Vite, React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui, Motion, Lucide icons |
| Brand | Pastel palette with Fraunces and Figtree fonts (bundled). Colours are tokens in `src/index.css` |
| Backend | Supabase (Postgres, anonymous auth, Realtime) |
| Music | Spotify Web API (search + playback control), iTunes previews as fallback |
| Install | PWA via `vite-plugin-pwa` |

Add more shadcn components with `npx shadcn@latest add <component>`.

## Working on it with Claude Code

- `.mcp.json` connects Claude Code to the Supabase project. On first use, run `/mcp`, choose **supabase**, then **Authenticate**.
- Supabase's agent skills are in `.claude/skills/`.
- `npm run build:preview` makes a single-file demo build in `dist-preview/`, for previewing inside the Claude app (`node scripts/claude-preview.mjs` prepares it for publishing).

## Roadmap

- [x] Full game loop with themes, secret picks, and a recap
- [x] Shared playback controls; songs revealed one at a time
- [x] Pastel design with light and dark themes
- [x] Online rooms: codes, invite links, live sync, rejoin after refresh
- [x] Database live on Supabase with security rules
- [x] Guess who picked it, pick timer, reactions, song of the round, QR join, chimes
- [x] Recap card and Save to Spotify
- [x] Group selfies saved with each game
- [x] Hosted on Vercel
- [ ] Play a first real game with friends
- [ ] Game history: browse past games and their mixtapes
- [x] Spotify: search any song and play it in full on the host's Spotify
