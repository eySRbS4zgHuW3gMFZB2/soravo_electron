import React from 'react'
import { createRoot } from 'react-dom/client'
import { getCurrentWindow } from '@tauri-apps/api/window'
import App from './App'
import HubApp from './HubApp'
import ScratchpadApp from './ScratchpadApp'
import './styles.css'
import './hub.css'
import './soravo'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

async function main() {
  let label = 'pill'
  try {
    const win = getCurrentWindow()
    label = win.label
  } catch {
    label = window.location.hash === '#/hub' ? 'hub' : window.location.hash === '#/scratchpad' ? 'scratchpad' : 'pill'
  }

  let Component: React.ComponentType = App
  if (label === 'hub') Component = HubApp
  else if (label === 'scratchpad') Component = ScratchpadApp

  createRoot(rootEl!).render(
    <React.StrictMode><Component /></React.StrictMode>
  )
}

void main()