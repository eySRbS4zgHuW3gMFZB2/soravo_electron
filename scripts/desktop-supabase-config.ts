import { createHash } from 'node:crypto'
import { loadEnv } from 'vite'
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from '../src/renderer/src/auth/defaultSupabaseUrl'
import { validateSupabaseUrl } from '../src/renderer/src/auth/supabaseUrl'

const supabaseEnvKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const
type Env = Record<string, string | undefined>

// Vite normally overlays process.env on every file layer. Temporarily hide
// these three values so incomplete process overrides cannot form mixed pairs.
export function loadSupabaseFileEnvs(mode: string, desktopDir: string, websiteDir: string) {
  const saved = supabaseEnvKeys.map(key => process.env[key])
  try {
    for (const key of supabaseEnvKeys) delete process.env[key]
    return { desktop: loadEnv(mode, desktopDir), website: loadEnv(mode, websiteDir) }
  } finally {
    supabaseEnvKeys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key]
      else process.env[key] = saved[i]
    })
  }
}

export function resolveSupabasePair(processEnv: Env, desktopEnv: Env, websiteEnv: Env) {
  for (const env of [processEnv, desktopEnv, websiteEnv]) {
    const key = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
    if (env.VITE_SUPABASE_URL && key) return { url: validateSupabaseUrl(env.VITE_SUPABASE_URL), key }
  }
  return { url: validateSupabaseUrl(DEFAULT_SUPABASE_URL), key: DEFAULT_SUPABASE_PUBLISHABLE_KEY }
}

export function desktopSessionStorageKey(validatedUrl: string): string {
  const url = new URL(validatedUrl)
  const project = /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.supabase\.co$/.exec(url.hostname)
  if (url.protocol === 'https:' && !url.port && url.pathname === '/' && project && project[1].length <= 63) {
    return `sb-${project[1]}-auth-token`
  }
  return `soravo-url-${createHash('sha256').update(validatedUrl).digest('hex')}`
}
