import { useState, useEffect } from 'react'
import { Button, Card, Select, Label, TextInput } from 'flowbite-react'
import ChatInterface from './ChatInterface'
import Settings from './Settings'
import Analytics from './Analytics'
import SEO from './SEO'
import AIAgents from './AIAgents'
import Security from './Security'
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
  { id: 'divider-1', divider: true },
  {
    id: 'agents',
    label: 'AI Agents',
    icon: "M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
  },
  {
    id: 'seo',
    label: 'SEO',
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
  },
  {
    id: 'security',
    label: 'Security',
    icon: "M12 2l8 4v6c0 5.25-3.187 9.73-8 11-4.813-1.27-8-5.75-8-11V6l8-4z"
  },
  { id: 'divider-2', divider: true },
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
  const [dashboardData, setDashboardData] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [tourDriver, setTourDriver] = useState(null)

  // Initialize settings from WordPress
  useEffect(() => {
    if (typeof window.matAdminData !== 'undefined') {
      const data = window.matAdminData
      setAdminData(data)
      setIsLoaded(true)
      
      // Load AI settings
      loadSettings(data)
      
      // Load dashboard data
      loadDashboardData(data)
      
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

  const loadDashboardData = async (data) => {
    if (!data) return

    setDashboardLoading(true)
    
    try {
      const response = await fetch(`${data.restUrl}analytics?days=30`, {
        headers: {
          'X-WP-Nonce': data.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const analyticsData = await response.json()
        setDashboardData(analyticsData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
    
    setDashboardLoading(false)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount || 0)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0)
  }

  // Quick action handlers with pre-filled prompts
  const handleQuickAction = (actionType) => {
    let prompt = ''
    
    switch (actionType) {
      case 'generate_meta_tags':
        prompt = `I need help generating SEO meta tags for my website. Please analyze my site and create:

1. **Meta Title Tags** - Optimized titles for my main pages (60 characters max)
2. **Meta Descriptions** - Compelling descriptions that improve click-through rates (160 characters max)
3. **Open Graph Tags** - Social media optimization tags
4. **Schema Markup** - Structured data recommendations

Please provide:
- Current page analysis and suggestions
- Keyword-optimized titles and descriptions
- Best practices for implementation
- Code snippets ready to use

Start by asking me which specific pages or content types you should focus on.`
        break
      
      case 'check_vulnerabilities':
        prompt = `Please perform a comprehensive security vulnerability check for my WordPress website. I need:

1. **Plugin Security Audit** - Check for known vulnerabilities in my installed plugins
2. **Theme Security Review** - Analyze my active theme for security issues
3. **WordPress Core Security** - Verify my WordPress version and security status
4. **User Security Assessment** - Review user permissions and access controls
5. **File Permissions Check** - Ensure proper file and directory permissions
6. **Login Security Analysis** - Check for brute force protection and strong passwords

Please provide:
- Detailed security assessment report
- Priority-ranked vulnerability list
- Step-by-step remediation instructions
- Security hardening recommendations

Focus on actionable items I can implement immediately to improve my site's security.`
        break
      
      case 'write_blog_post':
        prompt = `I want to create a high-quality blog post for my website. Please help me with:

**Blog Post Details:**
- Topic: [Please ask me about the topic/subject]
- Target Audience: [Please ask me who I'm writing for]
- Tone: [Please ask me: professional, casual, friendly, technical, etc.]
- Length: [Please ask me: short (500-800 words), medium (800-1500 words), long (1500+ words)]

**Content Structure I Need:**
1. **SEO-Optimized Title** - Catchy and search-friendly
2. **Compelling Introduction** - Hook readers from the start
3. **Well-Structured Body** - Main points with subheadings
4. **Conclusion with CTA** - Clear call-to-action
5. **Meta Description** - For SEO purposes

**Additional Requirements:**
- Include relevant keywords naturally
- Add internal linking suggestions
- Provide image suggestions with alt text
- Include social media promotion tips

Please start by asking me about the topic and target audience so you can create the perfect blog post for my needs.`
        break
      
      case 'product_description':
        prompt = `I need help creating compelling product descriptions that convert visitors into customers. Please help me with:

**Product Information Needed:**
- Product Name: [Please ask me]
- Product Category: [Please ask me]
- Key Features: [Please ask me to list main features]
- Target Customer: [Please ask me who would buy this]
- Price Range: [Please ask me if relevant]
- Unique Selling Points: [Please ask me what makes it special]

**Description Elements to Create:**
1. **Attention-Grabbing Headline** - Product title that sells
2. **Benefit-Focused Copy** - How it solves customer problems
3. **Feature Highlights** - Key specifications and features
4. **Social Proof Elements** - Testimonial suggestions
5. **SEO Optimization** - Keyword-rich but natural content
6. **Call-to-Action** - Compelling purchase motivators

**Formats I Need:**
- Short description (1-2 sentences)
- Medium description (1 paragraph)
- Long description (multiple paragraphs)
- Bullet points for key features
- SEO meta description

Please start by asking me about the product details so you can create descriptions that will increase my sales.`
        break
    }
    
    if (prompt) {
      // Store the prompt in sessionStorage for the chat interface to pick up
      sessionStorage.setItem('mat_prefill_message', prompt)
      
      // Dispatch custom event to switch to chat tab
      window.dispatchEvent(new CustomEvent('mat_switch_tab', {
        detail: { tab: 'chat' }
      }))
    }
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
          <ChatInterface adminData={adminData} />
        )
      case 'agents':
        return <AIAgents adminData={adminData} settings={settings} />
      case 'seo':
        return <SEO adminData={adminData} settings={settings} />
      case 'security':
        return <Security adminData={adminData} />
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
            {/* Key Analytics Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Cost Overview */}
              <Card>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-dark dark:text-white">Cost Overview</h3>
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                {dashboardLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-brand-dark dark:text-white mb-2">
                      {formatCurrency(dashboardData?.api_stats?.total_cost || 0)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Avg: {formatCurrency((dashboardData?.api_stats?.total_cost || 0) / Math.max(dashboardData?.chat_stats?.total_sessions || 1, 1))} per session
                    </p>
                  </div>
                )}
              </Card>

              {/* Usage Summary */}
              <Card>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-dark dark:text-white">Usage Summary</h3>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                {dashboardLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-brand-dark dark:text-white mb-2">
                      {formatNumber(dashboardData?.chat_stats?.total_sessions || 0)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatNumber(dashboardData?.chat_stats?.total_messages || 0)} messages sent
                    </p>
                  </div>
                )}
              </Card>

              {/* Quick Stats */}
              <Card>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-brand-dark dark:text-white">AI Performance</h3>
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                {dashboardLoading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-brand-dark dark:text-white mb-2">
                      {dashboardData?.api_stats?.total_requests ? 
                        (((dashboardData.api_stats.total_requests - (dashboardData.api_stats.error_count || 0)) / dashboardData.api_stats.total_requests) * 100).toFixed(1) : '0'}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Success rate ({formatNumber(dashboardData?.api_stats?.total_requests || 0)} requests)
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* Enhanced Quick Actions */}
            <Card>
              <h3 className="text-lg font-semibold text-brand-dark dark:text-white">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* SEO Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">SEO Tools</h4>
                  <Button 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('seo')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    SEO Analysis
                  </Button>
                  <Button 
                    size="sm" 
                    color="gray"
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('generate_meta_tags')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Generate Meta Tags
                  </Button>
                </div>

                {/* Security Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Security</h4>
                  <Button 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('security')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Security Scan
                  </Button>
                  <Button 
                    size="sm" 
                    color="gray"
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('check_vulnerabilities')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Check Vulnerabilities
                  </Button>
                </div>

                {/* Content Generation */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Content</h4>
                  <Button 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('write_blog_post')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Write Blog Post
                  </Button>
                  <Button 
                    size="sm" 
                    color="gray"
                    className="w-full justify-start"
                    onClick={() => handleQuickAction('product_description')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Product Description
                  </Button>
                </div>

                {/* System Actions */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">System</h4>
                  <Button 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    View Analytics
                  </Button>
                  <Button 
                    size="sm" 
                    color="gray"
                    className="w-full justify-start"
                    onClick={() => setActiveTab('settings')}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    Settings
                  </Button>
                </div>
              </div>
            </Card>
            
            {/* Recent Activity with Real Data */}
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-dark dark:text-white">Recent Activity</h3>
                <Button 
                  size="sm" 
                  color="gray"
                  onClick={() => setActiveTab('analytics')}
                >
                  View All
                </Button>
              </div>
              {dashboardLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : dashboardData?.recent_sessions && dashboardData.recent_sessions.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recent_sessions.slice(0, 5).map((session, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-brand-accent/10 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-brand-dark dark:text-white">
                            {session.title || 'AI Conversation'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            {session.message_count} messages • {formatCurrency(session.total_cost)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(session.updated_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatNumber(session.total_tokens)} tokens
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">No recent activity yet</p>
                  <Button 
                    size="sm"
                    onClick={() => setActiveTab('chat')}
                  >
                    Start Your First Conversation
                  </Button>
                </div>
              )}
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
                item.divider ? (
                  <li key={item.id} className="my-2">
                    <hr className="border-gray-200 dark:border-gray-600" />
                  </li>
                ) : (
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
                      data-tour={item.id === 'chat' ? 'chat-tab' : (item.id === 'settings' ? 'settings-tab' : undefined)}
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
                )
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
                <li>
                  <a
                    href="https://magicplugins.io/docs/" target="_blank" rel="noreferrer"
                    className={`flex items-center w-full ${sidebarCollapsed ? 'justify-center p-2' : 'p-3'} text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-700`}
                    title={sidebarCollapsed ? 'Help' : undefined}
                  >
                    <svg
                      className={`w-5 h-5 ${sidebarCollapsed ? '' : 'mr-3'} text-gray-500 dark:text-gray-400`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {!sidebarCollapsed && 'Help'}
                  </a>
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
                  {activeTab === 'agents' && 'Create and manage AI agents with custom personalities and knowledge.'}
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
          <div className={`${activeTab === 'chat' ? '' : 'p-6'} container w-[100%] h-full max-w-none`}>
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