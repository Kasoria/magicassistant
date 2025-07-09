import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminApp from './components/AdminApp'
import './index.css'
import 'flowbite'
import 'driver.js/dist/driver.css'

const root = document.getElementById('mat-admin-root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AdminApp />
    </React.StrictMode>,
  )
}

// Initialize Flowbite components after DOM is ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.Flowbite) {
      window.Flowbite.init()
    }
  })
} 