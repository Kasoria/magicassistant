import { useState, useEffect } from 'react'
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
 *                   (matPublicData or matAdminData).  This is forwarded to the
 *                   ChatInterface as `adminData` so we don't have to touch the
 *                   existing component.
 */
const FloatingChat = ({ pluginData }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [theme, setTheme] = useState('light')

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('mat-theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('mat-theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  // Open drawer with animation
  const openDrawer = () => {
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

  // Detect prefers-color-scheme to pick a decent default for the toggle button
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  const buttonClasses =
    'fixed z-50 bottom-6 right-6 flex items-center justify-center h-14 w-14 rounded-full shadow-lg transition-colors focus:outline-none ' +
    (prefersDark ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')

  // Handle backdrop click to close drawer
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop, not on child elements
    if (e.target === e.currentTarget && !isAnimating) {
      closeDrawer()
    }
  }

  return (
    <>
      {/* Floating chat toggle button */}
      {!isOpen && !isAnimating && (
        <button
          type="button"
          aria-label="Open chat"
          className={buttonClasses}
          onClick={openDrawer}
        >
          {/* Chat icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      )}

      {/* Backdrop (conditional) */}
      {(isOpen || isAnimating) && (
        <div 
          className={`fixed inset-0 z-40 bg-black/10 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={handleBackdropClick}
        />
      )}

      {/* Drawer panel (always mounted to keep chat state) */}
      <div 
        className={`fixed top-[32px] right-0 h-full w-full sm:w-[420px] bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${(isOpen || isAnimating) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} z-50`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside drawer
      >
        {/* Drawer Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">MagicAssistant</h2>
          <div className="flex items-center space-x-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <Button size="xs" color="light" onClick={closeDrawer}>
              Close
            </Button>
          </div>
        </div>
        
        {/* Drawer Content */}
        <div className="h-full overflow-hidden p-4">
          <ToastProvider position="top-right" maxToasts={3}>
            <ChatInterface adminData={pluginData} isDrawerMode={true} />
          </ToastProvider>
        </div>
      </div>
    </>
  )
}

export default FloatingChat 