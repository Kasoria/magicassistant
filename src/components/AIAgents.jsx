import { useState, useEffect, useRef } from 'react'
import { Button, Card, Badge, Spinner, TextInput, Label, Select, Textarea } from 'flowbite-react'
import FormModal from './FormModal'
import { useToast } from './Toast'
import ChatbotInterface from './ChatbotInterface'

// Color Input Component
const ColorInput = ({ id, label, value, onChange, className = "" }) => (
  <div className={className}>
    <Label htmlFor={id}>{label}</Label>
    <div className="mt-1">
      <input
        id={id}
        type="color"
        value={value}
        onChange={onChange}
        className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
      />
    </div>
  </div>
)

// Accordion Section Component
const AccordionSection = ({ title, description, isOpen, onToggle, children }) => (
  <div className={`border-2 rounded-lg mb-3 transition-all ${
    isOpen
      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
  }`}>
    <button
      type="button"
      onClick={onToggle}
      className={`w-full px-5 py-4 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors ${
        isOpen
          ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30'
          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <div>
        <h3 className={`text-base font-semibold ${
          isOpen
            ? 'text-blue-900 dark:text-blue-100'
            : 'text-gray-900 dark:text-white'
        }`}>{title}</h3>
        {description && (
          <p className={`text-xs mt-1 ${
            isOpen
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-500 dark:text-gray-400'
          }`}>{description}</p>
        )}
      </div>
      <svg
        className={`w-5 h-5 transition-all ${
          isOpen
            ? 'rotate-180 text-blue-600 dark:text-blue-400'
            : 'text-gray-400 dark:text-gray-500'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {isOpen && (
      <div className="px-5 py-4 border-t-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 rounded-b-lg">
        {children}
      </div>
    )}
  </div>
)

// Searchable Knowledge Base Dropdown Component
const SearchableKBDropdown = ({ knowledgeBaseEntries, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Filter KB entries based on search term
  const filteredEntries = knowledgeBaseEntries.filter(kb => 
    kb.is_active && (
      kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (kb.category && kb.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  )

  // Get selected entries for display
  const selectedEntries = knowledgeBaseEntries.filter(kb => 
    selectedIds.includes(parseInt(kb.id))
  )

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleEntry = (entryId) => {
    const newSelectedIds = selectedIds.includes(entryId)
      ? selectedIds.filter(id => id !== entryId)
      : [...selectedIds, entryId]
    
    onChange(newSelectedIds)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-4 py-2.5 inline-flex items-center w-full justify-between dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700"
      >
        <span>
          {selectedEntries.length > 0 
            ? `${selectedEntries.length} KB entries selected`
            : 'Select Knowledge Base entries'}
        </span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 dark:bg-gray-700 dark:border-gray-600 max-h-80 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"></path>
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full p-2 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="Search KB entries..."
              />
            </div>
          </div>

          {/* KB Entries List */}
          <div className="max-h-60 overflow-y-auto">
            {filteredEntries.length > 0 ? (
              filteredEntries.map((kb) => (
                <div key={kb.id} className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <input
                    type="checkbox"
                    id={`kb-${kb.id}`}
                    checked={selectedIds.includes(parseInt(kb.id))}
                    onChange={() => handleToggleEntry(parseInt(kb.id))}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor={`kb-${kb.id}`} className="ml-3 flex-1 cursor-pointer">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {kb.name}
                    </div>
                    {kb.category && (
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        {kb.category}
                      </div>
                    )}
                    {kb.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {kb.description}
                      </div>
                    )}
                  </label>
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {searchTerm ? 'No KB entries found matching your search.' : 'No KB entries available.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Entries Tags */}
      {selectedEntries.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedEntries.map((entry) => (
            <span
              key={entry.id}
              className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full dark:bg-blue-900 dark:text-blue-300"
            >
              {entry.name}
              <button
                type="button"
                onClick={() => handleToggleEntry(parseInt(entry.id))}
                className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const AIAgents = ({ adminData, settings }) => {
  const [activeTab, setActiveTab] = useState('agents')
  const [agents, setAgents] = useState([])
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState([])
  const [chatbots, setChatbots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [showKBModal, setShowKBModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState(null)
  const [editingKB, setEditingKB] = useState(null)
  const [editingChatbot, setEditingChatbot] = useState(null)
  const { showSuccess, showError } = useToast()

  // Accordion state for chatbot form
  const [accordionState, setAccordionState] = useState({
    general: true,
    trigger: false,
    appearance: false,
    behavior: false,
    visibility: false,
    advanced: false
  })

  const toggleAccordion = (section) => {
    setAccordionState(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Design preset functions
  const applyDesignPreset = (presetName) => {
    const presets = {
      modern: {
        // Colors & Theme
        primary_color: '#3B82F6',
        secondary_color: '#F8FAFC',
        background_color: '#FFFFFF',

        // Header
        header_background: '#3B82F6',
        header_text_color: '#FFFFFF',
        header_font_size: 16,
        header_font_weight: 600,

        // Messages
        message_background_user: '#3B82F6',
        message_background_bot: '#F1F5F9',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#1E293B',
        message_font_size: 14,
        message_font_weight: 400,

        // Input & Button
        input_background: '#FFFFFF',
        input_text_color: '#1F2937',
        input_border_color: '#D1D5DB',
        input_font_size: 14,
        send_button_background: '#3B82F6',
        send_button_text_color: '#FFFFFF',
        send_button_hover_background: '#2563EB',

        // Layout
        width: 380,
        height: 500,
        border_radius: 16,

        // Typography
        font_family: 'Inter, system-ui, sans-serif'
      },
      dark: {
        // Colors & Theme
        primary_color: '#10B981',
        secondary_color: '#1F2937',
        background_color: '#111827',

        // Header
        header_background: '#10B981',
        header_text_color: '#FFFFFF',
        header_font_size: 16,
        header_font_weight: 600,

        // Messages
        message_background_user: '#10B981',
        message_background_bot: '#374151',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#F9FAFB',
        message_font_size: 14,
        message_font_weight: 400,

        // Input & Button
        input_background: '#374151',
        input_text_color: '#F9FAFB',
        input_border_color: '#4B5563',
        input_font_size: 14,
        send_button_background: '#10B981',
        send_button_text_color: '#FFFFFF',
        send_button_hover_background: '#059669',

        // Layout
        width: 380,
        height: 500,
        border_radius: 12,

        // Typography
        font_family: 'Inter, system-ui, sans-serif'
      },
      minimal: {
        // Colors & Theme
        primary_color: '#6B7280',
        secondary_color: '#FFFFFF',
        background_color: '#FFFFFF',

        // Header
        header_background: '#FFFFFF',
        header_text_color: '#374151',
        header_font_size: 15,
        header_font_weight: 500,

        // Messages
        message_background_user: '#374151',
        message_background_bot: '#F9FAFB',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#374151',
        message_font_size: 13,
        message_font_weight: 400,

        // Input & Button
        input_background: '#FFFFFF',
        input_text_color: '#374151',
        input_border_color: '#E5E7EB',
        input_font_size: 13,
        send_button_background: '#374151',
        send_button_text_color: '#FFFFFF',
        send_button_hover_background: '#1F2937',

        // Layout
        width: 360,
        height: 480,
        border_radius: 8,

        // Typography
        font_family: 'system-ui, -apple-system, sans-serif'
      },
      vibrant: {
        // Colors & Theme
        primary_color: '#EC4899',
        secondary_color: '#FDF2F8',
        background_color: '#FFFFFF',

        // Header
        header_background: '#EC4899',
        header_text_color: '#FFFFFF',
        header_font_size: 17,
        header_font_weight: 700,

        // Messages
        message_background_user: '#EC4899',
        message_background_bot: '#F3E8FF',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#581C87',
        message_font_size: 14,
        message_font_weight: 500,

        // Input & Button
        input_background: '#FFFFFF',
        input_text_color: '#581C87',
        input_border_color: '#EC4899',
        input_font_size: 14,
        send_button_background: '#EC4899',
        send_button_text_color: '#FFFFFF',
        send_button_hover_background: '#BE185D',

        // Layout
        width: 400,
        height: 520,
        border_radius: 20,

        // Typography
        font_family: 'Inter, system-ui, sans-serif'
      }
    }

    const preset = presets[presetName]
    if (preset) {
      setChatbotForm({
        ...chatbotForm,
        chatbot_styling: {
          ...chatbotForm.chatbot_styling,
          ...preset
        }
      })
    }
  }

  // Form states
  const [agentForm, setAgentForm] = useState({
    name: '',
    description: '',
    system_message: '',
    tonality: 'professional',
    response_length: 'medium',
    temperature: 0.7,
    max_tokens: 2000,
    knowledge_base_ids: [],
    is_active: true
  })

  const [kbForm, setKbForm] = useState({
    name: '',
    description: '',
    content: '',
    tags: '',
    category: '',
    is_active: true,
    content_source: 'text', // 'text', 'file', 'url'
    source_url: '',
    uploaded_file: null
  })

  const [chatbotForm, setChatbotForm] = useState({
    name: '',
    description: '',
    agent_id: '',
    trigger_button_settings: {
      position: 'bottom-right',
      color: '#3B82F6',
      icon: 'chat',
      size: 'medium',
      offset_x: 24,
      offset_y: 24,
      custom_icon: ''
    },
    chatbot_styling: {
      // Layout & Dimensions
      width: 380,
      height: 500,
      border_radius: 12,

      // Colors & Theme
      primary_color: '#3B82F6',
      secondary_color: '#F3F4F6',
      background_color: '#FFFFFF',

      // Header Styling
      header_background: '#3B82F6',
      header_text_color: '#FFFFFF',
      header_font_size: 16,
      header_font_weight: 600,

      // Message Styling
      message_background_user: '#3B82F6',
      message_background_bot: '#F3F4F6',
      message_text_color_user: '#FFFFFF',
      message_text_color_bot: '#1F2937',
      message_font_size: 14,
      message_font_weight: 400,

      // Input Area Styling
      input_background: '#FFFFFF',
      input_text_color: '#1F2937',
      input_border_color: '#D1D5DB',
      input_font_size: 14,

      // Button Styling
      send_button_background: '#3B82F6',
      send_button_text_color: '#FFFFFF',
      send_button_hover_background: '#2563EB',

      // Quick Messages Styling
      quick_message_background: 'transparent',
      quick_message_text_color: '#3B82F6',
      quick_message_border_color: '#3B82F6',
      quick_message_font_size: 12,

      // Typography
      font_family: 'Inter, system-ui, sans-serif',

      // Animations & Effects
      enable_animations: true,
      typing_indicator_color: '#9CA3AF'
    },
    behavior_settings: {
      persist_sessions: true,
      welcome_message: 'Hello! How can I help you today?',
      typing_indicator: true,
      auto_expand: false
    },
    quick_messages: [
      'How can I contact you?',
      'What are your business hours?',
      'Tell me about your services'
    ],
    display_conditions: {
      display_mode: ['everywhere'], // Array: can include 'everywhere', 'frontend_only', 'admin_only', 'logged_in_only'
      frontend_pages: 'all', // 'all', 'specific'
      frontend_urls: '', // URL patterns for frontend (newline separated)
      admin_pages: 'all', // 'all', 'specific'
      specific_admin_pages: [], // Array of admin page slugs
      url_patterns: [], // Array of URL pattern objects with {pattern: '', match_type: 'contains|exact|regex'}
      user_roles: [], // Array of role strings
      specific_users: [], // Array of user IDs
      devices: 'all' // 'all', 'desktop', 'mobile', 'tablet'
    },
    rate_limit_settings: {
      enabled: false,
      max_messages_per_hour: 10,
      max_messages_per_day: 50
    },
    is_active: true
  })
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [availableUsers, setAvailableUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!adminData?.restUrl) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      
      // Load agents, knowledge base entries, and chatbots
      const [agentsResponse, kbResponse, chatbotsResponse] = await Promise.all([
        fetch(`${adminData.restUrl}ai-agents`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
        }),
        fetch(`${adminData.restUrl}knowledge-base`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
        }),
        fetch(`${adminData.restUrl}chatbots`, {
          headers: {
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
        })
      ])

      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json()
        if (agentsData.success) {
          setAgents(agentsData.data || [])
        }
      }

      if (kbResponse.ok) {
        const kbData = await kbResponse.json()
        if (kbData.success) {
          setKnowledgeBaseEntries(kbData.data || [])
        }
      }

      if (chatbotsResponse.ok) {
        const chatbotsData = await chatbotsResponse.json()
        if (chatbotsData.success) {
          setChatbots(chatbotsData.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableUsers = async () => {
    if (!adminData?.restUrl || isLoadingUsers) {
      return
    }

    try {
      setIsLoadingUsers(true)
      const response = await fetch(`${adminData.restUrl}users`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      if (response.ok) {
        const usersData = await response.json()
        if (usersData.success) {
          setAvailableUsers(usersData.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const resetAgentForm = () => {
    setAgentForm({
      name: '',
      description: '',
      system_message: '',
      tonality: 'professional',
      response_length: 'medium',
      temperature: 0.7,
      max_tokens: 2000,
      knowledge_base_ids: [],
      is_active: true
    })
    setEditingAgent(null)
  }

  const resetKBForm = () => {
    setKbForm({
      name: '',
      description: '',
      content: '',
      tags: '',
      category: '',
      is_active: true,
      content_source: 'text',
      source_url: '',
      uploaded_file: null
    })
    setEditingKB(null)
    setIsProcessing(false)
  }

  const resetChatbotForm = () => {
    setChatbotForm({
      name: '',
      description: '',
      agent_id: '',
      custom_header_name: '',
      custom_header_logo: '',
      trigger_button_settings: {
        position: 'bottom-right',
        color: '#3B82F6',
        icon: 'chat',
        size: 'medium',
        offset_x: 24,
        offset_y: 24,
        custom_icon: ''
      },
      chatbot_styling: {
        // Layout & Dimensions
        width: 380,
        height: 500,
        border_radius: 12,

        // Colors & Theme
        primary_color: '#3B82F6',
        secondary_color: '#F3F4F6',
        background_color: '#FFFFFF',

        // Header Styling
        header_background: '#3B82F6',
        header_text_color: '#FFFFFF',
        header_font_size: 16,
        header_font_weight: 600,

        // Message Styling
        message_background_user: '#3B82F6',
        message_background_bot: '#F3F4F6',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#1F2937',
        message_font_size: 14,
        message_font_weight: 400,

        // Input Area Styling
        input_background: '#FFFFFF',
        input_text_color: '#1F2937',
        input_border_color: '#D1D5DB',
        input_font_size: 14,

        // Button Styling
        send_button_background: '#3B82F6',
        send_button_text_color: '#FFFFFF',
        send_button_hover_background: '#2563EB',

        // Quick Messages Styling
        quick_message_background: 'transparent',
        quick_message_text_color: '#3B82F6',
        quick_message_border_color: '#3B82F6',
        quick_message_font_size: 12,

        // Typography
        font_family: 'Inter, system-ui, sans-serif',

        // Animations & Effects
        enable_animations: true,
        typing_indicator_color: '#9CA3AF'
      },
      behavior_settings: {
        persist_sessions: true,
        welcome_message: 'Hello! How can I help you today?',
        typing_indicator: true,
        auto_expand: false
      },
      quick_messages: [
        'How can I contact you?',
        'What are your business hours?',
        'Tell me about your services'
      ],
      display_conditions: {
        display_mode: ['everywhere'],
        frontend_pages: 'all',
        frontend_urls: '',
        admin_pages: 'all',
        specific_admin_pages: [],
        url_patterns: [],
        user_roles: [],
        specific_users: [],
        devices: 'all'
      },
      rate_limit_settings: {
        enabled: false,
        max_messages_per_hour: 10,
        max_messages_per_day: 50
      },
      is_active: true
    })
    setEditingChatbot(null)
  }

  const handleCreateAgent = () => {
    resetAgentForm()
    setShowAgentModal(true)
  }

  const handleEditAgent = (agent) => {
    setAgentForm({
      name: agent.name || '',
      description: agent.description || '',
      system_message: agent.system_message || '',
      tonality: agent.tonality || 'professional',
      response_length: agent.response_length || 'medium',
      temperature: parseFloat(agent.temperature) || 0.7,
      max_tokens: parseInt(agent.max_tokens) || 2000,
      knowledge_base_ids: agent.knowledge_base_ids ? agent.knowledge_base_ids.split(',').map(id => parseInt(id)).filter(id => id > 0) : [],
      is_active: agent.is_active === '1' || agent.is_active === 1
    })
    setEditingAgent(agent)
    setShowAgentModal(true)
  }

  const handleSaveAgent = async () => {
    if (!adminData?.restUrl || !agentForm.name.trim()) {
      showError('Agent name is required')
      return
    }

    try {
      const url = editingAgent 
        ? `${adminData.restUrl}ai-agents/${editingAgent.id}`
        : `${adminData.restUrl}ai-agents`
      
      const response = await fetch(url, {
        method: editingAgent ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(agentForm)
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess(editingAgent ? 'Agent updated successfully' : 'Agent created successfully')
        setShowAgentModal(false)
        resetAgentForm()
        loadData()
      } else {
        showError(result.message || 'Failed to save agent')
      }
    } catch (error) {
      console.error('Failed to save agent:', error)
      showError('Failed to save agent. Please try again.')
    }
  }

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}ai-agents/${agentId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess('Agent deleted successfully')
        loadData()
      } else {
        showError(result.message || 'Failed to delete agent')
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      showError('Failed to delete agent. Please try again.')
    }
  }

  const handleCreateKB = () => {
    resetKBForm()
    setShowKBModal(true)
  }

  const handleEditKB = (kb) => {
    setKbForm({
      name: kb.name || '',
      description: kb.description || '',
      content: kb.content || '',
      tags: kb.tags || '',
      category: kb.category || '',
      is_active: kb.is_active === '1' || kb.is_active === 1,
      content_source: 'text', // Default to text for existing entries
      source_url: '',
      uploaded_file: null
    })
    setEditingKB(kb)
    setShowKBModal(true)
  }

  const handleFileUpload = async (file) => {
    if (!file) return

    setIsProcessing(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/process-file`, {
        method: 'POST',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: formData
      })

      const result = await response.json()
      
      if (result.success) {
        if (result.data.file_type === 'image') {
          // Handle image files - store image info for attachment
          setKbForm({
            ...kbForm, 
            content: result.data.content,
            uploaded_file: {
              ...file,
              attachment_id: result.data.attachment_id,
              file_url: result.data.file_url,
              file_path: result.data.file_path,
              file_type: 'image'
            }
          })
          showSuccess('Image file saved successfully')
        } else {
          // Handle text files - display extracted content
          setKbForm({...kbForm, content: result.data.content, uploaded_file: file})
          showSuccess('Text file processed successfully')
        }
      } else {
        showError(result.message || 'Failed to process file')
      }
    } catch (error) {
      console.error('Failed to process file:', error)
      showError('Failed to process file. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUrlScraping = async (url) => {
    if (!url.trim()) {
      showError('Please enter a valid URL')
      return
    }

    setIsProcessing(true)
    
    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/scrape-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({ url: url.trim() })
      })

      const result = await response.json()
      
      if (result.success) {
        setKbForm({...kbForm, content: result.data.content, source_url: url.trim()})
        showSuccess('URL content scraped successfully')
      } else {
        showError(result.message || 'Failed to scrape URL')
      }
    } catch (error) {
      console.error('Failed to scrape URL:', error)
      showError('Failed to scrape URL. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveKB = async () => {
    if (!adminData?.restUrl || !kbForm.name.trim()) {
      showError('Name is required')
      return
    }

    // Validate content based on source type
    if (kbForm.content_source === 'text' && !kbForm.content.trim()) {
      showError('Content is required')
      return
    }
    
    if (kbForm.content_source === 'url' && !kbForm.source_url.trim()) {
      showError('Please enter a URL to scrape')
      return
    }
    
    if (kbForm.content_source === 'file' && !kbForm.uploaded_file && !kbForm.content.trim()) {
      showError('Please upload a file or the file processing failed')
      return
    }

    try {
      const url = editingKB 
        ? `${adminData.restUrl}knowledge-base/${editingKB.id}`
        : `${adminData.restUrl}knowledge-base`
      
      const response = await fetch(url, {
        method: editingKB ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(kbForm)
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess(editingKB ? 'Knowledge base entry updated successfully' : 'Knowledge base entry created successfully')
        setShowKBModal(false)
        resetKBForm()
        loadData()
      } else {
        showError(result.message || 'Failed to save knowledge base entry')
      }
    } catch (error) {
      console.error('Failed to save knowledge base entry:', error)
      showError('Failed to save knowledge base entry. Please try again.')
    }
  }

  const handleDeleteKB = async (kbId) => {
    if (!confirm('Are you sure you want to delete this knowledge base entry?')) {
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}knowledge-base/${kbId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess('Knowledge base entry deleted successfully')
        loadData()
      } else {
        showError(result.message || 'Failed to delete knowledge base entry')
      }
    } catch (error) {
      console.error('Failed to delete knowledge base entry:', error)
      showError('Failed to delete knowledge base entry. Please try again.')
    }
  }

  const handleCreateChatbot = () => {
    resetChatbotForm()
    setActiveTab('chatbot-form')
  }

  const handleEditChatbot = (chatbot) => {
    setChatbotForm({
      name: chatbot.name || '',
      description: chatbot.description || '',
      agent_id: chatbot.agent_id || '',
      custom_header_name: chatbot.custom_header_name || '',
      custom_header_logo: chatbot.custom_header_logo || '',
      trigger_button_settings: {
        position: chatbot.trigger_button_settings?.position || 'bottom-right',
        color: chatbot.trigger_button_settings?.color || '#3B82F6',
        icon: chatbot.trigger_button_settings?.icon || 'chat',
        size: chatbot.trigger_button_settings?.size || 'medium',
        offset_x: chatbot.trigger_button_settings?.offset_x || 24,
        offset_y: chatbot.trigger_button_settings?.offset_y || 24,
        custom_icon: chatbot.trigger_button_settings?.custom_icon || ''
      },
      chatbot_styling: chatbot.chatbot_styling || {
        primary_color: '#3B82F6',
        secondary_color: '#F3F4F6',
        font_family: 'Inter, sans-serif',
        border_radius: 12,
        header_background: '#3B82F6',
        header_text_color: '#FFFFFF',
        message_background_user: '#3B82F6',
        message_background_bot: '#F3F4F6',
        message_text_color_user: '#FFFFFF',
        message_text_color_bot: '#1F2937'
      },
      behavior_settings: chatbot.behavior_settings || {
        persist_sessions: true,
        welcome_message: 'Hello! How can I help you today?',
        typing_indicator: true,
        auto_expand: false
      },
      quick_messages: chatbot.quick_messages || [
        'How can I contact you?',
        'What are your business hours?',
        'Tell me about your services'
      ],
      display_conditions: {
        // Handle backward compatibility: convert old string format to array
        display_mode: chatbot.display_conditions?.display_mode
          ? (Array.isArray(chatbot.display_conditions.display_mode)
            ? chatbot.display_conditions.display_mode
            : [chatbot.display_conditions.display_mode])
          : ['everywhere'],
        frontend_pages: chatbot.display_conditions?.frontend_pages || 'all',
        frontend_urls: chatbot.display_conditions?.frontend_urls || '',
        admin_pages: chatbot.display_conditions?.admin_pages || 'all',
        specific_admin_pages: chatbot.display_conditions?.specific_admin_pages || [],
        url_patterns: chatbot.display_conditions?.url_patterns || [],
        user_roles: chatbot.display_conditions?.user_roles || [],
        specific_users: chatbot.display_conditions?.specific_users || [],
        devices: chatbot.display_conditions?.devices || 'all'
      },
      rate_limit_settings: chatbot.rate_limit_settings || {
        enabled: false,
        max_messages_per_hour: 10,
        max_messages_per_day: 50
      },
      is_active: chatbot.is_active === '1' || chatbot.is_active === 1
    })
    setEditingChatbot(chatbot)
    setActiveTab('chatbot-form')
  }

  const handleSaveChatbot = async () => {
    if (!adminData?.restUrl || !chatbotForm.name.trim()) {
      showError('Chatbot name is required')
      return
    }

    if (!chatbotForm.agent_id) {
      showError('Please select an AI Agent')
      return
    }

    try {
      const url = editingChatbot 
        ? `${adminData.restUrl}chatbots/${editingChatbot.id}`
        : `${adminData.restUrl}chatbots`
      
      const response = await fetch(url, {
        method: editingChatbot ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify(chatbotForm)
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess(editingChatbot ? 'Chatbot updated successfully' : 'Chatbot created successfully')
        setActiveTab('chatbots')
        resetChatbotForm()
        loadData()
      } else {
        showError(result.message || 'Failed to save chatbot')
      }
    } catch (error) {
      console.error('Failed to save chatbot:', error)
      showError('Failed to save chatbot. Please try again.')
    }
  }

  const handleDeleteChatbot = async (chatbotId) => {
    if (!confirm('Are you sure you want to delete this chatbot?')) {
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}chatbots/${chatbotId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })

      const result = await response.json()
      
      if (result.success) {
        showSuccess('Chatbot deleted successfully')
        loadData()
      } else {
        showError(result.message || 'Failed to delete chatbot')
      }
    } catch (error) {
      console.error('Failed to delete chatbot:', error)
      showError('Failed to delete chatbot. Please try again.')
    }
  }

  const renderTabButton = (tabId, label, count = null) => (
    <button
      key={tabId}
      onClick={() => setActiveTab(tabId)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 flex items-center gap-2 ${
        activeTab === tabId
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {label}
      {count !== null && (
        <Badge color={activeTab === tabId ? 'info' : 'gray'} size="sm">
          {count}
        </Badge>
      )}
    </button>
  )

  const renderAgentsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">AI Agents</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage AI agents with custom personalities and knowledge.</p>
        </div>
        <Button onClick={handleCreateAgent}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Agent
        </Button>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {agent.description || 'No description'}
                  </p>
                </div>
                <Badge color={agent.is_active ? 'success' : 'warning'} size="sm">
                  {agent.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Agent Details */}
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex justify-between">
                  <span>Tonality:</span>
                  <span className="font-medium">{agent.tonality}</span>
                </div>
                <div className="flex justify-between">
                  <span>Response Length:</span>
                  <span className="font-medium">{agent.response_length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className="font-medium">{agent.temperature}</span>
                </div>
                {agent.knowledge_base_ids && (
                  <div className="flex justify-between">
                    <span>KB Entries:</span>
                    <span className="font-medium">
                      {agent.knowledge_base_ids.split(',').filter(id => id.trim()).length}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  color="gray"
                  onClick={() => handleEditAgent(agent)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  color="failure"
                  onClick={() => handleDeleteAgent(agent.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364-.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No AI agents created yet</p>
          <Button onClick={handleCreateAgent}>Create Your First Agent</Button>
        </div>
      )}
    </div>
  )

  const renderKnowledgeBaseTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Knowledge Base</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage knowledge base entries to provide context to your AI agents.</p>
        </div>
        <Button onClick={handleCreateKB}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Entry
        </Button>
      </div>

      {/* Knowledge Base List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : knowledgeBaseEntries.length > 0 ? (
        <div className="space-y-4">
          {knowledgeBaseEntries.map((kb) => (
            <Card key={kb.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {kb.name}
                    </h3>
                    <Badge color={kb.is_active ? 'success' : 'warning'} size="sm">
                      {kb.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {kb.category && (
                      <Badge color="purple" size="sm">
                        {kb.category}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {kb.description || 'No description'}
                  </p>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                    Content: {kb.content ? `${kb.content.substring(0, 100)}...` : 'No content'}
                  </div>
                  
                  {kb.tags && (
                    <div className="flex flex-wrap gap-1">
                      {kb.tags.split(',').map((tag, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    color="gray"
                    onClick={() => handleEditKB(kb)}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    color="failure"
                    onClick={() => handleDeleteKB(kb.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No knowledge base entries created yet</p>
          <Button onClick={handleCreateKB}>Create Your First Entry</Button>
        </div>
      )}
    </div>
  )

  const renderChatbotsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chatbots</h2>
          <p className="text-gray-600 dark:text-gray-400">Create and manage AI-powered chatbots for your website visitors.</p>
        </div>
        <Button onClick={handleCreateChatbot}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Chatbot
        </Button>
      </div>

      {/* Chatbots List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : chatbots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="relative">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {chatbot.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {chatbot.description || 'No description'}
                  </p>
                </div>
                <Badge color={chatbot.is_active ? 'success' : 'warning'} size="sm">
                  {chatbot.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Chatbot Details */}
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex justify-between">
                  <span>AI Agent:</span>
                  <span className="font-medium">
                    {agents.find(agent => agent.id === chatbot.agent_id)?.name || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Position:</span>
                  <span className="font-medium">
                    {chatbot.trigger_button_settings?.position || 'bottom-right'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sessions:</span>
                  <span className="font-medium">
                    {chatbot.behavior_settings?.persist_sessions ? 'Persistent' : 'New each visit'}
                  </span>
                </div>
              </div>

              {/* Quick Messages Preview */}
              {chatbot.quick_messages && chatbot.quick_messages.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick Messages:</div>
                  <div className="space-y-1">
                    {chatbot.quick_messages.slice(0, 2).map((message, index) => (
                      <div key={index} className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {message}
                      </div>
                    ))}
                    {chatbot.quick_messages.length > 2 && (
                      <div className="text-xs text-gray-500">
                        +{chatbot.quick_messages.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  color="gray"
                  onClick={() => handleEditChatbot(chatbot)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button 
                  size="sm" 
                  color="failure"
                  onClick={() => handleDeleteChatbot(chatbot.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.468L3 21l2.532-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">No chatbots created yet</p>
          <Button onClick={handleCreateChatbot}>Create Your First Chatbot</Button>
        </div>
      )}
    </div>
  )

  const renderChatbotFormTab = () => (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          <li className="inline-flex items-center">
            <button
              onClick={() => setActiveTab('chatbots')}
              className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
            >
              <svg className="w-3 h-3 mr-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Chatbots
            </button>
          </li>
          <li>
            <div className="flex items-center">
              <svg className="w-3 h-3 text-gray-400 mx-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
                {editingChatbot ? 'Edit Chatbot' : 'Create Chatbot'}
              </span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editingChatbot ? `Edit "${editingChatbot.name}"` : 'Create New Chatbot'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {editingChatbot ? 'Update your chatbot configuration and styling.' : 'Create a new chatbot with custom styling and behavior.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button color="gray" onClick={() => {
            resetChatbotForm()
            setActiveTab('chatbots')
          }}>
            Cancel
          </Button>
          <Button onClick={handleSaveChatbot}>
            {editingChatbot ? 'Update Chatbot' : 'Create Chatbot'}
          </Button>
        </div>
      </div>

      {/* Form Content with Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Section */}
        <div className="space-y-3">
          {/* General Settings */}
          <AccordionSection
            title="General"
            description="Basic chatbot information and settings"
            isOpen={accordionState.general}
            onToggle={() => toggleAccordion('general')}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="chatbot-name" className="text-sm">Chatbot Name *</Label>
                  <TextInput
                    id="chatbot-name"
                    type="text"
                    value={chatbotForm.name}
                    onChange={(e) => setChatbotForm({...chatbotForm, name: e.target.value})}
                    placeholder="Enter chatbot name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="chatbot-agent" className="text-sm">AI Agent *</Label>
                  <Select
                    id="chatbot-agent"
                    value={chatbotForm.agent_id}
                    onChange={(e) => setChatbotForm({...chatbotForm, agent_id: e.target.value})}
                    className="mt-1"
                  >
                    <option value="">Select an AI Agent</option>
                    {agents.filter(agent => agent.is_active).map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="chatbot-description" className="text-sm">Description</Label>
                <Textarea
                  id="chatbot-description"
                  rows={2}
                  value={chatbotForm.description}
                  onChange={(e) => setChatbotForm({...chatbotForm, description: e.target.value})}
                  placeholder="Brief description of this chatbot's purpose..."
                  className="mt-1"
                />
              </div>

              {/* Header Customization */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Header Customization</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="custom-header-name" className="text-sm">Custom Header Name</Label>
                    <TextInput
                      id="custom-header-name"
                      type="text"
                      value={chatbotForm.custom_header_name || ''}
                      onChange={(e) => setChatbotForm({...chatbotForm, custom_header_name: e.target.value})}
                      placeholder="Leave empty to use chatbot name"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      If empty, the chatbot name will be displayed
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="custom-header-logo" className="text-sm">Custom Header Logo</Label>
                    <div className="mt-1 space-y-2">
                      <div className="flex gap-2">
                        <TextInput
                          id="custom-header-logo"
                          type="url"
                          value={chatbotForm.custom_header_logo || ''}
                          onChange={(e) => setChatbotForm({...chatbotForm, custom_header_logo: e.target.value})}
                          placeholder="https://example.com/logo.png"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          color="gray"
                          onClick={() => {
                            if (window.wp && window.wp.media) {
                              const frame = window.wp.media({
                                title: 'Select Logo',
                                button: { text: 'Use this logo' },
                                multiple: false,
                                library: { type: 'image' }
                              });

                              frame.on('select', function() {
                                const attachment = frame.state().get('selection').first().toJSON();
                                setChatbotForm({...chatbotForm, custom_header_logo: attachment.url});
                              });

                              frame.open();
                            } else {
                              alert('WordPress media library not available. Please use direct URL input.');
                            }
                          }}
                        >
                          Choose from Library
                        </Button>
                      </div>
                      {chatbotForm.custom_header_logo && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <img
                            src={chatbotForm.custom_header_logo}
                            alt="Logo preview"
                            className="w-8 h-8 object-cover rounded"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                            {chatbotForm.custom_header_logo}
                          </span>
                          <button
                            type="button"
                            onClick={() => setChatbotForm({...chatbotForm, custom_header_logo: ''})}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enter URL directly or choose from WordPress media library. Leave empty to use default chat icon.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="chatbot-active"
                  type="checkbox"
                  checked={chatbotForm.is_active}
                  onChange={(e) => setChatbotForm({...chatbotForm, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <Label htmlFor="chatbot-active" className="text-sm">Active</Label>
              </div>
            </div>
          </AccordionSection>

          {/* Trigger Button Settings */}
          <AccordionSection
            title="Button"
            description="Customize the floating chat button appearance and position"
            isOpen={accordionState.trigger}
            onToggle={() => toggleAccordion('trigger')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="button-position" className="text-sm">Position</Label>
                <Select
                  id="button-position"
                  value={chatbotForm.trigger_button_settings.position}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    trigger_button_settings: {
                      ...chatbotForm.trigger_button_settings,
                      position: e.target.value
                    }
                  })}
                  className="mt-1"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="button-color" className="text-sm">Color</Label>
                <div className="mt-1">
                  <input
                    id="button-color"
                    type="color"
                    value={chatbotForm.trigger_button_settings.color}
                    onChange={(e) => setChatbotForm({
                      ...chatbotForm,
                      trigger_button_settings: {
                        ...chatbotForm.trigger_button_settings,
                        color: e.target.value
                      }
                    })}
                    className="h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="button-size" className="text-sm">Size</Label>
                <Select
                  id="button-size"
                  value={chatbotForm.trigger_button_settings.size}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    trigger_button_settings: {
                      ...chatbotForm.trigger_button_settings,
                      size: e.target.value
                    }
                  })}
                  className="mt-1"
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="button-icon" className="text-sm">Icon</Label>
                <Select
                  id="button-icon"
                  value={chatbotForm.trigger_button_settings.icon}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    trigger_button_settings: {
                      ...chatbotForm.trigger_button_settings,
                      icon: e.target.value
                    }
                  })}
                  className="mt-1"
                >
                  <option value="chat">Chat Bubble</option>
                  <option value="message">Message</option>
                  <option value="support">Support</option>
                  <option value="help">Help</option>
                  <option value="assistant">Assistant</option>
                </Select>
              </div>
            </div>

            {/* Custom Icon Upload */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
              <Label htmlFor="custom-button-icon" className="text-sm">Custom Button Icon</Label>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <TextInput
                    id="custom-button-icon"
                    type="url"
                    value={chatbotForm.trigger_button_settings.custom_icon}
                    onChange={(e) => setChatbotForm({
                      ...chatbotForm,
                      trigger_button_settings: {
                        ...chatbotForm.trigger_button_settings,
                        custom_icon: e.target.value
                      }
                    })}
                    placeholder="https://example.com/icon.png"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    color="gray"
                    onClick={() => {
                      if (window.wp && window.wp.media) {
                        const frame = window.wp.media({
                          title: 'Select Button Icon',
                          button: { text: 'Use this icon' },
                          multiple: false,
                          library: { type: 'image' }
                        });

                        frame.on('select', function() {
                          const attachment = frame.state().get('selection').first().toJSON();
                          setChatbotForm({
                            ...chatbotForm,
                            trigger_button_settings: {
                              ...chatbotForm.trigger_button_settings,
                              custom_icon: attachment.url
                            }
                          });
                        });

                        frame.open();
                      } else {
                        alert('WordPress media library not available. Please use direct URL input.');
                      }
                    }}
                  >
                    Choose from Library
                  </Button>
                </div>
                {chatbotForm.trigger_button_settings.custom_icon && (
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <img
                      src={chatbotForm.trigger_button_settings.custom_icon}
                      alt="Icon preview"
                      className="w-8 h-8 object-cover rounded"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1">
                      {chatbotForm.trigger_button_settings.custom_icon}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChatbotForm({
                        ...chatbotForm,
                        trigger_button_settings: {
                          ...chatbotForm.trigger_button_settings,
                          custom_icon: ''
                        }
                      })}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter URL directly or choose from WordPress media library. Leave empty to use the selected icon style above.
              </p>
            </div>
          </AccordionSection>

          {/* Chat Styling Settings */}
          <AccordionSection
            title="Chat"
            description="Customize the chat interface appearance, colors, and dimensions"
            isOpen={accordionState.appearance}
            onToggle={() => toggleAccordion('appearance')}
          >
            <div className="space-y-4">
              {/* Layout & Dimensions */}
              <div>
                <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Layout & Dimensions</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="chatbot-width" className="text-xs">Width (px)</Label>
                    <TextInput
                      id="chatbot-width"
                      type="number"
                      min="300"
                      max="600"
                      value={chatbotForm.chatbot_styling.width}
                      onChange={(e) => setChatbotForm({
                        ...chatbotForm,
                        chatbot_styling: {
                          ...chatbotForm.chatbot_styling,
                          width: parseInt(e.target.value) || 380
                        }
                      })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="chatbot-height" className="text-xs">Height (px)</Label>
                    <TextInput
                      id="chatbot-height"
                      type="number"
                      min="400"
                      max="800"
                      value={chatbotForm.chatbot_styling.height}
                      onChange={(e) => setChatbotForm({
                        ...chatbotForm,
                        chatbot_styling: {
                          ...chatbotForm.chatbot_styling,
                          height: parseInt(e.target.value) || 500
                        }
                      })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="chatbot-border-radius" className="text-xs">Border Radius (px)</Label>
                    <TextInput
                      id="chatbot-border-radius"
                      type="number"
                      min="0"
                      max="50"
                      value={chatbotForm.chatbot_styling.border_radius}
                      onChange={(e) => setChatbotForm({
                        ...chatbotForm,
                        chatbot_styling: {
                          ...chatbotForm.chatbot_styling,
                          border_radius: parseInt(e.target.value) || 12
                        }
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div>
                <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Colors</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="primary-color" className="text-xs">Primary Color</Label>
                    <div className="mt-1">
                      <input
                        id="primary-color"
                        type="color"
                        value={chatbotForm.chatbot_styling.primary_color}
                        onChange={(e) => setChatbotForm({
                          ...chatbotForm,
                          chatbot_styling: {
                            ...chatbotForm.chatbot_styling,
                            primary_color: e.target.value
                          }
                        })}
                        className="h-8 w-full rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="secondary-color" className="text-xs">Secondary Color</Label>
                    <div className="mt-1">
                      <input
                        id="secondary-color"
                        type="color"
                        value={chatbotForm.chatbot_styling.secondary_color}
                        onChange={(e) => setChatbotForm({
                          ...chatbotForm,
                          chatbot_styling: {
                            ...chatbotForm.chatbot_styling,
                            secondary_color: e.target.value
                          }
                        })}
                        className="h-8 w-full rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="background-color" className="text-xs">Background</Label>
                    <div className="mt-1">
                      <input
                        id="background-color"
                        type="color"
                        value={chatbotForm.chatbot_styling.background_color}
                        onChange={(e) => setChatbotForm({
                          ...chatbotForm,
                          chatbot_styling: {
                            ...chatbotForm.chatbot_styling,
                            background_color: e.target.value
                          }
                        })}
                        className="h-8 w-full rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div>
                <Label htmlFor="font-family" className="text-sm">Font Family</Label>
                <Select
                  id="font-family"
                  value={chatbotForm.chatbot_styling.font_family}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    chatbot_styling: {
                      ...chatbotForm.chatbot_styling,
                      font_family: e.target.value
                    }
                  })}
                  className="mt-1"
                >
                  <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                  <option value="system-ui, -apple-system, sans-serif">System Default</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, Arial, sans-serif">Helvetica</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Times, serif">Times</option>
                  <option value="Courier, monospace">Courier</option>
                  <option value="Roboto, sans-serif">Roboto</option>
                  <option value="Open Sans, sans-serif">Open Sans</option>
                </Select>
              </div>
            </div>
          </AccordionSection>

          {/* Behavior Settings */}
          <AccordionSection
            title="Presets"
            description="Design templates, welcome messages and quick reply options"
            isOpen={accordionState.behavior}
            onToggle={() => toggleAccordion('behavior')}
          >
            <div className="space-y-4">
              {/* Design Presets */}
              <div>
                <Label className="text-sm">Design Templates</Label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Apply pre-designed themes to quickly style your chatbot</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => applyDesignPreset('modern')}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors group"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500"></div>
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">Modern</div>
                    <div className="text-xs text-gray-500">Clean & Professional</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyDesignPreset('dark')}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 transition-colors group"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-6 h-6 rounded-full bg-gray-800 border-2 border-green-500"></div>
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">Dark</div>
                    <div className="text-xs text-gray-500">Sleek & Modern</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyDesignPreset('minimal')}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400 transition-colors group"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-6 h-6 rounded border border-gray-400 bg-white"></div>
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-600 dark:group-hover:text-gray-400">Minimal</div>
                    <div className="text-xs text-gray-500">Simple & Clean</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyDesignPreset('vibrant')}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-pink-500 dark:hover:border-pink-400 transition-colors group"
                  >
                    <div className="flex items-center justify-center mb-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600"></div>
                    </div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-pink-600 dark:group-hover:text-pink-400">Vibrant</div>
                    <div className="text-xs text-gray-500">Bold & Colorful</div>
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="welcome-message" className="text-sm">Welcome Message</Label>
                <TextInput
                  id="welcome-message"
                  type="text"
                  value={chatbotForm.behavior_settings.welcome_message}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    behavior_settings: {
                      ...chatbotForm.behavior_settings,
                      welcome_message: e.target.value
                    }
                  })}
                  placeholder="Hello! How can I help you today?"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Quick Messages</Label>
                <div className="space-y-2 mt-2">
                  {chatbotForm.quick_messages.map((message, index) => (
                    <div key={index} className="flex gap-2">
                      <TextInput
                        type="text"
                        value={message}
                        onChange={(e) => {
                          const newMessages = [...chatbotForm.quick_messages]
                          newMessages[index] = e.target.value
                          setChatbotForm({
                            ...chatbotForm,
                            quick_messages: newMessages
                          })
                        }}
                        placeholder="Quick message..."
                        className="flex-1 text-sm"
                      />
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => {
                          const newMessages = chatbotForm.quick_messages.filter((_, i) => i !== index)
                          setChatbotForm({
                            ...chatbotForm,
                            quick_messages: newMessages
                          })
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    size="xs"
                    color="gray"
                    onClick={() => {
                      setChatbotForm({
                        ...chatbotForm,
                        quick_messages: [...chatbotForm.quick_messages, '']
                      })
                    }}
                  >
                    + Add Quick Message
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="typing-indicator"
                    type="checkbox"
                    checked={chatbotForm.behavior_settings.typing_indicator}
                    onChange={(e) => setChatbotForm({
                      ...chatbotForm,
                      behavior_settings: {
                        ...chatbotForm.behavior_settings,
                        typing_indicator: e.target.checked
                      }
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="typing-indicator" className="text-sm">Show typing indicator</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="persist-sessions"
                    type="checkbox"
                    checked={chatbotForm.behavior_settings.persist_sessions}
                    onChange={(e) => setChatbotForm({
                      ...chatbotForm,
                      behavior_settings: {
                        ...chatbotForm.behavior_settings,
                        persist_sessions: e.target.checked
                      }
                    })}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="persist-sessions" className="text-sm">Keep chat open</Label>
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* Visibility & Display Conditions */}
          <AccordionSection
            title="Visibility"
            description="Control where and when the chatbot appears on your website"
            isOpen={accordionState.visibility}
            onToggle={() => toggleAccordion('visibility')}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Choose where the chatbot should appear on your website (multiple selections allowed)
              </p>

              {/* Display Mode Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value="everywhere"
                    checked={chatbotForm.display_conditions.display_mode.includes('everywhere')}
                    onChange={(e) => {
                      const modes = [...chatbotForm.display_conditions.display_mode]
                      if (e.target.checked) {
                        if (!modes.includes('everywhere')) modes.push('everywhere')
                      } else {
                        const index = modes.indexOf('everywhere')
                        if (index > -1) modes.splice(index, 1)
                      }
                      setChatbotForm({
                        ...chatbotForm,
                        display_conditions: {
                          ...chatbotForm.display_conditions,
                          display_mode: modes
                        }
                      })
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Show Everywhere</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Display the chatbot on all pages (frontend and admin)</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value="frontend_only"
                    checked={chatbotForm.display_conditions.display_mode.includes('frontend_only')}
                    onChange={(e) => {
                      const modes = [...chatbotForm.display_conditions.display_mode]
                      if (e.target.checked) {
                        if (!modes.includes('frontend_only')) modes.push('frontend_only')
                      } else {
                        const index = modes.indexOf('frontend_only')
                        if (index > -1) modes.splice(index, 1)
                      }
                      setChatbotForm({
                        ...chatbotForm,
                        display_conditions: {
                          ...chatbotForm.display_conditions,
                          display_mode: modes
                        }
                      })
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Frontend Only</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Display only on public pages (not in admin area)</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value="admin_only"
                    checked={chatbotForm.display_conditions.display_mode.includes('admin_only')}
                    onChange={(e) => {
                      const modes = [...chatbotForm.display_conditions.display_mode]
                      if (e.target.checked) {
                        if (!modes.includes('admin_only')) modes.push('admin_only')
                      } else {
                        const index = modes.indexOf('admin_only')
                        if (index > -1) modes.splice(index, 1)
                      }
                      setChatbotForm({
                        ...chatbotForm,
                        display_conditions: {
                          ...chatbotForm.display_conditions,
                          display_mode: modes
                        }
                      })
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Admin Area Only</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Display only in WordPress admin area (not on public pages)</div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value="logged_in_only"
                    checked={chatbotForm.display_conditions.display_mode.includes('logged_in_only')}
                    onChange={(e) => {
                      const modes = [...chatbotForm.display_conditions.display_mode]
                      if (e.target.checked) {
                        if (!modes.includes('logged_in_only')) modes.push('logged_in_only')
                        // Pre-load users when this option is selected
                        if (availableUsers.length === 0) {
                          loadAvailableUsers()
                        }
                      } else {
                        const index = modes.indexOf('logged_in_only')
                        if (index > -1) modes.splice(index, 1)
                      }
                      setChatbotForm({
                        ...chatbotForm,
                        display_conditions: {
                          ...chatbotForm.display_conditions,
                          display_mode: modes
                        }
                      })
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Logged-in Users Only</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Display only when users are logged into WordPress</div>
                  </div>
                </label>
              </div>

              {/* Advanced Settings for Logged-in Users */}
              {chatbotForm.display_conditions.display_mode.includes('logged_in_only') && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">User Restrictions</h5>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="chatbot-user-roles" value="Allowed User Roles" className="mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        Leave empty to allow all logged-in users, or select specific roles to restrict access.
                      </p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {['administrator', 'editor', 'author', 'contributor', 'subscriber'].map(role => (
                          <label key={role} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={chatbotForm.display_conditions.user_roles.includes(role)}
                              onChange={(e) => {
                                const roles = [...chatbotForm.display_conditions.user_roles]
                                if (e.target.checked) {
                                  if (!roles.includes(role)) roles.push(role)
                                } else {
                                  const index = roles.indexOf(role)
                                  if (index > -1) roles.splice(index, 1)
                                }
                                setChatbotForm({
                                  ...chatbotForm,
                                  display_conditions: {
                                    ...chatbotForm.display_conditions,
                                    user_roles: roles
                                  }
                                })
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="chatbot-specific-users" value="Specific Users (Advanced)" className="mb-2" />
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        Select specific users who should see the chatbot. Leave empty to use role restrictions only.
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
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
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
                                  checked={chatbotForm.display_conditions.specific_users.includes(user.id)}
                                  onChange={(e) => {
                                    const userIds = [...chatbotForm.display_conditions.specific_users]
                                    if (e.target.checked) {
                                      if (!userIds.includes(user.id)) userIds.push(user.id)
                                    } else {
                                      const index = userIds.indexOf(user.id)
                                      if (index > -1) userIds.splice(index, 1)
                                    }
                                    setChatbotForm({
                                      ...chatbotForm,
                                      display_conditions: {
                                        ...chatbotForm.display_conditions,
                                        specific_users: userIds
                                      }
                                    })
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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
              {chatbotForm.display_conditions.display_mode.includes('frontend_only') && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">Frontend Page Restrictions</h5>
                  <div className="space-y-4">
                    <div>
                      <Label value="Page Selection" className="mb-2" />
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="frontend_pages"
                            value="all"
                            checked={chatbotForm.display_conditions.frontend_pages === 'all'}
                            onChange={(e) => setChatbotForm({
                              ...chatbotForm,
                              display_conditions: {
                                ...chatbotForm.display_conditions,
                                frontend_pages: e.target.value
                              }
                            })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">All frontend pages</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="frontend_pages"
                            value="specific"
                            checked={chatbotForm.display_conditions.frontend_pages === 'specific'}
                            onChange={(e) => setChatbotForm({
                              ...chatbotForm,
                              display_conditions: {
                                ...chatbotForm.display_conditions,
                                frontend_pages: e.target.value
                              }
                            })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Specific pages/patterns only</span>
                        </label>
                      </div>
                    </div>

                    {chatbotForm.display_conditions.frontend_pages === 'specific' && (
                      <div>
                        <Label htmlFor="chatbot-frontend-urls" value="URL Patterns" className="mb-2" />
                        <textarea
                          id="chatbot-frontend-urls"
                          rows="4"
                          placeholder="Enter URL patterns, one per line. Examples:&#10;/contact&#10;/support/*&#10;/blog/*&#10;Use * as wildcard for multiple pages"
                          value={chatbotForm.display_conditions.frontend_urls}
                          onChange={(e) => setChatbotForm({
                            ...chatbotForm,
                            display_conditions: {
                              ...chatbotForm.display_conditions,
                              frontend_urls: e.target.value
                            }
                          })}
                          className="block w-full p-2.5 text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
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
              {chatbotForm.display_conditions.display_mode.includes('admin_only') && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3">Admin Page Restrictions</h5>
                  <div className="space-y-4">
                    <div>
                      <Label value="Admin Page Selection" className="mb-2" />
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="admin_pages"
                            value="all"
                            checked={chatbotForm.display_conditions.admin_pages === 'all'}
                            onChange={(e) => setChatbotForm({
                              ...chatbotForm,
                              display_conditions: {
                                ...chatbotForm.display_conditions,
                                admin_pages: e.target.value
                              }
                            })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">All admin pages</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="admin_pages"
                            value="specific"
                            checked={chatbotForm.display_conditions.admin_pages === 'specific'}
                            onChange={(e) => setChatbotForm({
                              ...chatbotForm,
                              display_conditions: {
                                ...chatbotForm.display_conditions,
                                admin_pages: e.target.value
                              }
                            })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Specific admin pages only</span>
                        </label>
                      </div>
                    </div>

                    {chatbotForm.display_conditions.admin_pages === 'specific' && (
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
                                checked={chatbotForm.display_conditions.specific_admin_pages.includes(page.value)}
                                onChange={(e) => {
                                  const pages = [...chatbotForm.display_conditions.specific_admin_pages]
                                  if (e.target.checked) {
                                    if (!pages.includes(page.value)) pages.push(page.value)
                                  } else {
                                    const index = pages.indexOf(page.value)
                                    if (index > -1) pages.splice(index, 1)
                                  }
                                  setChatbotForm({
                                    ...chatbotForm,
                                    display_conditions: {
                                      ...chatbotForm.display_conditions,
                                      specific_admin_pages: pages
                                    }
                                  })
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
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

              {/* Device Conditions */}
              <div>
                <Label htmlFor="devices" className="text-sm">Device Targeting</Label>
                <Select
                  id="devices"
                  value={chatbotForm.display_conditions.devices}
                  onChange={(e) => setChatbotForm({
                    ...chatbotForm,
                    display_conditions: {
                      ...chatbotForm.display_conditions,
                      devices: e.target.value
                    }
                  })}
                  className="mt-1"
                >
                  <option value="all">All Devices</option>
                  <option value="desktop">Desktop Only</option>
                  <option value="mobile">Mobile Only</option>
                  <option value="tablet">Tablet Only</option>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Control which device types can see the chatbot
                </p>
              </div>
            </div>
          </AccordionSection>
        </div>

      {/* Preview Section */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Live Preview</h3>
        <div className="flex justify-center p-4">
          <div className="relative">
            <ChatbotInterface
              chatbot={{
                id: 'preview',
                name: chatbotForm.name || 'Preview Chatbot',
                custom_header_name: chatbotForm.custom_header_name,
                custom_header_logo: chatbotForm.custom_header_logo,
                chatbot_styling: chatbotForm.chatbot_styling,
                behavior_settings: chatbotForm.behavior_settings,
                quick_messages: chatbotForm.quick_messages.filter(msg => msg.trim())
              }}
              isOpen={true}
              isPreview={true}
              className="border border-gray-200 dark:border-gray-600"
            />
          </div>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2">
          This is how your chatbot will appear to website visitors
        </div>
      </Card>
    </div>
  </div>
  )

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-2">
          {renderTabButton('agents', 'AI Agents', agents.length)}
          {renderTabButton('knowledge-base', 'Knowledge Base', knowledgeBaseEntries.length)}
          {renderTabButton('chatbots', 'Chatbots', chatbots.length)}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'agents' && renderAgentsTab()}
      {activeTab === 'knowledge-base' && renderKnowledgeBaseTab()}
      {activeTab === 'chatbots' && renderChatbotsTab()}
      {activeTab === 'chatbot-form' && renderChatbotFormTab()}

      {/* Agent Modal */}
      <FormModal 
        isOpen={showAgentModal} 
        onClose={() => setShowAgentModal(false)} 
        title={editingAgent ? 'Edit AI Agent' : 'Create AI Agent'}
        onSave={handleSaveAgent}
        saveText={editingAgent ? 'Update Agent' : 'Create Agent'}
      >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div>
                <Label htmlFor="agent-name">Name *</Label>
                <TextInput
                  id="agent-name"
                  type="text"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({...agentForm, name: e.target.value})}
                  placeholder="Enter agent name"
                />
              </div>

              <div>
                <Label htmlFor="agent-tonality">Tonality</Label>
                <Select
                  id="agent-tonality"
                  value={agentForm.tonality}
                  onChange={(e) => setAgentForm({...agentForm, tonality: e.target.value})}
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                  <option value="formal">Formal</option>
                  <option value="creative">Creative</option>
                  <option value="technical">Technical</option>
                  <option value="persuasive">Persuasive</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="agent-response-length">Response Length</Label>
                <Select
                  id="agent-response-length"
                  value={agentForm.response_length}
                  onChange={(e) => setAgentForm({...agentForm, response_length: e.target.value})}
                >
                  <option value="short">Short (1-2 paragraphs)</option>
                  <option value="medium">Medium (3-5 paragraphs)</option>
                  <option value="long">Long (6+ paragraphs)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="agent-temperature">Temperature ({agentForm.temperature})</Label>
                <input
                  id="agent-temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={agentForm.temperature}
                  onChange={(e) => setAgentForm({...agentForm, temperature: parseFloat(e.target.value)})}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Lower values = more focused, Higher values = more creative
                </div>
              </div>

              <div>
                <Label htmlFor="agent-max-tokens">Max Tokens</Label>
                <TextInput
                  id="agent-max-tokens"
                  type="number"
                  value={agentForm.max_tokens}
                  onChange={(e) => setAgentForm({...agentForm, max_tokens: parseInt(e.target.value) || 2000})}
                  placeholder="2000"
                />
              </div>

              <div>
                <Label htmlFor="agent-knowledge-base">Knowledge Base Context</Label>
                <SearchableKBDropdown
                  knowledgeBaseEntries={knowledgeBaseEntries}
                  selectedIds={agentForm.knowledge_base_ids}
                  onChange={(selectedIds) => setAgentForm({...agentForm, knowledge_base_ids: selectedIds})}
                />
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Search and select knowledge base entries to provide context to this agent
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="agent-description">Description</Label>
              <Textarea
                id="agent-description"
                rows={3}
                value={agentForm.description}
                onChange={(e) => setAgentForm({...agentForm, description: e.target.value})}
                placeholder="Brief description of this agent's purpose..."
              />
            </div>

            <div>
              <Label htmlFor="agent-system-message">System Message</Label>
              <Textarea
                id="agent-system-message"
                rows={6}
                value={agentForm.system_message}
                onChange={(e) => setAgentForm({...agentForm, system_message: e.target.value})}
                placeholder="You are a helpful AI assistant. Please provide detailed and accurate responses..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="agent-active"
                type="checkbox"
                checked={agentForm.is_active}
                onChange={(e) => setAgentForm({...agentForm, is_active: e.target.checked})}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="agent-active">Active</Label>
            </div>
          </div>
      </FormModal>

      {/* Knowledge Base Modal */}
      <FormModal
        isOpen={showKBModal}
        onClose={() => setShowKBModal(false)}
        title={editingKB ? 'Edit Knowledge Base Entry' : 'Create Knowledge Base Entry'}
        onSave={handleSaveKB}
        saveText={editingKB ? 'Update Entry' : 'Create Entry'}
        isSaving={isProcessing}
      >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="kb-name">Name *</Label>
                <TextInput
                  id="kb-name"
                  type="text"
                  value={kbForm.name}
                  onChange={(e) => setKbForm({...kbForm, name: e.target.value})}
                  placeholder="Enter entry name"
                />
              </div>

              <div>
                <Label htmlFor="kb-category">Category</Label>
                <TextInput
                  id="kb-category"
                  type="text"
                  value={kbForm.category}
                  onChange={(e) => setKbForm({...kbForm, category: e.target.value})}
                  placeholder="e.g., Documentation, FAQ, Guidelines"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="kb-description">Description</Label>
              <Textarea
                id="kb-description"
                rows={2}
                value={kbForm.description}
                onChange={(e) => setKbForm({...kbForm, description: e.target.value})}
                placeholder="Brief description of this knowledge base entry..."
              />
            </div>

            {/* Content Source Selection */}
            <div>
              <Label>Content Source *</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="text"
                    checked={kbForm.content_source === 'text'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">Direct Text Input</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="file"
                    checked={kbForm.content_source === 'file'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">File Upload</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="content_source"
                    value="url"
                    checked={kbForm.content_source === 'url'}
                    onChange={(e) => setKbForm({...kbForm, content_source: e.target.value, content: '', source_url: '', uploaded_file: null})}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">URL Scraping</span>
                </label>
              </div>
            </div>

            {/* Content Input Based on Source Type */}
            {kbForm.content_source === 'text' && (
              <div>
                <Label htmlFor="kb-content">Content *</Label>
                <Textarea
                  id="kb-content"
                  rows={12}
                  value={kbForm.content}
                  onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                  placeholder="Enter the knowledge content that will be provided to AI agents as context..."
                />
              </div>
            )}

            {kbForm.content_source === 'file' && (
              <div>
                <Label htmlFor="kb-file">File Upload *</Label>
                <div className="mt-2">
                  <input
                    type="file"
                    id="kb-file"
                    accept=".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png,.gif,.webp"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        handleFileUpload(file)
                      }
                    }}
                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:text-gray-400 focus:outline-none dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400"
                    disabled={isProcessing}
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Supported formats: PDF, DOCX, DOC, TXT, MD, JPG, PNG, GIF, WEBP
                  </div>
                </div>
                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <Spinner size="sm" />
                    Processing file...
                  </div>
                )}
                {kbForm.content && (
                  <div className="mt-3">
                    <Label>Extracted Content (Preview)</Label>
                    <Textarea
                      rows={8}
                      value={kbForm.content}
                      onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                      className="mt-1"
                      placeholder="File content will appear here after processing..."
                    />
                  </div>
                )}
              </div>
            )}

            {kbForm.content_source === 'url' && (
              <div>
                <Label htmlFor="kb-url">Website URL *</Label>
                <div className="flex gap-2 mt-2">
                  <TextInput
                    id="kb-url"
                    type="url"
                    value={kbForm.source_url}
                    onChange={(e) => setKbForm({...kbForm, source_url: e.target.value})}
                    placeholder="https://example.com/page-to-scrape"
                    className="flex-1"
                    disabled={isProcessing}
                  />
                  <Button
                    type="button"
                    onClick={() => handleUrlScraping(kbForm.source_url)}
                    disabled={isProcessing || !kbForm.source_url.trim()}
                    size="sm"
                  >
                    {isProcessing ? <Spinner size="sm" /> : 'Scrape'}
                  </Button>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a URL to automatically extract and convert the content to plain text
                </div>
                {isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <Spinner size="sm" />
                    Scraping URL content...
                  </div>
                )}
                {kbForm.content && (
                  <div className="mt-3">
                    <Label>Scraped Content (Preview)</Label>
                    <Textarea
                      rows={8}
                      value={kbForm.content}
                      onChange={(e) => setKbForm({...kbForm, content: e.target.value})}
                      className="mt-1"
                      placeholder="Scraped content will appear here..."
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="kb-tags">Tags</Label>
              <TextInput
                id="kb-tags"
                type="text"
                value={kbForm.tags}
                onChange={(e) => setKbForm({...kbForm, tags: e.target.value})}
                placeholder="tag1, tag2, tag3"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comma-separated tags for organization
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="kb-active"
                type="checkbox"
                checked={kbForm.is_active}
                onChange={(e) => setKbForm({...kbForm, is_active: e.target.checked})}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <Label htmlFor="kb-active">Active</Label>
            </div>
          </div>
      </FormModal>

    </div>
  )
}

export default AIAgents