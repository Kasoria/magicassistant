import { useState } from 'react'
import { Card, Select, Label, TextInput, Button } from 'flowbite-react'
import ConfirmationModal from './ConfirmationModal'
import { useToast } from './Toast'

const Settings = ({ settings, onSaveSettings, isSavingSettings, darkMode, onToggleDarkMode }) => {
  const [apiKey, setApiKey] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { showSuccess, showWarning } = useToast()

  const handleSettingsChange = (key, value) => {
    onSaveSettings({ [key]: value })
  }

  const handleDeleteToolsChange = (checked) => {
    if (checked) {
      setShowDeleteModal(true)
    } else {
      handleSettingsChange('enable_delete_tools', false)
      showSuccess('Delete operations disabled for safety')
    }
  }

  const confirmDeleteTools = () => {
    handleSettingsChange('enable_delete_tools', true)
    showWarning('Delete operations enabled - use with caution!')
  }

  const handleApiKeySubmit = (provider) => {
    if (apiKey.trim()) {
      const settingsKey = provider === 'openai' ? 'openai_api_key' : 'anthropic_api_key'
      onSaveSettings({ [settingsKey]: apiKey.trim() })
      setApiKey('')
    }
  }

  const handleDeleteApiKey = async (provider) => {
    if (!window.matAdminData?.restUrl) return
    
    try {
      const response = await fetch(`${window.matAdminData.restUrl}delete-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': window.matAdminData.nonces.wp_rest,
        },
        body: JSON.stringify({ provider })
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
  }

  const openaiModels = [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o3-mini', label: 'o3 Mini' },
  ]

  const anthropicModels = [
    { value: 'claude-sonnet-4-20250514', label: 'Claude 4 Sonnet' },
    { value: 'claude-opus-4-20250514', label: 'Claude 4 Opus' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' }
  ]

  const tabs = [
    { id: 'general', label: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'ai', label: 'AI Configuration', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'agent', label: 'Agent Mode', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { id: 'mcp', label: 'MCP Settings', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <h4 className="font-medium text-brand-dark dark:text-white">Dark Mode</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">Toggle between light and dark themes</p>
              </div>
              <Button size="sm" onClick={onToggleDarkMode}>
                {darkMode ? '☀️ Light' : '🌙 Dark'}
              </Button>
            </div>
          </div>
        )

      case 'ai':
        return (
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">AI Provider</h4>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>🔒 Enhanced Security:</strong> API keys are encrypted using AES-256-CBC before storage. 
                  Once saved, any user can make AI calls with the configured keys.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="ai-provider" value="Provider" className="mb-2" />
                  <Select
                    id="ai-provider"
                    value={settings?.ai_provider || 'openai'}
                    onChange={(e) => handleSettingsChange('ai_provider', e.target.value)}
                    disabled={isSavingSettings}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </Select>
                </div>
              </div>

              {(settings?.ai_provider === 'openai' || !settings?.ai_provider) && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h5 className="font-medium text-brand-dark dark:text-white">OpenAI Configuration</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="openai-model" value="Model" className="mb-2" />
                      <Select
                        id="openai-model"
                        value={settings?.openai_model || 'gpt-4.1-mini'}
                        onChange={(e) => handleSettingsChange('openai_model', e.target.value)}
                        disabled={isSavingSettings}
                      >
                        {openaiModels.map(model => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </Select>
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
                          color="failure"
                          onClick={() => handleDeleteApiKey('openai')}
                          disabled={isSavingSettings}
                        >
                          Delete Key
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {settings?.ai_provider === 'anthropic' && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h5 className="font-medium text-brand-dark dark:text-white">Anthropic Configuration</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="anthropic-model" value="Model" className="mb-2" />
                      <Select
                        id="anthropic-model"
                        value={settings?.anthropic_model || 'claude-sonnet-4-20250514'}
                        onChange={(e) => handleSettingsChange('anthropic_model', e.target.value)}
                        disabled={isSavingSettings}
                      >
                        {anthropicModels.map(model => (
                          <option key={model.value} value={model.value}>{model.label}</option>
                        ))}
                      </Select>
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
                          onClick={() => handleDeleteApiKey('anthropic')}
                          disabled={isSavingSettings}
                        >
                          Delete Key
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'agent':
        return (
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">Agent Mode Configuration</h4>
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>🤖 Agent Mode:</strong> When enabled, the AI can perform multiple tool calls in sequence to complete complex multi-step tasks. 
                  This allows handling requests like "create 3 blog posts and add them to a category" in a single conversation.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="agent-mode" value="Agent Mode" className="mb-2" />
                  <Select
                    id="agent-mode"
                    value={settings?.agent_mode || 'auto'}
                    onChange={(e) => handleSettingsChange('agent_mode', e.target.value)}
                    disabled={isSavingSettings}
                  >
                    <option value="auto">Auto (Smart Detection)</option>
                    <option value="always">Always Agent Mode</option>
                    <option value="never">Never Agent Mode</option>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Auto mode detects complex requests and switches to agent mode automatically
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="max-agent-iterations" value="Max Agent Iterations" className="mb-2" />
                  <Select
                    id="max-agent-iterations"
                    value={settings?.max_agent_iterations || 5}
                    onChange={(e) => handleSettingsChange('max_agent_iterations', parseInt(e.target.value))}
                    disabled={isSavingSettings}
                  >
                    <option value={3}>3 iterations</option>
                    <option value={5}>5 iterations</option>
                    <option value={7}>7 iterations</option>
                    <option value={10}>10 iterations</option>
                  </Select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum number of reasoning/tool execution cycles per request
                  </p>
                </div>
              </div>
              
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
              
              <div className="mt-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Examples of tasks perfect for Agent Mode:</strong>
                  <br/>• "Create 5 blog posts about WordPress and publish them"
                  <br/>• "Find all posts without categories and assign them to 'General'"
                  <br/>• "Create a new product category and add 3 products to it"
                  <br/>• "Update all draft posts to published and notify users"
                </p>
              </div>
            </div>
          </div>
        )

      case 'mcp':
        return (
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
              <h4 className="font-medium text-brand-dark dark:text-white mb-3">MCP (Model Context Protocol)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="mcp-enabled"
                    checked={settings?.mcp_enabled || false}
                    onChange={(e) => handleSettingsChange('mcp_enabled', e.target.checked)}
                    disabled={isSavingSettings}
                    className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <Label htmlFor="mcp-enabled" className="font-medium">
                    Enable MCP (WordPress Actions)
                  </Label>
                </div>
              </div>
              
              <div className="mt-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h5 className="font-medium text-brand-dark dark:text-white mb-3">Operation Permissions</h5>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  Control which types of operations the AI can perform via REST API tools
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable-create-tools"
                      checked={settings?.enable_create_tools !== false}
                      onChange={(e) => handleSettingsChange('enable_create_tools', e.target.checked)}
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
                      checked={settings?.enable_update_tools !== false}
                      onChange={(e) => handleSettingsChange('enable_update_tools', e.target.checked)}
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
                      checked={settings?.enable_delete_tools || false}
                      onChange={(e) => handleDeleteToolsChange(e.target.checked)}
                      disabled={isSavingSettings}
                      className="w-4 h-4 text-brand-accent bg-gray-100 border-gray-300 rounded focus:ring-brand-accent dark:focus:ring-brand-accent dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <Label htmlFor="enable-delete-tools" className="font-medium">
                      Delete Operations
                    </Label>
                  </div>
                </div>
                <div className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> Delete operations are disabled by default for safety. Only enable if you trust the AI to make destructive changes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-brand-dark dark:text-white">Settings</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Configure your MagicAssistant preferences and API settings.
        </p>
        
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-600 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-brand-accent text-brand-accent dark:text-brand-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <svg
                  className={`w-5 h-5 mr-2 ${
                    activeTab === tab.id
                      ? 'text-brand-accent'
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
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {renderTabContent()}
                 </div>
       </Card>

       {/* Confirmation Modal */}
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
     </div>
  )
}

export default Settings 