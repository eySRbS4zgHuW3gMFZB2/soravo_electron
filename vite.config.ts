import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { DEFAULT_SUPABASE_URL } from './src/renderer/src/auth/defaultSupabaseUrl'

export default defineConfig(({ mode }) => {
  const rendererRoot = fileURLToPath(new URL('./src/renderer', import.meta.url))
  const configuredUrl = loadEnv(mode, rendererRoot).VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const url = new URL(configuredUrl)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('VITE_SUPABASE_URL must be an HTTP(S) URL without credentials')
  }
  return {
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