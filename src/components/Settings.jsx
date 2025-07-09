import { useState, useEffect } from 'react'
import { Card, Label, TextInput, Button } from 'flowbite-react'
import CustomSelect from './CustomSelect'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast'
import SharedConversations from './SharedConversations'
import { countries } from 'countries-list'
import ISO6391 from 'iso-639-1'
import { resetLicenseTour, dismissToursPermanently, hasCompletedLicenseTour, hasDismissedTourPermanently } from '../utils/tour'

const Settings = ({ settings, onSaveSettings, isSavingSettings, darkMode, onToggleDarkMode }) => {
  const [apiKey, setApiKey] = useState('')
  const [dataForSEOLoginId, setDataForSEOLoginId] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showApiKeyDeleteModal, setShowApiKeyDeleteModal] = useState(false)
  const [pendingApiKeyDelete, setPendingApiKeyDelete] = useState(null)
  const [localSettings, setLocalSettings] = useState({})
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [debugLogs, setDebugLogs] = useState(null)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isClearingLogs, setIsClearingLogs] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [showDangerousSqlModal, setShowDangerousSqlModal] = useState(false)
  const [isResettingTour, setIsResettingTour] = useState(false)
  const [isDismissingTours, setIsDismissingTours] = useState(false)
  const [tourStatus, setTourStatus] = useState({
    licenseCompleted: false,
    toursHidden: false
  })
  const { showSuccess, showWarning, showError } = useToast()

  // Update tour status when component mounts or tour functions change
  useEffect(() => {
    const updateTourStatus = () => {
      setTourStatus({
        licenseCompleted: hasCompletedLicenseTour(),
        toursHidden: hasDismissedTourPermanently()
      })
    }
    
    updateTourStatus()
    
    // Listen for tour completion events
    const handleTourCompleted = () => {
      updateTourStatus()
    }
    
    window.addEventListener('tourCompleted', handleTourCompleted)
    
    return () => {
      window.removeEventListener('tourCompleted', handleTourCompleted)
    }
  }, [])

  // Sync local state with props
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        complete_data_removal: settings.complete_data_removal === true,
        ai_provider: settings.ai_provider || 'openai',
        openai_model: settings.openai_model || 'gpt-4.1-mini',
        anthropic_model: settings.anthropic_model || 'claude-sonnet-4-20250514',
        agent_mode: settings.agent_mode || 'never',
        max_agent_iterations: parseInt(settings.max_agent_iterations) || 10,
        mcp_enabled: settings.mcp_enabled === true,
        enable_create_tools: settings.enable_create_tools === true,
        enable_update_tools: settings.enable_update_tools === true,
        enable_delete_tools: settings.enable_delete_tools === true,
        debug_log_raw_responses: settings.debug_log_raw_responses === true,
        max_response_tokens: parseInt(settings.max_response_tokens) || 1500,
        conversation_history_limit: parseInt(settings.conversation_history_limit) || 20,
        manual_competitors: settings.manual_competitors || '',
        show_tips: settings.show_tips === undefined ? true : settings.show_tips,
        seo_target_location: settings.seo_target_location || '',
        seo_target_language: settings.seo_target_language || 'en',
        seo_target_keywords: settings.seo_target_keywords || '',
        floating_chat_enabled: settings.floating_chat_enabled === undefined ? true : settings.floating_chat_enabled,
        floating_chat_conditions: settings.floating_chat_conditions || 'everywhere',
        floating_chat_user_roles: settings.floating_chat_user_roles || [],
        floating_chat_specific_users: settings.floating_chat_specific_users || [],
        floating_chat_frontend_pages: settings.floating_chat_frontend_pages || 'all',
        floating_chat_frontend_urls: settings.floating_chat_frontend_urls || '',
        floating_chat_admin_pages: settings.floating_chat_admin_pages || 'all',
        floating_chat_specific_admin_pages: settings.floating_chat_specific_admin_pages || [],
        floating_chat_button_color: settings.floating_chat_button_color || 'blue',
        floating_chat_button_icon: settings.floating_chat_button_icon || 'chat',
        enable_sql_queries: settings.enable_sql_queries === true,
        enable_dangerous_sql_queries: settings.enable_dangerous_sql_queries === true,
        debug_view_enabled: settings.debug_view_enabled === true,
        debug_view_file_editing: settings.debug_view_file_editing === true,
      })
      setHasUnsavedChanges(false)
    }
  }, [settings])

  const handleLocalChange = (key, value) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }))
    setHasUnsavedChanges(true)
  }

  const handleDeleteToolsChange = (checked) => {
    if (checked) {
      setShowDeleteModal(true)
    } else {
      handleLocalChange('enable_delete_tools', false)
    }
  }

  const confirmDeleteTools = () => {
    handleLocalChange('enable_delete_tools', true)
    showWarning('Delete operations will be enabled when you save these settings')
  }

  const handleApiKeySubmit = (provider) => {
    if (provider === 'dataforseo') {
      // DataForSEO requires both login ID and API key
      if (dataForSEOLoginId.trim() && apiKey.trim()) {
        onSaveSettings({ 
          'dataforseo_login_id': dataForSEOLoginId.trim(),
          'dataforseo_api_key': apiKey.trim() 
        })
        setDataForSEOLoginId('')
        setApiKey('')
      }
    } else if (apiKey.trim()) {
      let settingsKey = ''
      if (provider === 'openai') settingsKey = 'openai_api_key'
      else if (provider === 'anthropic') settingsKey = 'anthropic_api_key'
      else if (provider === 'debug_view') settingsKey = 'debug_view_password'
      
      // For debug view password, also save the enabled state
      if (provider === 'debug_view') {
        onSaveSettings({ 
          [settingsKey]: apiKey.trim(),
          debug_view_enabled: localSettings.debug_view_enabled
        })
      } else {
        onSaveSettings({ [settingsKey]: apiKey.trim() })
      }
      setApiKey('')
    }
  }

  const handleDeleteApiKeyClick = (provider) => {
    setPendingApiKeyDelete(provider)
    setShowApiKeyDeleteModal(true)
  }

  const confirmDeleteApiKey = async () => {
    if (!pendingApiKeyDelete || !window.matAdminData?.restUrl) return
    
    try {
      const response = await fetch(`${window.matAdminData.restUrl}delete-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.matAdminData.nonces.wp_rest,
        },
        body: JSON.stringify({ provider: pendingApiKeyDelete })
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          showSuccess(result.message)
          // Refresh settings to update UI
          window.location.reload()
        }
      }
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
    
    setPendingApiKeyDelete(null)
  }

  const handleSaveTab = async () => {
    const tabSettings = getTabSettings()
    await onSaveSettings(tabSettings)
    setHasUnsavedChanges(false)
    showSuccess('Settings saved successfully!')
  }

  // Load debug logs
  const loadDebugLogs = async () => {
    if (isLoadingLogs) return
    
    setIsLoadingLogs(true)
    
    try {
      const response = await fetch(`${window.matAdminData?.restUrl}debug-logs?limit=200`, {
        headers: {
          'X-WP-Nonce': window.matAdminData?.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDebugLogs(result.data)
        } else {
          showError('Failed to load debug logs')
        }
      } else {
        showError('Failed to load debug logs')
      }
    } catch (error) {
      console.error('Error loading debug logs:', error)
      showError('Failed to load debug logs')
    }
    
    setIsLoadingLogs(false)
  }

  // Clear debug logs
  const clearDebugLogs = async () => {
    if (isClearingLogs) return
    
    if (!confirm('Are you sure you want to clear all debug logs? This action cannot be undone.')) {
      return
    }
    
    setIsClearingLogs(true)
    
    try {
      const response = await fetch(`${window.matAdminData?.restUrl}debug-logs`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': window.matAdminData?.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setDebugLogs(null)
          showSuccess('Debug logs cleared successfully')
        } else {
          showError('Failed to clear debug logs')
        }
      } else {
        showError('Failed to clear debug logs')
      }
    } catch (error) {
      console.error('Error clearing debug logs:', error)
      showError('Failed to clear debug logs')
    }
    
    setIsClearingLogs(false)
  }

  // Download debug logs
  const downloadDebugLogs = () => {
    const downloadUrl = `${window.matAdminData?.restUrl}debug-logs/download`
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `magicassistant-debug-${new Date().toISOString().split('T')[0]}.log`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Copy debug logs to clipboard
  const copyDebugLogs = async () => {
    if (!debugLogs || !debugLogs.recent_entries || debugLogs.recent_entries.length === 0) {
      showError('No log content to copy')
      return
    }

    try {
      const logContent = debugLogs.recent_entries.join('\n')
      await navigator.clipboard.writeText(logContent)
      showSuccess('Debug logs copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy logs to clipboard:', error)
      showError('Failed to copy logs to clipboard')
    }
  }

  // Load available users for selection
  const loadAvailableUsers = async () => {
    if (isLoadingUsers || availableUsers.length > 0) return
    
    setIsLoadingUsers(true)
    
    try {
      const response = await fetch(`${window.matAdminData?.restUrl}users`, {
        headers: {
          'X-WP-Nonce': window.matAdminData?.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const users = await response.json()
        setAvailableUsers(users)
      } else {
        showError('Failed to load users')
      }
    } catch (error) {
      console.error('Error loading users:', error)
      showError('Failed to load users')
    }
    
    setIsLoadingUsers(false)
  }

  // Tour management functions
  const handleResetTour = async () => {
    setIsResettingTour(true)
    try {
      await resetLicenseTour()
      // Update local tour status immediately
      setTourStatus(prev => ({
        ...prev,
        licenseCompleted: false
      }))
      showSuccess('Tour reset successfully! You can now replay the tour.')
    } catch (error) {
      console.error('Reset tour error:', error)
      showError('Failed to reset tour. Please try again.')
    } finally {
      setIsResettingTour(false)
    }
  }

  const handleDismissToursPermanently = async () => {
    setIsDismissingTours(true)
    try {
      await dismissToursPermanently()
      // Update local tour status immediately
      setTourStatus(prev => ({
        ...prev,
        toursHidden: true
      }))
      showSuccess('Tours dismissed permanently. You will no longer see tour prompts.')
    } catch (error) {
      console.error('Dismiss tours error:', error)
      showError('Failed to dismiss tours. Please try again.')
    } finally {
      setIsDismissingTours(false)
    }
  }

  const handleResetAllTours = async () => {
    const confirmed = window.confirm('Are you sure you want to reset all tours for your user account? This will allow you to replay all tours.')
    if (!confirmed) return

    try {
      const formData = new FormData()
      formData.append('action', 'mat_reset_all_tours')
      formData.append('_ajax_nonce', window.matAdminData?.nonces?.mat_ajax || '')

      const response = await fetch(window.matAdminData?.ajaxurl, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      if (result.success) {
        // Update local tour status immediately instead of reloading
        setTourStatus({
          licenseCompleted: false,
          toursHidden: false
        })
        // Also update the global admin data
        if (window.matAdminData?.tourCompleted) {
          window.matAdminData.tourCompleted.license = false
        }
        if (window.matAdminData?.tourDismissed) {
          window.matAdminData.tourDismissed.permanently = false
        }
        showSuccess('All tours reset successfully! You can now replay all tours.')
      } else {
        showError('Failed to reset tours.')
      }
    } catch (error) {
      console.error('Reset all tours error:', error)
      showError('Failed to reset tours. Please try again.')
    }
  }

  const getTabSettings = () => {
    switch (activeTab) {
      case 'general':
        return {
          complete_data_removal: localSettings.complete_data_removal,
          show_tips: localSettings.show_tips,
          debug_view_enabled: localSettings.debug_view_enabled,
          debug_view_file_editing: localSettings.debug_view_file_editing,
        }
      case 'ai':
        return {
          ai_provider: localSettings.ai_provider,
          openai_model: localSettings.openai_model,
          anthropic_model: localSettings.anthropic_model,
          agent_mode: localSettings.agent_mode,
          max_agent_iterations: localSettings.max_agent_iterations,
          mcp_enabled: localSettings.mcp_enabled,
          enable_create_tools: localSettings.enable_create_tools,
          enable_update_tools: localSettings.enable_update_tools,
          enable_delete_tools: localSettings.enable_delete_tools,
          debug_log_raw_responses: localSettings.debug_log_raw_responses,
          max_response_tokens: parseInt(localSettings.max_response_tokens),
          conversation_history_limit: parseInt(localSettings.conversation_history_limit),
          enable_sql_queries: localSettings.enable_sql_queries,
          enable_dangerous_sql_queries: localSettings.enable_dangerous_sql_queries,
          debug_view_enabled: localSettings.debug_view_enabled,
          debug_view_file_editing: localSettings.debug_view_file_editing,
        }
      case 'seo':
        return {
          seo_target_location: localSettings.seo_target_location,
          seo_target_language: localSettings.seo_target_language,
          seo_target_keywords: localSettings.seo_target_keywords,
          manual_competitors: localSettings.manual_competitors
        }
      case 'floating-chat':
        return {
          floating_chat_enabled: localSettings.floating_chat_enabled,
          floating_chat_conditions: localSettings.floating_chat_conditions,
          floating_chat_user_roles: localSettings.floating_chat_user_roles,
          floating_chat_specific_users: localSettings.floating_chat_specific_users,
          floating_chat_frontend_pages: localSettings.floating_chat_frontend_pages,
          floating_chat_frontend_urls: localSettings.floating_chat_frontend_urls,
          floating_chat_admin_pages: localSettings.floating_chat_admin_pages,
          floating_chat_specific_admin_pages: localSettings.floating_chat_specific_admin_pages,
          floating_chat_button_color: localSettings.floating_chat_button_color,
          floating_chat_button_icon: localSettings.floating_chat_button_icon,
        }
      default:
        return {}
    }
  }

  const openaiModels = [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o4-mini', label: 'o4 Mini' },
  ]

  const anthropicModels = [
    { value: 'claude-sonnet-4-20250514', label: 'Claude 4 Sonnet' },
    { value: 'claude-opus-4-20250514', label: 'Claude 4 Opus' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' }
  ]

  const aiProviderOptions = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic (Claude)' }
  ]

  const agentModeOptions = [
    { value: 'never', label: 'Chat Mode' },
    { value: 'always', label: 'Agent Mode' }
  ]

  const maxIterationsOptions = [
    { value: 5, label: '5 iterations (Basic)' },
    { value: 10, label: '10 iterations (Recommended)' },
    { value: 15, label: '15 iterations (Complex)' },
    { value: 25, label: '25 iterations (Advanced)' }
  ]

  // Generate comprehensive language options from ISO 639-1
  const languageOptions = ISO6391.getAllCodes().map(code => ({
    value: code,
    label: `${ISO6391.getName(code)} (${code})`
  })).sort((a, b) => a.label.localeCompare(b.label))

  // Generate comprehensive location options from countries-list
  const locationOptions = [
    { value: '', label: 'Global (No specific location)' },
    ...Object.entries(countries).map(([code, country]) => ({
      value: code,
      label: `${country.name} (${code})`
    })).sort((a, b) => a.label.localeCompare(b.label))
  ]

  const tabs = [
    { id: 'general', label: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'ai', label: 'AI Configuration', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'seo', label: 'SEO Configuration', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'floating-chat', label: 'Floating Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
    { id: 'sharing', label: 'Shared Conversations', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z' }
  ]

  const getTabColors = (tabId) => {
    const colors = {
      'general': { border: 'border-blue-500', text: 'text-blue-600', darkText: 'dark:text-blue-400' },
      'ai': { border: 'border-green-500', text: 'text-green-600', darkText: 'dark:text-green-400' },
      'seo': { border: 'border-purple-500', text: 'text-purple-600', darkText: 'dark:text-purple-400' },
      'floating-chat': { border: 'border-orange-500', text: 'text-orange-600', darkText: 'dark:text-orange-400' },
      'sharing': { border: 'border-pink-500', text: 'text-pink-600', darkText: 'dark:text-pink-400' }
    }
    return colors[tabId] || { border: 'border-brand-accent', text: 'text-brand-accent', darkText: 'dark:text-brand-accent' }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <h4 className="font-medium text-brand-dark dark:text-white">Dark Mode</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Toggle between light and dark themes</p>
              </div>
              <Button size="sm" onClick={onToggleDarkMode}>
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <h4 className="font-medium text-brand-dark dark:text-white">Show Tips</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Display helpful tips and explanations throughout the interface</p>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.show_tips === true}
                  onChange={(e) => handleLocalChange('show_tips', e.target.checked)}
                  disabled={isSavingSettings}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 dark:peer-focus:ring-brand-accent/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-accent dark:peer-checked:bg-brand-accent peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                  Show tips
                </span>
              </label>
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-brand-dark dark:text-white mb-2">Complete Data Removal</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Control what happens to your data when the plugin is uninstalled
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ Important:</strong> When enabled, uninstalling the plugin will permanently delete:
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-200 mt-2 ml-4 list-disc">
                      <li>All chat conversations and history</li>
                      <li>API usage logs and analytics data</li>
                      <li>Plugin settings and configurations</li>
                      <li>Encrypted API keys</li>
                    </ul>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-2">
                      If disabled, all data will be preserved even after uninstallation, allowing you to reinstall later without losing your conversations.
                    </p>
                  </div>
                </div>
                <div className="ml-4">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.complete_data_removal === true}
                      onChange={(e) => handleLocalChange('complete_data_removal', e.target.checked)}
                      disabled={isSavingSettings}
                      className="sr-only peer"
                    />
                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 dark:peer-focus:ring-brand-accent/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-accent dark:peer-checked:bg-brand-accent peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                    <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                      Enable complete removal
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Debug View Settings */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-2">Emergency Debug View</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Provides a standalone debug interface that works even when WordPress has fatal errors. When enabled, debug files are automatically copied to your WordPress root directory for emergency access.
              </p>
              
              {localSettings.show_tips === true && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>🛟 How it works:</strong> When you enable the debug view, the system automatically copies <code>debug-view.php</code> and <code>debug-api.php</code> from the plugin folder to your WordPress root directory. This allows access to debugging tools even when WordPress crashes with fatal errors.
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 ml-4 list-disc">
                    <li>Files are copied automatically when you save these settings</li>
                    <li>Access via: <code>{window.location.origin}/mat-debugging/</code></li>
                    <li>Files are removed automatically when you disable debug view</li>
                    <li>Existing files are backed up before overwriting</li>
                  </ul>
                </div>
              )}
              
              <div className="space-y-4">
                {/* Enable debug view toggle */}
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.debug_view_enabled === true}
                    onChange={(e) => handleLocalChange('debug_view_enabled', e.target.checked)}
                    disabled={isSavingSettings}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 dark:peer-focus:ring-brand-accent/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-accent dark:peer-checked:bg-brand-accent peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                  <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    Enable Debug View
                  </span>
                </label>

                {/* File editing permission (only show when debug view is enabled) */}
                {localSettings.debug_view_enabled === true && (
                  <div className="ml-6 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={localSettings.debug_view_file_editing === true}
                        onChange={(e) => handleLocalChange('debug_view_file_editing', e.target.checked)}
                        disabled={isSavingSettings}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-500/20 dark:peer-focus:ring-red-500/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600 dark:peer-checked:bg-red-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                        Allow File Editing (High Risk)
                      </span>
                    </label>
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <strong>⚠️ Security Warning:</strong> When enabled, the debug view allows direct editing of PHP files on your server. 
                        This is useful for emergency bug fixes but poses significant security risks if accessed by unauthorized users.
                      </p>
                      <ul className="text-sm text-yellow-800 dark:text-yellow-200 mt-2 ml-4 list-disc">
                        <li>Only enable if you need to edit files during emergencies</li>
                        <li>Ensure your debug view password is strong and secure</li>
                        <li>Disable this feature when not actively debugging</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Password field (only show when enabled) */}
                {localSettings.debug_view_enabled === true && (
                  <div>
                    <Label htmlFor="debug-view-password" value="Debug View Password" className="mb-2" />
                    <div className="flex gap-2">
                      <TextInput
                        id="debug-view-password"
                        type="password"
                        placeholder="Enter password for debug view access"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="flex-1"
                        disabled={isSavingSettings}
                      />
                      <Button 
                        onClick={() => handleApiKeySubmit('debug_view')}
                        disabled={!apiKey.trim() || isSavingSettings}
                        size="sm"
                      >
                        {isSavingSettings ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                    {settings?.debug_view_password && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                        ✓ Password configured (encrypted in database)
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This password will be required to access the debug view interface.
                    </p>
                  </div>
                )}

                {/* Debug view access info */}
                {localSettings.debug_view_enabled === true && settings?.debug_view_password && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>🔗 Debug View Access:</strong> Visit <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{window.location.origin}/mat-debugging/</code> to access the emergency debug interface.
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                      <strong>📁 Files Location:</strong> Debug files are automatically placed in your WordPress root directory when you save these settings.
                    </p>
                    {localSettings.debug_view_file_editing === true && (
                      <p className="text-sm text-red-800 dark:text-red-200 mt-2">
                        <strong>🔒 File Editing:</strong> Enabled - Users can edit PHP files directly through the debug interface.
                      </p>
                    )}
                    {localSettings.debug_view_file_editing !== true && (
                      <p className="text-sm text-green-800 dark:text-green-200 mt-2">
                        <strong>🛡️ File Editing:</strong> Disabled - Read-only mode for enhanced security.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tour Management Section */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-2">Tour Management</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Manage your guided tour experience and preferences
              </p>
              
              {/* Tour Status */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h5 className="font-medium text-brand-dark dark:text-white mb-2">Tour Status</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">License Tour:</span>
                    <span className={`font-medium ${tourStatus.licenseCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {tourStatus.licenseCompleted ? '✓ Completed' : 'Not completed'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-300">Tours Dismissed:</span>
                    <span className={`font-medium ${tourStatus.toursHidden ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {tourStatus.toursHidden ? '⚠️ Permanently dismissed' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tour Actions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div>
                    <h5 className="font-medium text-brand-dark dark:text-white">Replay License Tour</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Restart the license activation tour to see it again
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleResetTour}
                    disabled={isResettingTour}
                  >
                    {isResettingTour ? 'Resetting...' : 'Replay Tour'}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div>
                    <h5 className="font-medium text-brand-dark dark:text-white">Reset All Tours</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Reset all tour progress for your user account
                    </p>
                  </div>
                  <Button
                    size="sm"
                    color="warning"
                    onClick={handleResetAllTours}
                    disabled={isResettingTour}
                  >
                    Reset All
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div>
                    <h5 className="font-medium text-brand-dark dark:text-white">Dismiss Tours Permanently</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Hide all tour prompts permanently for your account
                    </p>
                  </div>
                  <Button
                    size="sm"
                    color="failure"
                    onClick={handleDismissToursPermanently}
                    disabled={isDismissingTours || tourStatus.toursHidden}
                  >
                    {isDismissingTours ? 'Dismissing...' : tourStatus.toursHidden ? 'Already Dismissed' : 'Dismiss Tours'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                {hasUnsavedChanges && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ You have unsaved changes
                  </p>
                )}
                <Button
                  onClick={handleSaveTab}
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  className="ml-auto"
                >
                  {isSavingSettings ? 'Saving...' : 'Save General Settings'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'ai':
        return (
          <div className="space-y-6">
            {/* AI Provider Section */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg" data-tour="api-keys-section">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">AI Provider</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="ai-provider" value="Provider" className="mb-2" />
                  <CustomSelect
                    id="ai-provider"
                    value={aiProviderOptions.find(option => option.value === (localSettings.ai_provider || 'openai'))}
                    onChange={(selectedOption) => handleLocalChange('ai_provider', selectedOption.value)}
                    isDisabled={isSavingSettings}
                    options={aiProviderOptions}
                    darkMode={darkMode}
                  />
                </div>
              </div>

              {(localSettings.ai_provider === 'openai' || !localSettings.ai_provider) && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h5 className="font-medium text-brand-dark dark:text-white">OpenAI Configuration</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="openai-model" value="Model" className="mb-2" />
                      <CustomSelect
                        id="openai-model"
                        value={openaiModels.find(option => option.value === (localSettings.openai_model || 'gpt-4.1-mini'))}
                        onChange={(selectedOption) => handleLocalChange('openai_model', selectedOption.value)}
                        isDisabled={isSavingSettings}
                        options={openaiModels}
                        darkMode={darkMode}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="openai-api-key" value="API Key" className="mb-2" />
                    <div className="flex gap-2">
                      <TextInput
                        id="openai-api-key"
                        type="password"
                        placeholder="Enter your OpenAI API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="flex-1"
                        disabled={isSavingSettings}
                      />
                      <Button 
                        onClick={() => handleApiKeySubmit('openai')}
                        disabled={!apiKey.trim() || isSavingSettings}
                        size="sm"
                      >
                        {isSavingSettings ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                    {settings?.openai_api_key && (
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          ✓ API key configured (encrypted in database)
                        </p>
                        <Button
                          size="xs"
                          onClick={() => handleDeleteApiKeyClick('openai')}
                          disabled={isSavingSettings}
                          className="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
                        >
                          Delete Key
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {localSettings.ai_provider === 'anthropic' && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h5 className="font-medium text-brand-dark dark:text-white">Anthropic Configuration</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="anthropic-model" value="Model" className="mb-2" />
                      <CustomSelect
                        id="anthropic-model"
                        value={anthropicModels.find(option => option.value === (localSettings.anthropic_model || 'claude-sonnet-4-20250514'))}
                        onChange={(selectedOption) => handleLocalChange('anthropic_model', selectedOption.value)}
                        isDisabled={isSavingSettings}
                        options={anthropicModels}
                        darkMode={darkMode}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="anthropic-api-key" value="API Key" className="mb-2" />
                    <div className="flex gap-2">
                      <TextInput
                        id="anthropic-api-key"
                        type="password"
                        placeholder="Enter your Anthropic API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="flex-1"
                        disabled={isSavingSettings}
                      />
                      <Button 
                        onClick={() => handleApiKeySubmit('anthropic')}
                        disabled={!apiKey.trim() || isSavingSettings}
                        size="sm"
                      >
                        {isSavingSettings ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                    {settings?.anthropic_api_key && (
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-sm text-green-600 dark:text-green-400">
                          ✓ API key configured (encrypted in database)
                        </p>
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => handleDeleteApiKeyClick('anthropic')}
                          disabled={isSavingSettings}
                        >
                          Delete Key
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* DataForSEO API Key */}
              <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                <h5 className="font-medium text-brand-dark dark:text-white">DataForSEO API Credentials (Optional)</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Enter your own DataForSEO credentials to allow requests to continue after your MagicAssistant license quota is reached.
                </p>
                <div>
                  <Label htmlFor="dataforseo-login-id" value="API Login ID (Email)" className="mb-2" />
                  <TextInput
                    id="dataforseo-login-id"
                    type="email"
                    placeholder="Enter your DataForSEO login email"
                    value={dataForSEOLoginId}
                    onChange={(e) => setDataForSEOLoginId(e.target.value)}
                    className="w-full mb-2"
                    disabled={isSavingSettings}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="dataforseo-api-key" value="API Key" className="mb-2" />
                    <TextInput
                      id="dataforseo-api-key"
                      type="password"
                      placeholder="Enter DataForSEO API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full"
                      disabled={isSavingSettings}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => handleApiKeySubmit('dataforseo')}
                      disabled={!dataForSEOLoginId.trim() || !apiKey.trim() || isSavingSettings}
                      size="sm"
                    >
                      {isSavingSettings ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
                {(settings?.dataforseo_login_id || settings?.dataforseo_api_key) && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-green-600 dark:text-green-400">
                      ✓ DataForSEO credentials configured
                      {settings?.dataforseo_login_id && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          Login ID: {settings.dataforseo_login_id}
                        </span>
                      )}
                    </p>
                    <Button
                      size="xs"
                      className="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
                      onClick={() => handleDeleteApiKeyClick('dataforseo')}
                      disabled={isSavingSettings}
                    >
                      Delete Credentials
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Agent Mode Section */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Agent Mode Configuration</h4>
              {localSettings.show_tips === true && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>🤖 Agent Mode:</strong> When enabled, the AI can perform multiple tool calls in sequence to complete complex multi-step tasks. 
                    This allows handling requests like "create 3 blog posts and add them to a category" in a single conversation.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="agent-mode" value="Agent Mode" className="mb-2" />
                  <CustomSelect
                    id="agent-mode"
                    value={agentModeOptions.find(option => option.value === (localSettings.agent_mode || 'never'))}
                    onChange={(selectedOption) => handleLocalChange('agent_mode', selectedOption.value)}
                    isDisabled={isSavingSettings}
                    options={agentModeOptions}
                    darkMode={darkMode}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Chat Mode: Single response per message. Agent Mode: Multi-step task execution.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="max-agent-iterations" value="Max Agent Iterations" className="mb-2" />
                  <CustomSelect
                    id="max-agent-iterations"
                    value={maxIterationsOptions.find(option => option.value === (localSettings.max_agent_iterations || 10))}
                    onChange={(selectedOption) => handleLocalChange('max_agent_iterations', parseInt(selectedOption.value))}
                    isDisabled={isSavingSettings}
                    options={maxIterationsOptions}
                    darkMode={darkMode}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum number of reasoning/tool execution cycles per request
                  </p>
                </div>
              </div>
              
              {localSettings.show_tips === true && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <h5 className="font-medium text-brand-dark dark:text-white mb-3">How Agent Mode Works</h5>
                  <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 font-bold">1.</span>
                      <span>AI analyzes your request and determines if multiple steps are needed</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 font-bold">2.</span>
                      <span>Executes first set of tools (e.g., create posts)</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 font-bold">3.</span>
                      <span>Reviews results and determines if more actions are needed</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 font-bold">4.</span>
                      <span>Continues with additional tools until request is complete</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-blue-500 font-bold">5.</span>
                      <span>Provides comprehensive summary of all actions taken</span>
                    </div>
                  </div>
                </div>
              )} 
            </div>

            {/* MCP Settings Section */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg" data-tour="mcp-tools-section">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">MCP (Model Context Protocol)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="mcp-enabled"
                    checked={localSettings.mcp_enabled === true}
                    onChange={(e) => handleLocalChange('mcp_enabled', e.target.checked)}
                    disabled={isSavingSettings}
                    className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <Label htmlFor="mcp-enabled" className="font-medium">
                    Enable MCP (WordPress Actions)
                  </Label>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h5 className="font-medium text-brand-dark dark:text-white mb-3">Operation Permissions</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Control which types of operations the AI can perform via REST API tools
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-create-tools"
                      checked={localSettings.enable_create_tools === true}
                      onChange={(e) => handleLocalChange('enable_create_tools', e.target.checked)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-create-tools" className="font-medium">
                      Create Operations
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-update-tools"
                      checked={localSettings.enable_update_tools === true}
                      onChange={(e) => handleLocalChange('enable_update_tools', e.target.checked)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-update-tools" className="font-medium">
                      Update Operations
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-delete-tools"
                      checked={localSettings.enable_delete_tools === true}
                      onChange={(e) => handleDeleteToolsChange(e.target.checked)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-delete-tools" className="font-medium">
                      Delete Operations
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-sql-queries"
                      checked={localSettings.enable_sql_queries === true}
                      onChange={(e) => handleLocalChange('enable_sql_queries', e.target.checked)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-sql-queries" className="font-medium">
                      SQL Query Tool (read-only)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-dangerous-sql"
                      checked={localSettings.enable_dangerous_sql_queries === true}
                      onChange={(e) => handleDangerousSqlChange(e.target.checked)}
                      disabled={isSavingSettings || localSettings.enable_sql_queries !== true}
                      className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-600 dark:focus:ring-red-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-dangerous-sql" className="font-medium text-red-700 dark:text-red-400">
                      FULL SQL (write/delete) – Dangerous
                    </Label>
                  </div>
                  <p className="col-span-full text-xs text-red-600 dark:text-red-400 -mt-2">
                    WARNING: Allows AI to run ANY SQL statement, including UPDATE / DELETE / DROP. Use only if you fully trust actions.
                  </p>
                </div>
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> Delete operations are disabled by default for safety. Only enable if you trust the AI to make destructive changes.
                  </p>
                </div>
              </div>
            </div>

            {/* Cost & Context Controls Section */}
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Response & Context Limits</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Fine-tune token usage and context length to balance cost and answer quality. Lower values reduce cost but may shorten responses or context.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max-response-tokens" value="Max Response Tokens" className="mb-2" />
                  <TextInput
                    id="max-response-tokens"
                    type="number"
                    min="100"
                    max="10000"
                    step="10"
                    value={localSettings.max_response_tokens}
                    onChange={(e) => handleLocalChange('max_response_tokens', e.target.value)}
                    disabled={isSavingSettings}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum tokens the AI can use when generating a single reply (default 1500).
                  </p>
                </div>
                <div>
                  <Label htmlFor="conversation-history-limit" value="History Messages Sent" className="mb-2" />
                  <TextInput
                    id="conversation-history-limit"
                    type="number"
                    min="5"
                    max="100"
                    step="1"
                    value={localSettings.conversation_history_limit}
                    onChange={(e) => handleLocalChange('conversation_history_limit', e.target.value)}
                    disabled={isSavingSettings}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    How many previous messages are sent with each request (default 20).
                  </p>
                </div>
              </div>
            </div>

            {/* Debug Logging Section */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-2">Debug: Raw API Response Logging</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Logs the full raw JSON responses from OpenAI / Anthropic to a custom secure log file. These responses can contain sensitive data. Only enable when troubleshooting and disable afterwards.
              </p>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.debug_log_raw_responses === true}
                  onChange={(e) => handleLocalChange('debug_log_raw_responses', e.target.checked)}
                  disabled={isSavingSettings}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 dark:peer-focus:ring-brand-accent/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-accent dark:peer-checked:bg-brand-accent peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                  Enable raw response logging
                </span>
              </label>
              
              {/* Debug Log Viewer */}
              {localSettings.debug_log_raw_responses === true && (
                <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-600">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-brand-dark dark:text-white">Debug Log Viewer</h5>
                                         <div className="flex space-x-2">
                       <Button
                         size="xs"
                         onClick={loadDebugLogs}
                         disabled={isLoadingLogs}
                         className="bg-blue-600 hover:bg-blue-700 text-white"
                       >
                         {isLoadingLogs ? 'Loading...' : 'Refresh Logs'}
                       </Button>
                       {debugLogs && debugLogs.recent_entries && debugLogs.recent_entries.length > 0 && (
                         <Button
                           size="xs"
                           onClick={copyDebugLogs}
                           className="bg-purple-600 hover:bg-purple-700 text-white"
                         >
                           <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                             <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                             <path d="M3 5a2 2 0 012-2 3 3 0 003 3h6a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
                           </svg>
                           Copy
                         </Button>
                       )}
                       {debugLogs && debugLogs.log_files && debugLogs.log_files.length > 0 && (
                         <Button
                           size="xs"
                           onClick={downloadDebugLogs}
                           className="bg-green-600 hover:bg-green-700 text-white"
                         >
                           <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                           </svg>
                           Download
                         </Button>
                       )}
                       <Button
                         size="xs"
                         onClick={clearDebugLogs}
                         disabled={isClearingLogs}
                         className="bg-red-600 hover:bg-red-700 text-white"
                       >
                         <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                           <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                         </svg>
                         {isClearingLogs ? 'Clearing...' : 'Clear Logs'}
                       </Button>
                     </div>
                  </div>
                  
                  {debugLogs ? (
                    <div className="space-y-3">
                      {/* Log File Info */}
                      {debugLogs.log_files && debugLogs.log_files.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
                          <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Log Files</h6>
                          <div className="space-y-1">
                            {debugLogs.log_files.map((file, index) => (
                              <div key={index} className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                                <span className={file.is_main ? 'font-semibold' : ''}>{file.file}</span>
                                <span>
                                  {(file.size / 1024 / 1024).toFixed(2)} MB • 
                                  {new Date(file.modified * 1000).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Recent Log Entries */}
                      {debugLogs.recent_entries && debugLogs.recent_entries.length > 0 ? (
                        <div className="bg-gray-900 text-green-400 p-4 rounded border font-mono text-xs max-h-96 overflow-y-auto">
                          <div className="flex justify-between items-center mb-2 text-gray-300">
                            <span>Recent log entries (last {debugLogs.recent_entries.length} lines):</span>
                            <span className="text-xs">Log file: {debugLogs.log_file_path}</span>
                          </div>
                          <pre className="whitespace-pre-wrap">
                            {debugLogs.recent_entries.join('\n')}
                          </pre>
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded border text-center text-gray-500 dark:text-gray-400">
                          {debugLogs.is_enabled 
                            ? 'No log entries found. Try making an API request to generate logs.'
                            : 'Debug logging is currently disabled.'
                          }
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded border text-center text-gray-500 dark:text-gray-400">
                      Click "Refresh Logs" to view debug log contents
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                {hasUnsavedChanges && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ You have unsaved changes
                  </p>
                )}
                <Button
                  onClick={handleSaveTab}
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  className="ml-auto"
                >
                  {isSavingSettings ? 'Saving...' : 'Save AI Settings'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'seo':
        return (
          <div className="space-y-6">
            {/* Target Location and Language */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Target Audience</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seo-target-location" value="Target Location" className="mb-2" />
                  <CustomSelect
                    id="seo-target-location"
                    value={locationOptions.find(option => option.value === localSettings.seo_target_location)}
                    onChange={(selectedOption) => handleLocalChange('seo_target_location', selectedOption.value)}
                    isDisabled={isSavingSettings}
                    options={locationOptions}
                    darkMode={darkMode}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Target geographic location for SEO analysis and keyword research
                  </p>
                </div>
                <div>
                  <Label htmlFor="seo-target-language" value="Target Language" className="mb-2" />
                  <CustomSelect
                    id="seo-target-language"
                    value={languageOptions.find(option => option.value === (localSettings.seo_target_language || 'en'))}
                    onChange={(selectedOption) => handleLocalChange('seo_target_language', selectedOption.value)}
                    isDisabled={isSavingSettings}
                    options={languageOptions}
                    darkMode={darkMode}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Primary language for SEO content analysis and recommendations
                  </p>
                </div>
              </div>
            </div>

            {/* Target Keywords */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Target Keywords</h4>
              <div>
                <Label htmlFor="seo-target-keywords" value="Primary Keywords" className="mb-2" />
                <textarea
                  id="seo-target-keywords"
                  rows="6"
                  placeholder="Enter your primary target keywords, one per line (e.g., web development, SEO services, digital marketing, etc.)"
                  value={localSettings.seo_target_keywords}
                  onChange={(e) => handleLocalChange('seo_target_keywords', e.target.value)}
                  disabled={isSavingSettings}
                  className="block w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-brand-accent focus:border-brand-accent dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-brand-accent dark:focus:border-brand-accent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  These keywords will be used for SEO analysis, competitor research, and content optimization suggestions. Enter one keyword or key phrase per line.
                </p>
              </div>
              {localSettings.show_tips === true && (
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💡 Tip:</strong> Focus on 5-10 primary keywords that best represent your business or content. Include both short keywords ("SEO") and long-tail phrases ("local SEO services for small businesses").
                  </p>
                </div>
              )}
            </div>

            {/* Competitor URLs */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Competitor Analysis</h4>
              <div>
                <Label htmlFor="manual-competitors" value="Competitor URLs" className="mb-2" />
                <textarea
                  id="manual-competitors"
                  rows="5"
                  placeholder="Enter competitor domains, one per line (e.g., competitor1.com, competitor2.com, etc.)"
                  value={localSettings.manual_competitors}
                  onChange={(e) => handleLocalChange('manual_competitors', e.target.value)}
                  disabled={isSavingSettings}
                  className="block w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-brand-accent focus:border-brand-accent dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-brand-accent dark:focus:border-brand-accent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  When automatic competitor discovery fails, these manually specified competitors will be used for SEO analysis and benchmarking. Enter one domain per line without http:// or www.
                </p>
              </div>
              {localSettings.show_tips === true && (
                <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <strong>💡 Tip:</strong> Research your top 3-5 industry competitors who rank well for your target keywords. This ensures SEO analysis always has competitor data to work with for benchmarking and opportunity identification.
                  </p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                {hasUnsavedChanges && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ You have unsaved changes
                  </p>
                )}
                <Button
                  onClick={handleSaveTab}
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  className="ml-auto"
                >
                  {isSavingSettings ? 'Saving...' : 'Save SEO Settings'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'floating-chat':
        return (
          <div className="space-y-6">
            {/* Enable/Disable Floating Chat */}
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Floating Chat Widget</h4>
              {localSettings.show_tips === true && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💬 Floating Chat:</strong> When enabled, a floating chat button appears on your website allowing visitors to interact with the AI assistant. 
                    The chat provides the same functionality as the admin interface but is accessible to site visitors.
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-brand-dark dark:text-white">Enable Floating Chat</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Show a floating chat button on your website</p>
                </div>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.floating_chat_enabled === true}
                    onChange={(e) => handleLocalChange('floating_chat_enabled', e.target.checked)}
                    disabled={isSavingSettings}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-accent/20 dark:peer-focus:ring-brand-accent/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-accent dark:peer-checked:bg-brand-accent peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                  <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                    Enable floating chat
                  </span>
                </label>
              </div>
            </div>

            {/* Display Conditions */}
            {localSettings.floating_chat_enabled && (
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-medium text-brand-dark dark:text-white mb-3">Display Conditions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Choose where the floating chat button should appear on your website
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="floating_chat_conditions"
                      value="everywhere"
                      checked={localSettings.floating_chat_conditions === 'everywhere'}
                      onChange={(e) => handleLocalChange('floating_chat_conditions', e.target.value)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Show Everywhere</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Display the floating chat on all pages (frontend and admin)</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="floating_chat_conditions"
                      value="frontend_only"
                      checked={localSettings.floating_chat_conditions === 'frontend_only'}
                      onChange={(e) => handleLocalChange('floating_chat_conditions', e.target.value)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Frontend Only</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Display only on public pages (not in admin area)</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="floating_chat_conditions"
                      value="admin_only"
                      checked={localSettings.floating_chat_conditions === 'admin_only'}
                      onChange={(e) => handleLocalChange('floating_chat_conditions', e.target.value)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Admin Area Only</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Display only in WordPress admin area (not on public pages)</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="floating_chat_conditions"
                      value="logged_in_only"
                      checked={localSettings.floating_chat_conditions === 'logged_in_only'}
                      onChange={(e) => {
                        handleLocalChange('floating_chat_conditions', e.target.value)
                        // Pre-load users when this option is selected
                        if (e.target.value === 'logged_in_only' && availableUsers.length === 0) {
                          loadAvailableUsers()
                        }
                      }}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">Logged-in Users Only</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">Display only when users are logged into WordPress</div>
                    </div>
                  </label>
                </div>

                {/* Advanced Settings for Logged-in Users */}
                {localSettings.floating_chat_conditions === 'logged_in_only' && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-3">User Restrictions</h5>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="floating-chat-user-roles" value="Allowed User Roles" className="mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Leave empty to allow all logged-in users, or select specific roles to restrict access.
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {['administrator', 'editor', 'author', 'contributor', 'subscriber'].map(role => (
                            <label key={role} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={localSettings.floating_chat_user_roles.includes(role)}
                                onChange={(e) => {
                                  const roles = [...localSettings.floating_chat_user_roles]
                                  if (e.target.checked) {
                                    if (!roles.includes(role)) roles.push(role)
                                  } else {
                                    const index = roles.indexOf(role)
                                    if (index > -1) roles.splice(index, 1)
                                  }
                                  handleLocalChange('floating_chat_user_roles', roles)
                                }}
                                disabled={isSavingSettings}
                                className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{role}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="floating-chat-specific-users" value="Specific Users (Advanced)" className="mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Select specific users who should see the floating chat. Leave empty to use role restrictions only.
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                          {!isLoadingUsers && availableUsers.length === 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-300">No users loaded</span>
                              <Button
                                size="xs"
                                onClick={loadAvailableUsers}
                                disabled={isLoadingUsers}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                Load Users
                              </Button>
                            </div>
                          )}
                          
                          {isLoadingUsers && (
                            <div className="flex items-center justify-center p-4">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-accent"></div>
                              <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Loading users...</span>
                            </div>
                          )}
                          
                          {availableUsers.length > 0 && (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Users:</span>
                                <Button
                                  size="xs"
                                  onClick={() => {
                                    setAvailableUsers([])
                                    loadAvailableUsers()
                                  }}
                                  className="bg-gray-600 hover:bg-gray-700 text-white"
                                >
                                  Refresh
                                </Button>
                              </div>
                              {availableUsers.map(user => (
                                <label key={user.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    checked={localSettings.floating_chat_specific_users.includes(user.id)}
                                    onChange={(e) => {
                                      const userIds = [...localSettings.floating_chat_specific_users]
                                      if (e.target.checked) {
                                        if (!userIds.includes(user.id)) userIds.push(user.id)
                                      } else {
                                        const index = userIds.indexOf(user.id)
                                        if (index > -1) userIds.splice(index, 1)
                                      }
                                      handleLocalChange('floating_chat_specific_users', userIds)
                                    }}
                                    disabled={isSavingSettings}
                                    className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300" title={user.email}>
                                    {user.display_name} ({user.username})
                                  </span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          If both roles and specific users are selected, users must match either criteria to see the chat.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Settings for Frontend Only */}
                {localSettings.floating_chat_conditions === 'frontend_only' && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-3">Frontend Page Restrictions</h5>
                    <div className="space-y-4">
                      <div>
                        <Label value="Page Selection" className="mb-2" />
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="floating_chat_frontend_pages"
                              value="all"
                              checked={localSettings.floating_chat_frontend_pages === 'all'}
                              onChange={(e) => handleLocalChange('floating_chat_frontend_pages', e.target.value)}
                              disabled={isSavingSettings}
                              className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">All frontend pages</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="floating_chat_frontend_pages"
                              value="specific"
                              checked={localSettings.floating_chat_frontend_pages === 'specific'}
                              onChange={(e) => handleLocalChange('floating_chat_frontend_pages', e.target.value)}
                              disabled={isSavingSettings}
                              className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Specific pages/patterns only</span>
                          </label>
                        </div>
                      </div>

                      {localSettings.floating_chat_frontend_pages === 'specific' && (
                        <div>
                          <Label htmlFor="floating-chat-frontend-urls" value="URL Patterns" className="mb-2" />
                          <textarea
                            id="floating-chat-frontend-urls"
                            rows="4"
                            placeholder="Enter URL patterns, one per line. Examples:&#10;/contact&#10;/support/*&#10;/blog/*&#10;Use * as wildcard for multiple pages"
                            value={localSettings.floating_chat_frontend_urls}
                            onChange={(e) => handleLocalChange('floating_chat_frontend_urls', e.target.value)}
                            disabled={isSavingSettings}
                            className="block w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-brand-accent focus:border-brand-accent dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-brand-accent dark:focus:border-brand-accent"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Relative URLs starting from site root. Use * for wildcards (e.g., /blog/* matches all blog pages).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Advanced Settings for Admin Only */}
                {localSettings.floating_chat_conditions === 'admin_only' && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-3">Admin Page Restrictions</h5>
                    <div className="space-y-4">
                      <div>
                        <Label value="Admin Page Selection" className="mb-2" />
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="floating_chat_admin_pages"
                              value="all"
                              checked={localSettings.floating_chat_admin_pages === 'all'}
                              onChange={(e) => handleLocalChange('floating_chat_admin_pages', e.target.value)}
                              disabled={isSavingSettings}
                              className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">All admin pages</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="floating_chat_admin_pages"
                              value="specific"
                              checked={localSettings.floating_chat_admin_pages === 'specific'}
                              onChange={(e) => handleLocalChange('floating_chat_admin_pages', e.target.value)}
                              disabled={isSavingSettings}
                              className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Specific admin pages only</span>
                          </label>
                        </div>
                      </div>

                      {localSettings.floating_chat_admin_pages === 'specific' && (
                        <div>
                          <Label value="Select Admin Pages" className="mb-2" />
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {[
                              { value: 'dashboard', label: 'Dashboard' },
                              { value: 'posts', label: 'Posts' },
                              { value: 'pages', label: 'Pages' },
                              { value: 'media', label: 'Media Library' },
                              { value: 'comments', label: 'Comments' },
                              { value: 'appearance', label: 'Appearance' },
                              { value: 'plugins', label: 'Plugins' },
                              { value: 'users', label: 'Users' },
                              { value: 'tools', label: 'Tools' },
                              { value: 'settings', label: 'Settings' },
                              { value: 'woocommerce', label: 'WooCommerce (if active)' }
                            ].map(page => (
                              <label key={page.value} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={localSettings.floating_chat_specific_admin_pages.includes(page.value)}
                                  onChange={(e) => {
                                    const pages = [...localSettings.floating_chat_specific_admin_pages]
                                    if (e.target.checked) {
                                      if (!pages.includes(page.value)) pages.push(page.value)
                                    } else {
                                      const index = pages.indexOf(page.value)
                                      if (index > -1) pages.splice(index, 1)
                                    }
                                    handleLocalChange('floating_chat_specific_admin_pages', pages)
                                  }}
                                  disabled={isSavingSettings}
                                  className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{page.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {localSettings.show_tips === true && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>💡 Tip:</strong> "Frontend Only" is recommended if you want to provide customer support via the floating chat. 
                      "Logged-in Users Only" is good for member sites where you want to restrict access to the AI assistant.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Button Customization */}
            {localSettings.floating_chat_enabled && (
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="font-medium text-brand-dark dark:text-white mb-3">Button Customization</h4>
                {localSettings.show_tips === true && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>🎨 Customization:</strong> Personalize the appearance of your floating chat button to match your website's design. 
                      The button is draggable by users and they can position it anywhere on the screen.
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Background Color Selection */}
                  <div>
                    <Label value="Background Color" className="mb-3 block font-medium" />
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { value: 'blue', label: 'Blue', class: 'bg-blue-600' },
                        { value: 'purple', label: 'Purple', class: 'bg-purple-600' },
                        { value: 'green', label: 'Green', class: 'bg-green-600' },
                        { value: 'red', label: 'Red', class: 'bg-red-600' },
                        { value: 'orange', label: 'Orange', class: 'bg-orange-600' },
                        { value: 'pink', label: 'Pink', class: 'bg-pink-600' },
                        { value: 'indigo', label: 'Indigo', class: 'bg-indigo-600' },
                        { value: 'teal', label: 'Teal', class: 'bg-teal-600' }
                      ].map(color => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-12 h-12 rounded-full border-4 transition-all transform hover:scale-110 ${
                            localSettings.floating_chat_button_color === color.value 
                              ? 'border-gray-900 dark:border-white scale-110 ring-4 ring-gray-300 dark:ring-gray-600' 
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                          } ${color.class}`}
                          onClick={() => {
                            handleLocalChange('floating_chat_button_color', color.value)
                            // Trigger immediate update to FloatingChat component
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('matFloatingChatCustomizationUpdate', {
                                detail: {
                                  backgroundColor: color.value,
                                  icon: localSettings.floating_chat_button_icon
                                }
                              }))
                            }, 0)
                          }}
                          title={color.label}
                          disabled={isSavingSettings}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Current: <span className="font-medium capitalize">{localSettings.floating_chat_button_color}</span>
                    </p>
                  </div>

                  {/* Icon Selection */}
                  <div>
                    <Label value="Icon Style" className="mb-3 block font-medium" />
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { 
                          value: 'chat', 
                          label: 'Chat Bubble',
                          path: 'M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                        },
                        { 
                          value: 'message', 
                          label: 'Message',
                          path: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-8.25L8.25 21l-3-1.5v-12a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25z'
                        },
                        { 
                          value: 'support', 
                          label: 'Support',
                          path: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z'
                        },
                        { 
                          value: 'help', 
                          label: 'Help',
                          path: 'M8.25 9.75h4.875a2.625 2.625 0 010 5.25H8.25m0-10.5h4.875a2.625 2.625 0 010 5.25H8.25m0 0V21m0-12v-3'
                        },
                        { 
                          value: 'assistant', 
                          label: 'AI Assistant',
                          path: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z'
                        }
                      ].map(icon => (
                        <button
                          key={icon.value}
                          type="button"
                          className={`p-3 rounded-lg border-2 transition-all transform hover:scale-105 ${
                            localSettings.floating_chat_button_icon === icon.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105 ring-2 ring-blue-300 dark:ring-blue-600'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                          }`}
                          onClick={() => {
                            handleLocalChange('floating_chat_button_icon', icon.value)
                            // Trigger immediate update to FloatingChat component
                            setTimeout(() => {
                              window.dispatchEvent(new CustomEvent('matFloatingChatCustomizationUpdate', {
                                detail: {
                                  backgroundColor: localSettings.floating_chat_button_color,
                                  icon: icon.value
                                }
                              }))
                            }, 0)
                          }}
                          title={icon.label}
                          disabled={isSavingSettings}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-6 h-6 text-gray-600 dark:text-gray-400"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={icon.path}
                            />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Current: <span className="font-medium capitalize">{localSettings.floating_chat_button_icon.replace('_', ' ')}</span>
                    </p>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-white mb-1">Live Preview</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        This shows how your floating chat button will appear to users
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      {/* Preview Button */}
                      <div
                        className={`flex items-center justify-center h-14 w-14 rounded-full shadow-lg text-white transition-colors ${
                          {
                            blue: 'bg-blue-600',
                            purple: 'bg-purple-600',
                            green: 'bg-green-600',
                            red: 'bg-red-600',
                            orange: 'bg-orange-600',
                            pink: 'bg-pink-600',
                            indigo: 'bg-indigo-600',
                            teal: 'bg-teal-600'
                          }[localSettings.floating_chat_button_color]
                        }`}
                      >
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
                            d={{
                              chat: 'M7.5 8.25h9m-9 3h5.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                              message: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-8.25L8.25 21l-3-1.5v-12a2.25 2.25 0 012.25-2.25h12a2.25 2.25 0 012.25 2.25z',
                              support: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
                              help: 'M8.25 9.75h4.875a2.625 2.625 0 010 5.25H8.25m0-10.5h4.875a2.625 2.625 0 010 5.25H8.25m0 0V21m0-12v-3',
                              assistant: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09z'
                            }[localSettings.floating_chat_button_icon]}
                          />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        <div className="font-medium">Floating Chat Button</div>
                        <div className="text-xs">Draggable by users</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                {hasUnsavedChanges && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ You have unsaved changes
                  </p>
                )}
                <Button
                  onClick={handleSaveTab}
                  disabled={isSavingSettings || !hasUnsavedChanges}
                  className="ml-auto"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Floating Chat Settings'}
                </Button>
              </div>
            </div>
          </div>
        )

      case 'sharing':
        return (
          <SharedConversations adminData={window.matAdminData} />
        )
        
      default:
        return null
    }
  }

  // Handle FULL SQL (dangerous SQL) checkbox change
  const handleDangerousSqlChange = (checked) => {
    if (checked) {
      setShowDangerousSqlModal(true)
    } else {
      handleLocalChange('enable_dangerous_sql_queries', false)
    }
  }

  const confirmDangerousSql = () => {
    handleLocalChange('enable_dangerous_sql_queries', true)
    showWarning('FULL SQL access will be enabled when you save these settings')
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const colors = getTabColors(tab.id)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? `${colors.border} ${colors.text} ${colors.darkText}`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                data-tour={tab.id === 'ai' ? 'ai-configuration-tab' : undefined}
              >
                <svg
                  className={`w-5 h-5 mr-2 ${
                    activeTab === tab.id
                      ? `${colors.text} ${colors.darkText}`
                      : 'text-gray-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {renderTabContent()}
      </div>

      {/* Delete Tools Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteTools}
        title="Enable Delete Operations?"
        message="Are you sure you want to enable delete operations? This will allow the AI to permanently delete content from your WordPress site."
        confirmText="Yes, enable delete operations"
        cancelText="No, keep them disabled"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
        items={[
          "AI can delete posts, pages, and media",
          "AI can delete users and their content", 
          "AI can delete WooCommerce products and orders",
          "These actions cannot be undone"
        ]}
      />

      {/* API Key Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showApiKeyDeleteModal}
        onClose={() => {
          setShowApiKeyDeleteModal(false)
          setPendingApiKeyDelete(null)
        }}
        onConfirm={confirmDeleteApiKey}
        title={pendingApiKeyDelete === 'dataforseo' ? "Delete API Credentials?" : "Delete API Key?"}
        message={pendingApiKeyDelete === 'dataforseo' 
          ? `Are you sure you want to delete the DataForSEO API credentials? This action cannot be undone.`
          : `Are you sure you want to delete the ${pendingApiKeyDelete} API key? This action cannot be undone.`
        }
        confirmText={pendingApiKeyDelete === 'dataforseo' ? "Yes, delete credentials" : "Yes, delete API key"}
        cancelText="No, keep it"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
        items={pendingApiKeyDelete === 'dataforseo' ? [
          "Both the login ID and API key will be permanently removed",
          "You will need to re-enter both credentials to use DataForSEO features",
          "This will not affect your account with DataForSEO"
        ] : [
          "The encrypted API key will be permanently removed",
          "You will need to re-enter the API key to use AI features",
          "This will not affect your account with the provider"
        ]}
      />

      {/* FULL SQL Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDangerousSqlModal}
        onClose={() => setShowDangerousSqlModal(false)}
        onConfirm={confirmDangerousSql}
        title="Enable FULL SQL Access?"
        message="Are you sure you want to enable FULL SQL (write/delete) access? This will allow the AI to execute any SQL statement, including destructive operations."
        confirmText="Yes, enable FULL SQL"
        cancelText="No, keep it disabled"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
        items={[
          "AI can run UPDATE and DELETE queries",
          "AI can DROP tables or alter database schema",
          "These actions can permanently alter or delete data"
        ]}
      />
    </div>
  )
}

export default Settings 