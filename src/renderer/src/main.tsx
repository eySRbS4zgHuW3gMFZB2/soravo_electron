import React from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import { AuthProvider } from './auth/authContext'
import { DesktopAuth } from './auth/DesktopAuth'
import { installAppShortcuts } from './appShortcuts'
import './styles.css'
import './hub.css'
import './soravo'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

// No webview context menu, no browser find-in-page or print shortcuts.
installAppShortcuts()

async function main() {
  let isHub = false
  try {
    const win = getCurrentWindow()
    isHub = win.label === 'hub'
  } catch {
    isHub = window.location.hash === '#/hub'
  }

  createRoot(rootEl!).render(
    <React.StrictMode>
      {isHub ? (
        <AuthProvider><DesktopAuth /></AuthProvider>
      ) : (
        <App />
      )}
    </React.StrictMode>
  )
}

void main()