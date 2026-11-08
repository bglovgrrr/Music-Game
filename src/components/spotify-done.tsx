/** Shown in the Spotify sign-in pop-up once Spotify has sent us back. */
export function SpotifyDone() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="grid gap-2">
        <p className="font-display text-2xl">Connected to Spotify</p>
        <p className="text-muted-foreground">You can close this window and go back to Mixtape Memories.</p>
      </div>
    </div>
  )
}
