import React from 'react'
import ReactDOM from 'react-dom/client'
import PublicApp from './components/PublicApp'
import './index.css'

const root = document.getElementById('mat-public-root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PublicApp />
    </React.StrictMode>,
  )
} 