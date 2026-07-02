import { useState, useEffect, useRef } from 'react'
import { Button } from 'flowbite-react'
import ChatInterface from './ChatInterface'
import { ToastProvider } from './Toast'

/**
 * FloatingChat
 * -------------
 * A site-wide floating chat widget that can appear on both the public website
 * and inside the WordPress admin area (for any page where the public React
 * bundle is injected).  It renders a circular chat button fixed to the bottom
 * right of the viewport.  Clicking the button opens a Drawer that contains the
 * full <ChatInterface/> – giving users the same powerful AI/MCP functionality
 * they already have in the dedicated admin screen.
 *
 * Required props:
 *   - pluginData:   The localisation object injected by PHP via wp_localize_script
 *                   (magicaPublicData or magicaAdminData).  This is forwarded to the
 *                   ChatInterface as `adminData` so we don't have to touch the
 *                   existing component.
 */

// Available background colors - moved to top to avoid hoisting issues
const backgroundColors = {
  blue: 'bg-blue-600 hover:bg-blue-700',
  purple: 'bg-purple-600 hover:bg-purple-700',
  green: 'bg-green-600 hover:bg-green-700',
  red: 'bg-red-600 hover:bg-red-700',
  orange: 'bg-orange-600 hover:bg-orange-700',
  pink: 'bg-pink-600 hover:bg-pink-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
  teal: 'bg-teal-600 hover:bg-teal-700'
}

// Available icons - moved to top to avoid hoisting issues
const icons = {
  chat: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  message: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-8.25L8.25 21l-3-1.5v-12a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25z"
    />
  ),
  support: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
    />
  ),
  help: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 9.75h4.875a2.625 2.625 0 010 5.25H8.25m0-10.5h4.875a2.625 2.625 0 010 5.25H8.25m0 0V21m0-12v-3"
    />
  ),
  assistant: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z"
    />
  )
}

const FloatingChat = ({ pluginData }) => {
  // Don't render if we're inside an iframe (Bricks canvas)
  // The main window should render the floating chat, not the canvas iframe
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top

  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [adminBarHeight, setAdminBarHeight] = useState(0)
  const [latestAiResponse, setLatestAiResponse] = useState({ html: '', css: '', js: '' });
  const [drawerWidth, setDrawerWidth] = useState(() => {
    // Get saved width from localStorage, default to 420px, minimum 400px
    const saved = localStorage.getItem('mat-floating-chat-width')
    const parsed = saved ? parseInt(saved, 10) : 420
    return Math.max(parsed, 400)
  })
  const [isResizing, setIsResizing] = useState(false)
  const [buttonPosition, setButtonPosition] = useState(() => {
    // Get saved position from localStorage, default to bottom-right
    const saved = localStorage.getItem('mat-floating-chat-position')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { x: parsed.x || 24, y: parsed.y || 24 }
      } catch (e) {
        return { x: 24, y: 24 }
      }
    }
    return { x: 24, y: 24 } // Default: 24px from right and bottom
  })
  const [buttonCustomization, setButtonCustomization] = useState(() => {
    // Load any previously stored customization for this browser (position, etc.)
    let stored = {};
    const saved = localStorage.getItem('mat-floating-chat-customization');
    if (saved) {
      try {
        stored = JSON.parse(saved) || {};
      } catch (_) {}
    }

    // Server-side defaults from plugin settings (always take precedence so that admin changes apply site-wide)
    const serverColor = pluginData?.floatingChatButtonColor;
    const serverIcon  = pluginData?.floatingChatButtonIcon;
    const serverCustomColor = pluginData?.floatingChatCustomColor;
    const serverCustomIcon = pluginData?.floatingChatCustomIcon;


    return {
      backgroundColor: serverColor || stored.backgroundColor || 'blue',
      icon: serverIcon || stored.icon || 'chat',
      customColor: serverCustomColor || stored.customColor || '',
      customIcon: serverCustomIcon || stored.customIcon || ''
    };
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const drawerRef = useRef(null)
  const buttonRef = useRef(null)

  // Get theme from database via pluginData
  const savedTheme = pluginData?.savedTheme || 'light'

  // Initialize theme from database
  useEffect(() => {
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }, [savedTheme])

  // Save width to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mat-floating-chat-width', drawerWidth.toString())
  }, [drawerWidth])

  // Save button position to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mat-floating-chat-position', JSON.stringify(buttonPosition))
  }, [buttonPosition])

  // Save button customization to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('mat-floating-chat-customization', JSON.stringify(buttonCustomization))
  }, [buttonCustomization])

  // Listen for customization changes from settings
  useEffect(() => {
    const handleCustomizationUpdate = (event) => {
      if (event.detail) {
        setButtonCustomization(prev => ({
          ...prev,
          backgroundColor: event.detail.backgroundColor || prev.backgroundColor,
          icon: event.detail.icon || prev.icon,
          customColor: event.detail.customColor || prev.customColor,
          customIcon: event.detail.customIcon || prev.customIcon
        }))
      }
    }

    window.addEventListener('magicaFloatingChatCustomizationUpdate', handleCustomizationUpdate)
    return () => {
      window.removeEventListener('magicaFloatingChatCustomizationUpdate', handleCustomizationUpdate)
    }
  }, [])

  // Handle button drag functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      
      // Record that we have moved – distinguishes drag vs simple click
      hasMovedRef.current = true
      // Calculate new position (offsets are from the right and bottom edges)
      const buttonSize = 56 // 14 * 4 = 56px (h-14 w-14)
      const newRight = Math.max(0, Math.min(window.innerWidth - buttonSize, buttonPosition.x - deltaX))
      const newBottom = Math.max(0, Math.min(window.innerHeight - buttonSize, buttonPosition.y - deltaY))
      
      setButtonPosition({
        x: newRight,
        y: newBottom
      })
      
      setDragStart({ x: e.clientX, y: e.clientY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    if (isDragging || hasMovedRef.current) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart, buttonPosition])

  // Handle mouse resize functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !drawerRef.current) return
      
      const rect = drawerRef.current.getBoundingClientRect()
      const newWidth = window.innerWidth - e.clientX
      
      // Enforce minimum width of 400px and maximum of 80% of screen width
      const minWidth = 400
      const maxWidth = Math.floor(window.innerWidth * 0.8)
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth))
      
      setDrawerWidth(constrainedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    if (isResizing) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ew-resize'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

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

    // Check immediately
    detectAdminBar()

    // Also check after a short delay in case the admin bar loads later
    const timer = setTimeout(detectAdminBar, 100)

    // Listen for window resize to handle responsive admin bar height changes
    window.addEventListener('resize', detectAdminBar)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', detectAdminBar)
    }
  }, [])

  // Open drawer with animation
  const openDrawer = () => {
    if (isDragging) return // Don't open if dragging
    setIsOpen(true)
    // Brief animate flag so panel mounts in off-screen state first, then slides in
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 20)
  }

  // Close drawer with animation
  const closeDrawer = () => {
    // Trigger slide-out immediately
    setIsOpen(false)
    setIsAnimating(true)
    // Disable animating flag after transition finishes
    setTimeout(() => {
      setIsAnimating(false)
    }, 300)
  }

  // Close chat when ESC is pressed for better UX
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeDrawer()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAnimating])

  // Handle resize start
  const handleResizeStart = (e) => {
    e.preventDefault()
    setIsResizing(true)
  }

  // Handle button drag start
  const handleButtonMouseDown = (e) => {
    if (e.button === 2) return // Don't start dragging on right-click
    e.preventDefault()
    setIsDragging(true)
    hasMovedRef.current = false // reset movement tracker
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  // Handle button click (only if not dragging)
  const handleButtonClick = (e) => {
    if (isDragging || hasMovedRef.current) {
      e.preventDefault()
      return
    }
    openDrawer()
  }

  const handleAiResponseUpdate = (response) => {
    // Callback from ChatInterface when AI generates Bricks structure
    // The insert buttons are now part of each message, so nothing needed here
    console.log('📥 AI Response received - Insert buttons available in message');
  };

  // Check if we are inside the Bricks editor
  const isBricksEditor = new URLSearchParams(window.location.search).get('bricks') === 'run';

  // Show Bricks mode indicator
  const showBricksIndicator = isBricksEditor && isOpen;

  // Get button background color style
  const getButtonStyle = () => {
    if (buttonCustomization.backgroundColor === 'custom' && buttonCustomization.customColor) {
      return {
        backgroundColor: buttonCustomization.customColor,
        right: `${buttonPosition.x}px`,
        bottom: `${buttonPosition.y}px`
      }
    }
    return {
      right: `${buttonPosition.x}px`,
      bottom: `${buttonPosition.y}px`
    }
  }

  const buttonClasses =
    'fixed z-[99999] flex items-center justify-center h-14 w-14 rounded-full shadow-lg transition-colors focus:outline-none cursor-grab active:cursor-grabbing text-white ' +
    (buttonCustomization.backgroundColor === 'custom' ? '' : backgroundColors[buttonCustomization.backgroundColor])

  // Handle backdrop click to close drawer
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop, not on child elements
    if (e.target === e.currentTarget && !isAnimating) {
      closeDrawer()
    }
  }

  // Track whether the pointer actually moved while mouse button held
  const hasMovedRef = useRef(false)

  // Don't render anything if we're inside an iframe (Bricks canvas)
  if (isInIframe) {
    return null
  }

  return (
    <>
      {/* Floating chat toggle button */}
      {!isOpen && !isAnimating && (
        <button
          ref={buttonRef}
          type="button"
          aria-label="Open chat"
          className={buttonClasses}
          style={getButtonStyle()}
          onMouseDown={handleButtonMouseDown}
          onClick={handleButtonClick}
        >
          {/* Chat icon */}
          {buttonCustomization.icon === 'custom' && buttonCustomization.customIcon ? (
            // Handle custom icon
            buttonCustomization.customIcon.startsWith('http') ? (
              // Image URL
              <img 
                src={buttonCustomization.customIcon} 
                alt="Custom icon" 
                className="w-6 h-6 pointer-events-none"
              />
            ) : buttonCustomization.customIcon.startsWith('&#') || 
                 buttonCustomization.customIcon.match(/^[\u0000-\u1F7FF]+$/) ? (
              // Unicode character
              <span 
                className="text-lg pointer-events-none"
                dangerouslySetInnerHTML={{ __html: buttonCustomization.customIcon }}
              />
            ) : (
              // SVG path
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 pointer-events-none"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={buttonCustomization.customIcon}
                />
              </svg>
            )
          ) : (
            // Default predefined icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 pointer-events-none"
            >
              {icons[buttonCustomization.icon]}
            </svg>
          )}
        </button>
      )}

      {/* Backdrop (conditional) */}
      {(isOpen || isAnimating) && (
        <div
          className={`fixed inset-0 z-[99998] bg-black/10 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleBackdropClick}
        />
      )}

      {/* Drawer panel (always mounted to keep chat state) */}
      <div
        ref={drawerRef}
        className={`fixed right-0 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${(isOpen || isAnimating) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} z-[99999]`}
        style={{
          top: `${adminBarHeight}px`,
          height: `calc(100vh - ${adminBarHeight}px)`,
          width: `${drawerWidth}px`
        }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside drawer
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors opacity-0 hover:opacity-100"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
        
        {/* Drawer Header */}
        <div className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">MagicAssistant</h2>
            {isBricksEditor && (
              <span className="px-2 py-1 text-xs font-semibold bg-orange-500 text-white rounded">
                🧱 Bricks Mode
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button size="xs" color="light" onClick={closeDrawer}>
              Close
            </Button>
          </div>
        </div>
        
        {/* Drawer Content */}
        <div className="h-[calc(100%-80px)] overflow-hidden">
          <ToastProvider position="top-right" maxToasts={3}>
            <ChatInterface
              adminData={pluginData}
              isDrawerMode={true}
              isBricksMode={isBricksEditor}
              onAiResponseUpdate={handleAiResponseUpdate}
            />
          </ToastProvider>
        </div>
      </div>
    </>
  )
}

export default FloatingChat 