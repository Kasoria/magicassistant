import { useState, useEffect, useRef } from 'react'
import ChatbotInterface from './ChatbotInterface'

/**
 * FloatingChatbot
 * ---------------
 * Public-facing floating chatbot component that displays active chatbots on the website.
 * This component fetches active chatbots from the server and renders them as floating
 * chat buttons that visitors can interact with.
 * 
 * Unlike FloatingChat (which is for admins), this is specifically designed for
 * website visitors to interact with AI-powered chatbots configured by site administrators.
 */

const FloatingChatbot = () => {
  const [chatbots, setChatbots] = useState([])
  const [activeChatbot, setActiveChatbot] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adminBarHeight, setAdminBarHeight] = useState(0)
  const chatInterfaceRef = useRef(null)

  // Load active chatbots on mount
  useEffect(() => {
    loadActiveChatbots()
  }, [])

  // Detect WordPress admin bar height
  useEffect(() => {
    const detectAdminBar = () => {
      const adminBar = document.getElementById('wpadminbar')
      if (adminBar) {
        const height = adminBar.offsetHeight
        setAdminBarHeight(height)
      } else {
        setAdminBarHeight(0)
      }
    }

    detectAdminBar()
    const timer = setTimeout(detectAdminBar, 100)
    window.addEventListener('resize', detectAdminBar)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', detectAdminBar)
    }
  }, [])

  // Handle click outside to close chat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && chatInterfaceRef.current && !chatInterfaceRef.current.contains(event.target)) {
        closeChatbot()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const loadActiveChatbots = async () => {
    try {
      const response = await fetch('/wp-json/magicassistant/v1/public/chatbots')
      const result = await response.json()

      if (result.success && result.data) {
        // Filter chatbots based on display conditions
        const visibleChatbots = result.data.filter(chatbot => 
          shouldDisplayChatbot(chatbot)
        )
        setChatbots(visibleChatbots)
      }
    } catch (error) {
      console.error('Failed to load chatbots:', error)
    } finally {
      setLoading(false)
    }
  }

  const shouldDisplayChatbot = (chatbot) => {
    const conditions = chatbot.display_conditions || {}
    
    // Check page conditions
    if (conditions.pages === 'specific') {
      const currentPath = window.location.pathname
      const specificPages = conditions.specific_pages || []
      if (!specificPages.some(page => currentPath.includes(page))) {
        return false
      }
    } else if (conditions.pages === 'exclude') {
      const currentPath = window.location.pathname
      const excludePages = conditions.exclude_pages || []
      if (excludePages.some(page => currentPath.includes(page))) {
        return false
      }
    }

    // Check device conditions
    if (conditions.devices && conditions.devices !== 'all') {
      const isMobile = window.innerWidth <= 768
      const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024
      const isDesktop = window.innerWidth > 1024

      if (conditions.devices === 'mobile' && !isMobile) return false
      if (conditions.devices === 'tablet' && !isTablet) return false
      if (conditions.devices === 'desktop' && !isDesktop) return false
    }

    // Additional conditions can be added here (user roles, etc.)
    
    return true
  }

  const openChatbot = (chatbot) => {
    setActiveChatbot(chatbot)
    setIsOpen(true)
  }

  const closeChatbot = () => {
    setIsOpen(false)
    // Keep activeChatbot for potential reopening, but clear after animation
    setTimeout(() => {
      if (!isOpen) {
        setActiveChatbot(null)
      }
    }, 300)
  }

  const getButtonPosition = (chatbot) => {
    const settings = chatbot.trigger_button_settings || {}
    const position = settings.position || 'bottom-right'
    const offsetX = settings.offset_x || 24
    const offsetY = settings.offset_y || 24

    let style = {}

    switch (position) {
      case 'bottom-right':
        style = { bottom: `${offsetY}px`, right: `${offsetX}px` }
        break
      case 'bottom-left':
        style = { bottom: `${offsetY}px`, left: `${offsetX}px` }
        break
      case 'top-right':
        style = { top: `${adminBarHeight + offsetY}px`, right: `${offsetX}px` }
        break
      case 'top-left':
        style = { top: `${adminBarHeight + offsetY}px`, left: `${offsetX}px` }
        break
      default:
        style = { bottom: `${offsetY}px`, right: `${offsetX}px` }
    }

    return style
  }

  const getButtonSize = (chatbot) => {
    const settings = chatbot.trigger_button_settings || {}
    const size = settings.size || 'medium'

    switch (size) {
      case 'small':
        return 'w-12 h-12'
      case 'large':
        return 'w-16 h-16'
      default:
        return 'w-14 h-14'
    }
  }

  const getButtonIcon = (chatbot) => {
    const settings = chatbot.trigger_button_settings || {}
    const icon = settings.icon || 'chat'

    const iconPaths = {
      chat: "M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      message: "M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-8.25L8.25 21l-3-1.5v-12a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25z",
      support: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
      help: "M8.25 9.75h4.875a2.625 2.625 0 010 5.25H8.25m0-10.5h4.875a2.625 2.625 0 010 5.25H8.25m0 0V21m0-12v-3",
      assistant: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z"
    }

    return iconPaths[icon] || iconPaths.chat
  }

  // Don't render anything if loading or no chatbots
  if (loading || chatbots.length === 0) {
    return null
  }

  return (
    <>
      {/* Render trigger buttons for each active chatbot */}
      {chatbots.map((chatbot, index) => {
        const settings = chatbot.trigger_button_settings || {}
        const color = settings.color || '#3B82F6'
        const buttonSize = getButtonSize(chatbot)
        const position = getButtonPosition(chatbot)

        return (
          <button
            key={chatbot.id}
            onClick={() => openChatbot(chatbot)}
            className={`fixed z-50 ${buttonSize} rounded-full shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50 text-white flex items-center justify-center overflow-hidden`}
            style={{
              backgroundColor: color,
              ...position,
              // If multiple chatbots, offset them slightly
              transform: index > 0 ? `translate(${index * -60}px, ${index * -10}px)` : undefined
            }}
            aria-label={`Open ${chatbot.name} chat`}
          >
            {settings.custom_icon ? (
              <img
                src={settings.custom_icon}
                alt={`${chatbot.name} icon`}
                className="w-8 h-8 object-cover"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  e.target.style.display = 'none'
                  e.target.nextElementSibling.style.display = 'block'
                }}
              />
            ) : null}
            <svg
              className={`w-6 h-6 mx-auto ${settings.custom_icon ? 'hidden' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              style={{ display: settings.custom_icon ? 'none' : 'block' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={getButtonIcon(chatbot)}
              />
            </svg>
          </button>
        )
      })}

      {/* Chat Interface Modal */}
      {activeChatbot && isOpen && (
        <div
          ref={chatInterfaceRef}
          className="fixed z-50 shadow-2xl transition-all duration-300 ease-in-out"
          style={{
            right: '20px',
            bottom: '20px',
            width: `${activeChatbot.chatbot_styling?.width || 380}px`,
            maxWidth: 'calc(100vw - 40px)',
            height: `${activeChatbot.chatbot_styling?.height || 500}px`,
            maxHeight: 'calc(100vh - 40px)',
            borderRadius: `${activeChatbot.chatbot_styling?.border_radius || 16}px`
          }}
        >
          <ChatbotInterface
            chatbot={activeChatbot}
            onClose={closeChatbot}
            isOpen={isOpen}
            className="h-full"
          />
        </div>
      )}

      {/* Mobile responsive adjustments */}
      <style jsx>{`
        @media (max-width: 768px) {
          .chatbot-modal {
            top: ${adminBarHeight + 10}px !important;
            right: 10px !important;
            bottom: 10px !important;
            left: 10px !important;
            width: auto !important;
          }
        }
      `}</style>
    </>
  )
}

export default FloatingChatbot