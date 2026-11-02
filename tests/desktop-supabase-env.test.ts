import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSupabaseFileEnvs, resolveSupabasePair } from '../scripts/desktop-supabase-config'
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_PUBLISHABLE_KEY } from '../src/renderer/src/auth/defaultSupabaseUrl'

const pair = (name: string) => ({ VITE_SUPABASE_URL: `https://${name}.example`, VITE_SUPABASE_ANON_KEY: `${name}-key` })
afterEach(() => vi.unstubAllEnvs())

describe('desktop Supabase environment pairs', () => {
  it('selects complete process, desktop, then website pairs without mixing partial values', () => {
    const processPair = pair('process'), desktopPair = pair('desktop'), websitePair = pair('website')
    expect(resolveSupabasePair(processPair, desktopPair, websitePair)).toEqual({ url: 'https://process.example', key: 'process-key' })
    expect(resolveSupabasePair({ VITE_SUPABASE_URL: 'https://partial.example' }, desktopPair, websitePair)).toEqual({ url: 'https://desktop.example', key: 'desktop-key' })
    expect(resolveSupabasePair({ VITE_SUPABASE_ANON_KEY: 'partial-key' }, { VITE_SUPABASE_URL: 'https://partial.example' }, websitePair)).toEqual({ url: 'https://website.example', key: 'website-key' })
    expect(resolveSupabasePair({}, { VITE_SUPABASE_ANON_KEY: 'partial' }, { VITE_SUPABASE_URL: 'https://partial.example' })).toEqual({ url: DEFAULT_SUPABASE_URL, key: DEFAULT_SUPABASE_PUBLISHABLE_KEY })
    expect(resolveSupabasePair({ VITE_SUPABASE_URL: 'https://alias.example', VITE_SUPABASE_PUBLISHABLE_KEY: 'alias' }, {}, {})).toEqual({ url: 'https://alias.example', key: 'alias' })
    expect(() => resolveSupabasePair(pair('process'), {}, { VITE_SUPABASE_URL: 'http://unsafe.example', VITE_SUPABASE_ANON_KEY: 'bad' })).not.toThrow()
    expect(() => resolveSupabasePair({ VITE_SUPABASE_URL: 'http://unsafe.example', VITE_SUPABASE_ANON_KEY: 'bad' }, {}, {})).toThrow()
  })

  it('loads file layers without overlaying a partial process value and restores the environment', () => {
    const root = mkdtempSync(join(tmpdir(), 'soravo-env-test-'))
    try {
      const desktop = join(root, 'desktop'), website = join(root, 'website')
      mkdirSync(desktop); mkdirSync(website)
      writeFileSync(join(desktop, '.env.local'), 'VITE_SUPABASE_URL=https://desktop.example\nVITE_SUPABASE_ANON_KEY=desktop-key\n')
      writeFileSync(join(website, '.env.local'), 'VITE_SUPABASE_URL=https://website.example\nVITE_SUPABASE_ANON_KEY=website-key\n')
      vi.stubEnv('VITE_SUPABASE_URL', 'https://partial-process.example')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
      const fileEnvs = loadSupabaseFileEnvs('test', desktop, website)
      expect(resolveSupabasePair(process.env, fileEnvs.desktop, fileEnvs.website)).toEqual({ url: 'https://desktop.example', key: 'desktop-key' })
      expect(process.env.VITE_SUPABASE_URL).toBe('https://partial-process.example')
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
