import React from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import HubApp from './HubApp'
import './styles.css'
import './hub.css'
import './soravo'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

async function main() {
  // Nothing to bootstrap: every component keys its state styles on data-state directly.

  // Determine which component to render based on window label
  let isHub = false
  try {
    const win = getCurrentWindow()
    isHub = win.label === 'hub'
  } catch {
    // Fallback to hash routing
    isHub = window.location.hash === '#/hub'
  }

  createRoot(rootEl!).render(
    <React.StrictMode>{isHub ? <HubApp /> : <App />}</React.StrictMode>
  )
}

void main()
