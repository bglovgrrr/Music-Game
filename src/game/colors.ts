// Player colours: marker inks on a J-card. Avatar initials use --ink on top of these.
// The database still hands out the original pastel set (by position), so `inkColor` maps
// those to the matching ink. New colours can be used directly.
const LEGACY = ['#cfcaff', '#ffc4da', '#ffd3b0', '#bfe9d6', '#fbe39a', '#bcdcff', '#d7ecb0', '#f4c0c0']
export const PLAYER_COLORS = ['#f4a949', '#ff8fc4', '#e9b07a', '#9cc08a', '#f2d45c', '#7fa6f5', '#c3d98a', '#f08a6e']

export function inkColor(color?: string): string {
  if (!color) return PLAYER_COLORS[0]
  const i = LEGACY.indexOf(color.toLowerCase())
  return i >= 0 ? PLAYER_COLORS[i] : color
}
