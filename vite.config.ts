import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { desktopSessionStorageKey, loadSupabaseFileEnvs, resolveSupabasePair } from './scripts/desktop-supabase-config'

export default defineConfig(({ mode }) => {
  const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))
  const websiteRoot = fileURLToPath(new URL('./website', import.meta.url))
  const { desktop, website } = loadSupabaseFileEnvs(mode, rendererRoot, websiteRoot)
  const { url: configuredUrl, key: configuredKey } = resolveSupabasePair(process.env, desktop, website)
  const url = new URL(configuredUrl)
  return {
    define: {
      __DESKTOP_SUPABASE_URL__: JSON.stringify(configuredUrl),
      __DESKTOP_SUPABASE_KEY__: JSON.stringify(configuredKey),
      __DESKTOP_SESSION_STORAGE_KEY__: JSON.stringify(desktopSessionStorageKey(configuredUrl)),
    },
    plugins: [react(), tailwindcss(), {
      name: 'supabase-connect-origin',
      transformIndexHtml: (html) => html.replace('%SUPABASE_CONNECT_ORIGIN%', url.origin),
    }],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/renderer/src', import.meta.url))
      }
    },
    root: 'src/renderer',
    build: {
      outDir: '../../dist',
      emptyOutDir: true
    },
    server: {
      port: 5173,
      strictPort: true
    },
    clearScreen: false
  }
})