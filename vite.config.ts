import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { DEFAULT_SUPABASE_URL } from './src/renderer/src/auth/defaultSupabaseUrl'
import { validateSupabaseUrl } from './src/renderer/src/auth/supabaseUrl'

export default defineConfig(({ mode }) => {
  const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))
  const configuredUrl = validateSupabaseUrl(loadEnv(mode, rendererRoot).VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL)
  const url = new URL(configuredUrl)
  return {
    define: { __DESKTOP_SUPABASE_URL__: JSON.stringify(configuredUrl) },
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