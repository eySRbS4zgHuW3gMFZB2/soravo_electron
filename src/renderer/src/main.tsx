import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import HubApp from './HubApp'
import './styles.css'
import './hub.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

if (!window.soravo) {
  // Visible failure instead of a blank transparent window: the preload
  // bridge did not load, so none of the app IPC would work.
  rootEl.innerHTML =
    '<div class="soravo-pill"><div class="pill-main">' +
    '<div class="pill-title">Soravo</div>' +
    '<div class="pill-sub error">Bridge missing. Quit from the tray icon and restart.</div>' +
    '</div></div>'
} else {
  const hash = window.location.hash
  createRoot(rootEl).render(
    <React.StrictMode>{hash === '#/hub' ? <HubApp /> : <App />}</React.StrictMode>
  )
}
