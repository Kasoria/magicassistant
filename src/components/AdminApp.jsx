import { useState, useEffect } from 'react'
import { Button, Card, Select, Label, TextInput } from 'flowbite-react'
import ChatInterface from './ChatInterface'
import Settings from './Settings'
import Analytics from './Analytics'
import SEO from './SEO'
import { ToastProvider } from './Toast'

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
          icon: [
        "M2.99914,6.5 C2.99914,3.87478705 3.02725,3 6.49914,3 C9.97103,3 9.99914,3.87478705 9.99914,6.5 C9.99914,9.12521295 10.0102,10 6.49914,10 C2.98808,10 2.99914,9.12521295 2.99914,6.5 Z",
        "M13.9991,6.5 C13.9991,3.87478705 14.0272,3 17.4991,3 C20.971,3 20.9991,3.87478705 20.9991,6.5 C20.9991,9.12521295 21.0102,10 17.4991,10 C13.988,10 13.9991,9.12521295 13.9991,6.5 Z",
        "M2.99914,17.5 C2.99914,14.8747871 3.02725,14 6.49914,14 C9.97103,14 9.99914,14.8747871 9.99914,17.5 C9.99914,20.1252129 10.0102,21 6.49914,21 C2.98808,21 2.99914,20.1252129 2.99914,17.5 Z",
        "M13.9991,17.5 C13.9991,14.8747871 14.0272,14 17.4991,14 C20.971,14 20.9991,14.8747871 20.9991,17.5 C20.9991,20.1252129 21.0102,21 17.4991,21 C13.988,21 13.9991,20.1252129 13.9991,17.5 Z"
      ]
  },
  {
    id: 'chat',
    label: 'AI Assistant',
    icon: "M12 21.25a9.25 9.25 0 1 0-8.307-5.177c.108.22.144.468.089.706l-.816 3.536a.6.6 0 0 0 .72.72l3.535-.817a1.06 1.06 0 0 1 .706.09A9.2 9.2 0 0 0 12 21.25M7.97 9.886h8.06m-8.06 4.228h5.748"
  },
  {
    id: 'seo',
    label: 'SEO',
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"
  }
]

const AdminApp = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [adminData, setAdminData] = useState(null)
  const [settings, setSettings] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Initialize settings from WordPress
  useEffect(() => {
    if (typeof window.matAdminData !== 'undefined') {
      const data = window.matAdminData
      setAdminData(data)
      setIsLoaded(true)
      
      // Load AI settings
      loadSettings(data)
      
      // Initialize dark mode
      const serverTheme = data.savedTheme
      const clientTheme = localStorage.getItem('mat-theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      
      if (serverTheme && (serverTheme === 'dark' || serverTheme === 'light')) {
        setDarkMode(serverTheme === 'dark')
      } else if (clientTheme && (clientTheme === 'dark' || clientTheme === 'light')) {
        setDarkMode(clientTheme === 'dark')
      } else {
        setDarkMode(prefersDark)
      }
      
      // Set initial tab from admin data
      if (data.initialTab && data.initialTab !== 'dashboard') {
        setActiveTab(data.initialTab)
      }
    } else {
      // If no localization object we still want to render the UI
      setIsLoaded(true)
    }
  }, [])

  // Apply dark mode to document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // Add body class management for mobile sidebar
  useEffect(() => {
    if (sidebarOpen && window.innerWidth < 1024) {
      document.body.classList.add('sidebar-open')
    } else {
      document.body.classList.remove('sidebar-open')
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('sidebar-open')
    }
  }, [sidebarOpen])

  // Handle window resize to close mobile sidebar on large screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    const handleTabSwitch = (event) => {
      if (event.detail?.tab) {
        setActiveTab(event.detail.tab)
        // Close mobile sidebar when navigating
        if (window.innerWidth < 1024) {
          setSidebarOpen(false)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('mat_switch_tab', handleTabSwitch)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mat_switch_tab', handleTabSwitch)
    }
  }, [sidebarOpen])

  const loadSettings = async (data) => {
    try {
      const response = await fetch(`${data.restUrl}settings`, {
        headers: {
          'X-WP-Nonce': data.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const settingsData = await response.json()
        setSettings(settingsData)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveSettings = async (newSettings) => {
    if (!adminData) return

    setIsSavingSettings(true)
    
    try {
      const response = await fetch(`${adminData.restUrl}settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(newSettings)
      })
      
      if (response.ok) {
        const updatedSettings = await response.json()
        if (updatedSettings.success) {
          // Reload settings to get updated state
          await loadSettings(adminData)
          setApiKey('') // Clear the API key input for security
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
    
    setIsSavingSettings(false)
  }

  const toggleDarkMode = () => {
    const newTheme = !darkMode ? 'dark' : 'light'
    setDarkMode(!darkMode)
    
    // Save to localStorage for immediate persistence
    localStorage.setItem('mat-theme', newTheme)

    // Apply dark mode to document immediately
    if (!darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    // Save to server for cross-session persistence
    if (adminData?.ajaxurl && adminData?.nonces?.save_theme_mode) {
      const formData = new FormData()
      formData.append('action', 'mat_save_theme_mode')
      formData.append('mode', newTheme)
      formData.append('_ajax_nonce', adminData.nonces.save_theme_mode)

      fetch(adminData.ajaxurl, {
        method: 'POST',
        body: formData
      }).then(response => {
        return response.json()
      }).then(data => {
        if (!data.success) {
          console.error('Failed to save theme preference to server:', data.data || 'Unknown error')
          // Still use localStorage as fallback
        }
      }).catch(error => {
        console.error('Failed to save theme preference to server:', error)
        // localStorage still provides fallback
      })
    } else {
      console.warn('Missing AJAX URL or nonce for saving theme preference')
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <div className="space-y-6">
            <Card className="p-0 overflow-hidden">
              <ChatInterface adminData={adminData} />
            </Card>
          </div>
        )

      case 'seo':
        return <SEO adminData={adminData} />
      case 'analytics':
        return <Analytics adminData={adminData} />
      case 'settings':
        return (
          <Settings 
            settings={settings}
            onSaveSettings={saveSettings}
            isSavingSettings={isSavingSettings}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        )
      default:
        return (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4 text-brand-dark dark:text-white">Welcome to MagicAssistant</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your AI-powered WordPress assistant is ready to help you create, optimize, and manage your website more efficiently.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3 text-brand-dark dark:text-white">Getting Started</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li>• Configure your AI settings</li>
                    <li>• Choose your preferred AI model</li>
                    <li>• Start your first conversation</li>
                  </ul>
                </div>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3 text-brand-dark dark:text-white">Quick Actions</h3>
                  <div className="space-y-2">
                    <Button 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('chat')}
                    >
                      Start AI Chat
                    </Button>
                    <Button 
                      size="sm" 
                      color="gray" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('settings')}
                    >
                      Configure Settings
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-brand-dark dark:text-white">Recent Activity</h3>
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No recent activity yet. Start by having a conversation with your AI assistant!</p>
              </div>
            </Card>
          </div>
        )
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-light dark:bg-brand-dark">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
      </div>
    )
  }

  return (
    <ToastProvider position="top-right" maxToasts={3}>
      <div className={`flex bg-brand-light dark:bg-brand-dark transition-colors duration-300 main-flex-container ${darkMode ? 'dark' : ''}`}>
        {/* Mobile Overlay */}
        <div
          className={`mobile-overlay ${sidebarOpen ? 'show' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

      {/* Sidebar */}
      <div
        className={`sidebar-container sidebar-responsive ${sidebarOpen ? 'open' : ''} ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } transition-all duration-300 bg-white dark:bg-brand-dark border-r border-gray-200 dark:border-gray-600 lg:translate-x-0 lg:static lg:inset-0 relative flex-shrink-0 z-50`}
      >
        {/* Collapse Toggle Button */}
        <div className="sticky top-[32px] h-[calc(100vh-32px)]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-5 -right-3 hidden lg:flex items-center justify-center w-6 h-6 bg-white dark:bg-brand-dark border border-gray-300 dark:border-gray-600 rounded-full shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-accent dark:focus:ring-blue-400 transition-colors duration-200"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>

          <div className="flex gap-2 items-center justify-between flex-shrink-0 p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 mr-3 bg-brand-accent rounded-lg flex items-center justify-center">
                <img 
                  src={adminData?.pluginUrl ? `${adminData.pluginUrl}assets/magicassistant-icon.svg` : '/wp-content/plugins/magicassistant/assets/magicassistant-icon.svg'} 
                  alt="MagicAssistant" 
                  className="w-8 h-8" 
                />
              </div>
              {!sidebarCollapsed && (
                <span className="text-xl font-bold text-brand-dark dark:text-white">MagicAssistant</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {/* Mobile Close Button */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md lg:hidden text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="px-4 pb-4">
            <ul className="space-y-2">
              {navigationItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      setActiveTab(item.id)
                      // Close mobile sidebar when navigating
                      if (window.innerWidth < 1024) {
                        setSidebarOpen(false)
                      }
                      // Update URL to reflect the current tab
                      const url = new URL(window.location)
                      url.searchParams.set('tab', item.id)
                      window.history.pushState({}, '', url)
                    }}
                    className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center p-2' : 'p-3'} text-sm font-medium rounded-lg transition-colors duration-150 ${
                      activeTab === item.id
                        ? 'bg-brand-accent text-brand-dark dark:bg-brand-accent dark:text-brand-dark font-bold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {item.id === 'dashboard' ? (
                      <svg
                        className={`w-6 h-6 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'} ${
                          activeTab === item.id
                            ? 'text-brand-dark'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {item.icon.map((path, index) => (
                          <path key={index} d={path} />
                        ))}
                      </svg>
                    ) : (
                      <svg
                        className={`w-6 h-6 flex-shrink-0 ${sidebarCollapsed ? '' : 'mr-3'} ${
                          activeTab === item.id
                            ? 'text-brand-dark'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                    )}
                    {!sidebarCollapsed && item.label}
                  </button>
                </li>
              ))}
            </ul>
            
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-600">
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={toggleDarkMode}
                    className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center p-2' : 'p-3'} text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-700`}
                    title={sidebarCollapsed ? (darkMode ? 'Switch to light mode' : 'Switch to dark mode') : undefined}
                  >
                    {darkMode ? (
                      <svg
                        className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} text-gray-500 dark:text-gray-400`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg
                        className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} text-gray-500 dark:text-gray-400`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    {!sidebarCollapsed && (darkMode ? 'Light Mode' : 'Dark Mode')}
                  </button>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 main-content-area w-full lg:w-auto">
        {/* Sticky Header */}
        <header className="sticky top-[32px] z-30 bg-white dark:bg-brand-dark border-b border-gray-200 dark:border-gray-600 transition-colors duration-300 shadow-sm">
          {/* Desktop Header Layout */}
          <div className="hidden lg:flex items-center justify-between px-6 py-4">
            <div className="flex items-center">
              <div className="ml-0">
                <h1 className="text-2xl font-extrabold text-brand-dark dark:text-white">
                  {navigationItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                </h1>
                <p className="text-sm font-normal text-gray-600 dark:text-gray-300">
                  {activeTab === 'dashboard' && 'Your AI-powered WordPress assistant overview.'}
                  {activeTab === 'chat' && 'Interact with your AI assistant for content creation and optimization.'}
                  {activeTab === 'seo' && 'Monitor your website\'s SEO performance and keyword rankings.'}
                  {activeTab === 'analytics' && 'View insights about your AI assistant usage and performance.'}
                  {activeTab === 'settings' && 'Configure your MagicAssistant preferences and settings.'}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile/Tablet Header Layout */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </button>
                
                <div className="ml-3">
                  <h1 className="text-lg sm:text-xl font-extrabold text-brand-dark dark:text-white">
                    {navigationItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 bg-brand-light dark:bg-brand-dark transition-colors duration-300">
          <div className="container px-6 py-8 pb-12 w-[100%] max-w-none">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}

// Ensure component has a display name for debugging
AdminApp.displayName = 'AdminApp'

export default AdminApp 