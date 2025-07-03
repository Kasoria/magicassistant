import React from 'react'
import ReactDOM from 'react-dom/client'
import DebugApp from './components/DebugApp'
import './index.css'

// Initialize React app for debug view
const root = ReactDOM.createRoot(document.getElementById('mat-admin-root'))

root.render(
  <React.StrictMode>
    <DebugApp />
  </React.StrictMode>
) 