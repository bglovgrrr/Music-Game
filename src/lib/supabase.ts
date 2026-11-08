import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { clock } from './clock'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** Null in the Claude preview build (its sandbox can't reach outside servers) or when not configured. */
export const supabase: SupabaseClient | null = url && key && import.meta.env.MODE !== 'preview' ? createClient(url, key) : null

export const onlineAvailable = supabase !== null

export class OnlineError extends Error {}

/** Signs in anonymously (no account) once per device and returns the player id. */
export async function ensureSession(): Promise<string> {
  if (!supabase) throw new OnlineError('Online play is not set up.')
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  const { data: signed, error } = await supabase.auth.signInAnonymously()
  if (error || !signed.user) {
    const msg = error?.message ?? ''
    if (/anonymous/i.test(msg)) throw new OnlineError('Anonymous sign-ins are turned off in Supabase (Authentication → Sign In / Providers).')
    throw new OnlineError(friendlyError(error ?? new Error('unknown error')))
  }
  return signed.user.id
}

/** Estimate how far this device's clock is from the server's. */
export async function syncClock() {
  if (!supabase) return
  try {
    const t0 = Date.now()
    const { data, error } = await supabase.rpc('server_time')
    const t1 = Date.now()
    if (error || !data) return
    clock.setOffset(Date.parse(data as string) - (t0 + t1) / 2)
  } catch {
    /* keep the local clock */
  }
}

/** Turn database errors into something a person can act on. */
export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err)
  if (/could not find the function|schema cache|relation .* does not exist/i.test(msg))
    return 'The database is not set up yet. Run supabase/schema.sql in the Supabase SQL Editor.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.'
  return msg.replace(/^.*?exception:\s*/i, '')
}
