import React, { useState, useEffect } from 'react'
// Flowbite components are available globally for other parts – none required here
import FloatingChat from './FloatingChat'
import FloatingChatbot from './FloatingChatbot'

const PublicApp = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [floatingChatEnabled, setFloatingChatEnabled] = useState(false)

  useEffect(() => {
    // Check if WordPress data is available
    if (typeof window.magicaPublicData !== 'undefined' || typeof window.magicaAdminData !== 'undefined') {
      setIsLoaded(true)
      checkFloatingChatSettings()
    }
  }, [])

  const checkFloatingChatSettings = async () => {
    try {
      const pluginData = typeof window !== 'undefined' && (window.magicaAdminData || window.magicaPublicData) || {}
      
      if (!pluginData.restUrl) {
        return
      }

      const response = await fetch(`${pluginData.restUrl}settings`, {
        headers: pluginData.nonces?.wp_rest ? {
          'X-WP-Nonce': pluginData.nonces.wp_rest,
        } : {},
      })

      if (response.ok) {
        const settings = await response.json()
        setFloatingChatEnabled(settings.floating_chat_enabled === true)
      }
    } catch (error) {
      console.error('Error fetching floating chat settings:', error)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Detect global localisation object (admin or public) – falls back gracefully.
  const pluginData = typeof window !== 'undefined' && (window.magicaAdminData || window.magicaPublicData) || {}

  return (
    <>
      {floatingChatEnabled && <FloatingChat pluginData={pluginData} />}
      <FloatingChatbot pluginData={pluginData} />
    </>
  )
}

export default PublicApp 