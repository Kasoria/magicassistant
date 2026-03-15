import React, { useState, useRef, useEffect } from 'react'
import { Button, Card, Textarea, Spinner, Drawer, Tooltip } from 'flowbite-react'
import CustomSelect from './CustomSelect'
import { useToast } from './Toast'
import ConfirmationModal from './ConfirmationModal'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import ContentMode from './ContentMode'
import { parseHtmlStringToObjectArray, getDefaultParserStates, generateId } from '../utils/bricksParser'
import { insertBricksStructure, isBricksBuilder } from '../utils/bricksInserter'

const ChatInterface = ({ adminData, isDrawerMode = false, isBricksMode = false, onAiResponseUpdate }) => {
  const [isContentMode, setIsContentMode] = useState(false)
  // Helper function to add UTM parameters to Unsplash links
  const addUnsplashUTMParams = (url) => {
    if (!url) return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}utm_source=magicassistant&utm_medium=referral`
  }
  const [messages, setMessages] = useState(() => {
    const welcomeContent = isBricksMode
      ? '🧱 **Bricks Mode Activated!**\n\nI\'m ready to help you build beautiful Bricks sections using our component library!\n\n**I can:**\n• Search and retrieve pre-built components from the library\n• Insert components directly into your Bricks canvas\n• Generate new designs when you need something custom\n\n**Just ask me:**\n• "Find a hero section component for SaaS"\n• "Insert a pricing table component"\n• "Show me feature section components with buttons"\n• "Create a custom CTA section"\n\nI\'ll use our pre-built component library first, then generate custom designs when needed!'
      : 'Hello! I\'m your WordPress AI assistant. I can help you create content, manage your site, and answer questions. What would you like to do today?';

    return [{
      role: 'assistant',
      content: welcomeContent,
      timestamp: new Date(),
      isWelcomeMessage: true
    }];
  })
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [settings, setSettings] = useState(null)
  const [forceAgentMode, setForceAgentMode] = useState(true)
  const messagesEndRef = useRef(null)
  const { showError, showSuccess } = useToast()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [chatSessions, setChatSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [editingMessageIndex, setEditingMessageIndex] = useState(null)
  const [editingMessageContent, setEditingMessageContent] = useState('')
  const [showingDebugData, setShowingDebugData] = useState({})
  const [showingChainOfThought, setShowingChainOfThought] = useState({})
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareAsPermanent, setShareAsPermanent] = useState(false)
  const [shareExpiry, setShareExpiry] = useState(30)
  const [isCreatingShare, setIsCreatingShare] = useState(false)
  const [creditsInfo, setCreditsInfo] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [lightboxZoom, setLightboxZoom] = useState(1)
  const [lightboxPosition, setLightboxPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hasDragged, setHasDragged] = useState(false)
  const [showPostSelector, setShowPostSelector] = useState(false)
  const [pendingFeaturedImage, setPendingFeaturedImage] = useState(null)
  const [availablePosts, setAvailablePosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  
  // File upload and attachment states
  const [attachedFiles, setAttachedFiles] = useState([])
  const [isFileModalOpen, setIsFileModalOpen] = useState(false)
  const [customFileContent, setCustomFileContent] = useState('')
  const [customFileName, setCustomFileName] = useState('')
  const [customFileType, setCustomFileType] = useState('txt')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)
  
  // Chat settings states
  const [customSystemMessage, setCustomSystemMessage] = useState('')
  const [enableCustomSystem, setEnableCustomSystem] = useState(false)
  const [persistFiles, setPersistFiles] = useState(false)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState(null)
  const [availableAgents, setAvailableAgents] = useState([])

  // Per-chat provider/model override
  const [overrideProvider, setOverrideProvider] = useState(null)
  const [overrideModel, setOverrideModel] = useState(null)

  // Bricks framework selector state
  // Load saved framework from localStorage, default to Native
  const [selectedFramework, setSelectedFramework] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('magicassistant_bricks_framework');
      return saved || 'Native';
    }
    return 'Native';
  })
  
  // Image generation states
  const [imageGenerationMode, setImageGenerationMode] = useState(false)
  const [imageGenProvider, setImageGenProvider] = useState('openai')
  const [imageGenModel, setImageGenModel] = useState('dall-e-3')
  const [imageAspectRatio, setImageAspectRatio] = useState('1024x1024')
  const [imageOutputFormat, setImageOutputFormat] = useState('png')
  
  // Bricks site context states
  const [siteContextEnabled, setSiteContextEnabled] = useState(() => {
    if (typeof window !== 'undefined' && isBricksMode) {
      const saved = localStorage.getItem('magicassistant_bricks_site_context_enabled');
      return saved === 'true';
    }
    return false;
  })

  // Bricks text replacement state - auto-replace placeholder text with site-relevant content
  const [textReplacementEnabled, setTextReplacementEnabled] = useState(() => {
    if (typeof window !== 'undefined' && isBricksMode) {
      const saved = localStorage.getItem('magicassistant_bricks_text_replacement_enabled');
      return saved === 'true';
    }
    return false;
  })

  // Bricks image replacement state - auto-replace placeholder images with Unsplash images
  const [imageReplacementEnabled, setImageReplacementEnabled] = useState(() => {
    if (typeof window !== 'undefined' && isBricksMode) {
      const saved = localStorage.getItem('magicassistant_bricks_image_replacement_enabled');
      return saved === 'true';
    }
    return false;
  })
  const [selectedSiteContextPages, setSelectedSiteContextPages] = useState(() => {
    if (typeof window !== 'undefined' && isBricksMode) {
      const saved = localStorage.getItem('magicassistant_bricks_site_context_pages');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  })
  const [siteMetaTitle, setSiteMetaTitle] = useState('')
  const [siteMetaDescription, setSiteMetaDescription] = useState('')
  const [isSiteContextModalOpen, setIsSiteContextModalOpen] = useState(false)
  const [isBricksSettingsOpen, setIsBricksSettingsOpen] = useState(false)
  // AI Provider/Model options for per-chat override
  const aiProviderOptions = [
    { value: '', label: 'Global Default' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'google', label: 'Google (Gemini)' },
    { value: 'openrouter', label: 'OpenRouter' }
  ]

  const openaiModelOptions = [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o1', label: 'o1' },
    { value: 'o3-mini', label: 'o3-mini' }
  ]

  const anthropicModelOptions = [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
  ]

  const googleModelOptions = [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }
  ]

  const getModelOptionsForProvider = (provider) => {
    switch (provider) {
      case 'openai': return openaiModelOptions
      case 'anthropic': return anthropicModelOptions
      case 'google': return googleModelOptions
      case 'openrouter': return [] // OpenRouter has too many, just use default
      default: return []
    }
  }

  // Helper: Sanitize message history to prevent large base64 images from being sent
  const sanitizeMessageHistory = (messages) => {
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => {
        // If this is an image generation message, replace the content with a simple description
        if (msg.isImageGeneration) {
          const imageCount = msg.generatedImages?.length || 1
          return {
            role: msg.role,
            content: `[Generated ${imageCount} image${imageCount > 1 ? 's' : ''} using AI]`
          }
        }
        // For regular messages, use fullContent or content
        return {
          role: msg.role,
          content: msg.fullContent || msg.content
        }
      })
  }
  
  // Helper: reset lightbox state when opening
  const resetLightboxState = () => {
    setLightboxZoom(1)
    setLightboxPosition({ x: 0, y: 0 })
    setIsDragging(false)
  }
  
  // Helper: handle zoom
  const handleLightboxZoom = (delta, event) => {
    if (event.cancelable) {
      event.preventDefault()
    }
    const newZoom = Math.min(Math.max(lightboxZoom + delta, 0.5), 3)
    setLightboxZoom(newZoom)
    if (newZoom === 1) {
      setLightboxPosition({ x: 0, y: 0 })
    }
  }
  
  // Helper: handle drag
  const handleMouseDown = (event) => {
    if (lightboxZoom > 1) {
      setIsDragging(true)
      setHasDragged(false)
      setDragStart({ x: event.clientX - lightboxPosition.x, y: event.clientY - lightboxPosition.y })
    }
  }
  
  const handleMouseMove = (event) => {
    if (isDragging && lightboxZoom > 1) {
      setHasDragged(true)
      setLightboxPosition({
        x: event.clientX - dragStart.x,
        y: event.clientY - dragStart.y
      })
    }
  }
  
  const handleMouseUp = () => {
    setIsDragging(false)
  }
  
  // Helper: handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (lightboxOpen && event.key === 'Escape') {
        setLightboxOpen(false)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lightboxOpen])
  
  // Helper: fetch available posts and pages
  const fetchAvailablePosts = async () => {
    setLoadingPosts(true)
    try {
      const response = await fetch(`${adminData.restUrl}posts-and-pages`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        }
      })
      const data = await response.json()
      if (data.success) {
        setAvailablePosts(data.posts)
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setLoadingPosts(false)
    }
  }
  
  // Chat mode options for react-select
  const chatModeOptions = [
    ...(isBricksMode ? [{ value: 'bricks', label: '🧱 Bricks Mode' }] : []),
    { value: 'chat', label: 'Chat Mode' },
    { value: 'agent', label: 'Agent Mode' },
    ...(isDrawerMode ? [] : [{ value: 'content', label: 'Content Mode' }])
  ]

  // Determine if we're in dark mode by checking the document class
  const isDarkMode = document.documentElement.classList.contains('dark')

  // Helper to get current chat mode value
  const getCurrentChatMode = () => {
    if (isBricksMode) return 'bricks'
    if (isContentMode) return 'content'
    return forceAgentMode ? 'agent' : 'chat'
  }

  // Handler for chat mode changes
  const handleChatModeChange = (option) => {
    if (option.value === 'bricks') {
      // Bricks mode is always active when in Bricks editor, can't change
      return
    } else if (option.value === 'content') {
      setIsContentMode(true)
    } else {
      setIsContentMode(false)
      setForceAgentMode(option.value === 'agent')
    }
  }

  // Helper: extract Bricks component data from tool results
  // Returns an array of components (can be empty, or contain one or more components)
  const extractBricksComponentFromToolData = (debugToolData) => {
    if (!debugToolData || !Array.isArray(debugToolData)) {
      return [];
    }
    
    // Helper: Parse result if it's a JSON string
    const parseToolResult = (result) => {
      if (!result) return null;
      if (typeof result === 'string') {
        try {
          return JSON.parse(result);
        } catch (e) {
          console.warn('⚠️ Failed to parse tool result JSON:', e);
          return null;
        }
      }
      return result;
    };
    
    // Helper: Extract component data from a component object
    const extractComponentData = (component) => {
      if (!component || !component.bricksJson || !Array.isArray(component.bricksJson) || component.bricksJson.length === 0) {
        return null;
      }
      
      // Extract the first element which contains content and globalClasses
      const bricksData = component.bricksJson[0];
      // Extract the content array (actual Bricks elements) and global classes
      const bricksContent = bricksData?.content || bricksData; // Fallback to bricksData if no content property
      const extractedGlobalClasses = bricksData?.globalClasses || component.globalClasses || [];
      
      // Ensure bricksContent is an array for insertion
      const finalBricksStructure = Array.isArray(bricksContent) ? bricksContent : (Array.isArray(bricksData) ? bricksData : [bricksData]);
      
      return {
        name: component.name || 'Bricks Component',
        category: component.category || 'other',
        bricksJson: finalBricksStructure, // Array of Bricks elements for insertion
        globalClasses: extractedGlobalClasses,
        thumbnail: component.thumbnail || null
      };
    };
    
    const components = [];
    
    // Collect ALL bricks_insert_component results (multiple components can be inserted)
    for (let i = 0; i < debugToolData.length; i++) {
      const tool = debugToolData[i];
      if (tool.tool === 'bricks_insert_component' && tool.success) {
        const parsedResult = parseToolResult(tool.result);
        if (parsedResult?.component) {
          const componentData = extractComponentData(parsedResult.component);
          if (componentData) {
            components.push(componentData);
          }
        }
      }
    }
    
    // Collect ALL bricks_get_component results that return single components (not search results)
    for (let i = 0; i < debugToolData.length; i++) {
      const tool = debugToolData[i];
      if (tool.tool === 'bricks_get_component' && tool.success) {
        const parsedResult = parseToolResult(tool.result);
        // Make sure it's a single component object, not a search results array
        if (parsedResult?.component && !Array.isArray(parsedResult.component) && parsedResult.component.bricksJson) {
          const componentData = extractComponentData(parsedResult.component);
          if (componentData) {
            // Only add if not already added from bricks_insert_component
            const alreadyAdded = components.some(c => c.name === componentData.name && c.category === componentData.category);
            if (!alreadyAdded) {
              components.push(componentData);
            }
          }
        }
      }
    }
    
    return components;
  }

  // Helper: extract main textual content from various response formats (Anthropic, OpenAI, etc.)
  const getTextFromResponse = (resp) => {
    if (resp == null) return ''
    // Simple string response
    if (typeof resp === 'string') return resp
    // Anthropic messages come as an array of {type: 'text', text: '...'}
    if (Array.isArray(resp)) {
      return resp.map(chunk => {
        if (typeof chunk === 'string') return chunk
        if (chunk && typeof chunk === 'object') {
          return chunk.text || chunk.message || chunk.content || ''
        }
        return ''
      }).join('')
    }
    // Generic object – try common keys
    if (typeof resp === 'object') {
      return resp.message || resp.text || resp.content || resp.html || ''
    }
    return ''
  }

  // Helper: grab any html/css/js blocks if they exist
  const getPartsFromResponse = (resp) => {
    if (resp && typeof resp === 'object') {
      return {
        html: resp.html || '',
        css: resp.css || '',
        js: resp.js || ''
      }
    }
    return { html: '', css: '', js: '' }
  }

  // Helper: save last opened session ID to usermeta via REST
  const saveLastSession = async (sessionId) => {
    try {
      await fetch(`${adminData.restUrl}last-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({ session_id: sessionId || '' })
      })
    } catch (error) {
      console.error('Failed to save last session:', error)
    }
  }

  // Helper: fetch last opened session ID and automatically load it
  const loadLastSession = async (sessionsList = []) => {
    try {
      const response = await fetch(`${adminData.restUrl}last-session`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.session_id) {
          const match = sessionsList.find(s => s.id === data.session_id)
          if (match) {
            // Delay loading slightly to ensure UI ready
            setTimeout(() => loadSession(match), 0)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load last session:', error)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isSiteContextModalOpen && isBricksMode) {
      if (!siteMetaTitle && !siteMetaDescription) {
        fetchSiteMetaData()
      }
      if (availablePosts.length === 0 && !loadingPosts) {
        fetchAvailablePosts()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSiteContextModalOpen])

  useEffect(() => {
    loadSettings()
    loadChatSessions(true) // Auto-load last session only on initial mount
    loadAvailableAgents() // Load AI agents
    
    // Check for prefilled message from SEO Analytics
    const prefillMessage = sessionStorage.getItem('mat_prefill_message')
    if (prefillMessage) {
      setInputMessage(prefillMessage)
      sessionStorage.removeItem('mat_prefill_message')
    }
    
    // Load custom system message from localStorage
    const savedSystemMessage = localStorage.getItem('magicassistant_custom_system_message')
    const savedEnableCustom = localStorage.getItem('magicassistant_enable_custom_system') === 'true'
    const savedPersistFiles = localStorage.getItem('magicassistant_persist_files') === 'true'
    if (savedSystemMessage) {
      setCustomSystemMessage(savedSystemMessage)
    }
    setEnableCustomSystem(savedEnableCustom)
    setPersistFiles(savedPersistFiles)
    
    // Load site meta data if in bricks mode
    if (isBricksMode) {
      fetchSiteMetaData()
      fetchAvailablePosts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSiteMetaData = async () => {
    if (!isBricksMode) return
    
    try {
      const response = await fetch(`${adminData.restUrl}site-meta`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        }
      })
      const data = await response.json()
      if (data.success) {
        setSiteMetaTitle(data.meta_title || '')
        setSiteMetaDescription(data.meta_description || '')
      }
    } catch (error) {
      console.error('Failed to fetch site meta data:', error)
    }
  }

  const saveSiteContextSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('magicassistant_bricks_site_context_enabled', siteContextEnabled.toString())
      localStorage.setItem('magicassistant_bricks_site_context_pages', JSON.stringify(selectedSiteContextPages))
      localStorage.setItem('magicassistant_bricks_text_replacement_enabled', textReplacementEnabled.toString())
      localStorage.setItem('magicassistant_bricks_image_replacement_enabled', imageReplacementEnabled.toString())
      showSuccess('Bricks settings saved!')
    }
  }

  const MAX_SITE_CONTEXT_ITEMS = 10

  const handleSiteContextPageSelect = (pageId) => {
    if (!pageId) return
    
    const pageIdNum = parseInt(pageId)
    if (isNaN(pageIdNum)) return
    
    setSelectedSiteContextPages(prev => {
      // If already selected, remove it
      if (prev.includes(pageIdNum)) {
        return prev.filter(id => id !== pageIdNum)
      }
      // If not selected and under limit, add it
      if (prev.length < MAX_SITE_CONTEXT_ITEMS) {
        return [...prev, pageIdNum]
      }
      // At limit, show error
      showError(`Maximum ${MAX_SITE_CONTEXT_ITEMS} pages/posts can be selected`)
      return prev
    })
  }

  const renderSiteContextSettings = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-green-900 dark:text-green-100 leading-tight">Bricks Site Context</h3>
          <p className="text-xs text-green-700 dark:text-green-300 leading-tight">Optionally send site info so the AI picks components that fit your niche.</p>
        </div>
      </div>
      
      <label className="flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          id="siteContextEnabled"
          checked={siteContextEnabled}
          onChange={(e) => setSiteContextEnabled(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            siteContextEnabled
              ? 'bg-green-600 border-green-600'
              : 'bg-white border-green-500 dark:bg-gray-800 dark:border-green-400'
          }`}
        >
          {siteContextEnabled && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="ml-2 text-sm font-medium text-green-900 dark:text-green-100">
          Enable site context
        </span>
      </label>

      {siteContextEnabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-1">
              Pages / posts ({selectedSiteContextPages.length}/{MAX_SITE_CONTEXT_ITEMS})
            </label>
            <p className="text-xs text-green-700 dark:text-green-300 mb-2">Pick up to ten entries that best represent your site.</p>
            {loadingPosts ? (
              <div className="flex items-center justify-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                <Spinner size="sm" />
                <span className="ml-2 text-xs text-green-700 dark:text-green-300">Loading…</span>
              </div>
            ) : (
              <div className="space-y-2">
                {availablePosts.length > 0 ? (
                  <>
                    {selectedSiteContextPages.map((selectedId, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={selectedId}
                          onChange={(e) => {
                            const newPages = [...selectedSiteContextPages]
                            newPages[index] = parseInt(e.target.value)
                            setSelectedSiteContextPages(newPages)
                          }}
                          className="flex-1 p-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 text-sm"
                        >
                          <option value="">Select…</option>
                          {availablePosts.map(post => (
                            <option key={post.id} value={post.id}>
                              {post.title} ({post.type === 'page' ? 'Page' : 'Post'})
                            </option>
                          ))}
                        </select>
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => {
                            setSelectedSiteContextPages(prev => prev.filter((_, i) => i !== index))
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    {selectedSiteContextPages.length < MAX_SITE_CONTEXT_ITEMS && (
                      <select
                        value=""
                        onChange={(e) => handleSiteContextPageSelect(e.target.value)}
                        className="w-full p-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 text-sm"
                      >
                        <option value="">+ Add page/post…</option>
                        {availablePosts
                          .filter(post => !selectedSiteContextPages.includes(post.id))
                          .map(post => (
                            <option key={post.id} value={post.id}>
                              {post.title} ({post.type === 'page' ? 'Page' : 'Post'})
                            </option>
                          ))}
                      </select>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-green-700 dark:text-green-300">No pages or posts found.</p>
                )}
              </div>
            )}
          </div>

          {(siteMetaTitle || siteMetaDescription) && (
            <div className="bg-green-100/80 dark:bg-green-800/30 rounded p-3 space-y-1">
              <p className="text-xs font-medium text-green-900 dark:text-green-100">Site meta</p>
              {siteMetaTitle && (
                <p className="text-xs text-green-800 dark:text-green-200">
                  <span className="font-semibold">Title:</span> {siteMetaTitle}
                </p>
              )}
              {siteMetaDescription && (
                <p className="text-xs text-green-800 dark:text-green-200">
                  <span className="font-semibold">Description:</span> {siteMetaDescription}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={saveSiteContextSettings}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Save site context
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  const renderTextReplacementSettings = () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
          <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-purple-900 dark:text-purple-100 leading-tight">Auto-replace Placeholder Text</h3>
          <p className="text-xs text-purple-700 dark:text-purple-300 leading-tight">Replace lorem ipsum and generic content with site-relevant copy when inserting components.</p>
        </div>
      </div>

      <label className="flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          id="textReplacementEnabled"
          checked={textReplacementEnabled}
          onChange={(e) => {
            setTextReplacementEnabled(e.target.checked)
            // Auto-save on change
            if (typeof window !== 'undefined') {
              localStorage.setItem('magicassistant_bricks_text_replacement_enabled', e.target.checked.toString())
            }
          }}
          className="peer sr-only"
        />
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            textReplacementEnabled
              ? 'bg-purple-600 border-purple-600'
              : 'bg-white border-purple-500 dark:bg-gray-800 dark:border-purple-400'
          }`}
        >
          {textReplacementEnabled && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="ml-2 text-sm font-medium text-purple-900 dark:text-purple-100">
          Enable text replacement
        </span>
      </label>

      {textReplacementEnabled && (
        <div className="bg-purple-100/80 dark:bg-purple-800/30 rounded p-3">
          <p className="text-xs text-purple-800 dark:text-purple-200">
            <span className="font-semibold">Tip:</span> For best results, include context in your prompt (e.g., "Insert a hero section for a dental clinic") so the AI knows what content to generate.
          </p>
        </div>
      )}

      <label className="flex items-center cursor-pointer select-none">
        <input
          type="checkbox"
          id="imageReplacementEnabled"
          checked={imageReplacementEnabled}
          onChange={(e) => {
            setImageReplacementEnabled(e.target.checked)
            // Auto-save on change
            if (typeof window !== 'undefined') {
              localStorage.setItem('magicassistant_bricks_image_replacement_enabled', e.target.checked.toString())
            }
          }}
          className="peer sr-only"
        />
        <span
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            imageReplacementEnabled
              ? 'bg-emerald-600 border-emerald-600'
              : 'bg-white border-emerald-500 dark:bg-gray-800 dark:border-emerald-400'
          }`}
        >
          {imageReplacementEnabled && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <span className="ml-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
          Enable image replacement
        </span>
      </label>

      {imageReplacementEnabled && (
        <div className="bg-emerald-100/80 dark:bg-emerald-800/30 rounded p-3">
          <p className="text-xs text-emerald-800 dark:text-emerald-200">
            <span className="font-semibold">Tip:</span> Placeholder images (placehold.co, picsum, etc.) will be automatically replaced with relevant Unsplash images based on context.
          </p>
        </div>
      )}
    </div>
  )

  const loadSettings = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}settings`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        // Always set creditsInfo from settings.current_credits or license_limits
        if (data.current_credits) {
          setCreditsInfo(data.current_credits)
        } else if (data.license_limits) {
          // Handle comprehensive license limits
          setCreditsInfo(data.license_limits)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadAvailableAgents = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}ai-agents`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Only load active agents
          const activeAgents = (data.data || []).filter(agent => agent.is_active === '1' || agent.is_active === 1)
          setAvailableAgents(activeAgents)
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  // Helper function to format limit display text
  const formatLimitDisplay = (limitInfo) => {
    if (!limitInfo) return ''
    
    // Handle credit-based limits
    if (limitInfo.type === 'credits' || limitInfo.limit !== undefined) {
      let used = null
      if (typeof limitInfo.current !== 'undefined') {
        used = Number(limitInfo.current)
      } else if (typeof limitInfo.limit !== 'undefined' && typeof limitInfo.remaining !== 'undefined') {
        used = Number(limitInfo.limit) - Number(limitInfo.remaining)
      }
      
      if (used !== null && typeof limitInfo.limit !== 'undefined') {
        return `💳 ${used.toFixed(2)} / ${limitInfo.limit}`
      } else if (typeof limitInfo.limit !== 'undefined') {
        return `💳 ${limitInfo.limit}`
      }
    }
    
    // Handle request-based limits (show most relevant limit)
    if (limitInfo.type === 'requests' && limitInfo.requests) {
      const requests = limitInfo.requests
      
      // Prioritize showing the most constrained limit
      if (requests.daily) {
        const used = requests.daily.used || 0
        const limit = requests.daily.limit
        const remaining = requests.daily.remaining !== undefined ? requests.daily.remaining : (limit - used)
        return `📊 ${used}/${limit} daily (${remaining} left)`
      } else if (requests.hourly) {
        const used = requests.hourly.used || 0
        const limit = requests.hourly.limit
        const remaining = requests.hourly.remaining !== undefined ? requests.hourly.remaining : (limit - used)
        return `📊 ${used}/${limit} hourly (${remaining} left)`
      } else if (requests.monthly) {
        const used = requests.monthly.used || 0
        const limit = requests.monthly.limit
        const remaining = requests.monthly.remaining !== undefined ? requests.monthly.remaining : (limit - used)
        return `📊 ${used}/${limit} monthly (${remaining} left)`
      }
    }
    
    return ''
  }

  const loadChatSessions = async (shouldAutoLoadLastSession = false) => {
    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const sessions = data.sessions || []
        setChatSessions(sessions)
        // Only auto-load last session if explicitly requested
        if (shouldAutoLoadLastSession) {
          loadLastSession(sessions)
        }
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    }
  }

  const handleStreamingResponse = async (apiMessageContent, pageContext) => {
    // Dynamic thinking messages based on context and mode
    const getThinkingMessages = () => {
      const commonMessages = [
        "Analyzing your request...",
        "Processing information...",
        "Gathering relevant data...",
        "Preparing response...",
        "Checking available tools...",
        "Optimizing approach..."
      ];

      const agentMessages = [
        "Planning multi-step approach...",
        "Identifying required tools...",
        "Analyzing task complexity...",
        "Preparing tool execution...",
        "Coordinating resources...",
        "Strategizing solution..."
      ];

      const contextMessages = [];
      
      // Add context-specific messages based on the user's request
      const messageText = apiMessageContent.toLowerCase();
      if (messageText.includes('seo') || messageText.includes('search')) {
        contextMessages.push("Analyzing SEO requirements...", "Checking search optimization...");
      }
      if (messageText.includes('content') || messageText.includes('write')) {
        contextMessages.push("Structuring content approach...", "Analyzing content requirements...");
      }
      if (messageText.includes('image') || messageText.includes('photo')) {
        contextMessages.push("Searching for relevant images...", "Processing image requirements...");
      }
      if (messageText.includes('post') || messageText.includes('page')) {
        contextMessages.push("Accessing WordPress data...", "Analyzing post structure...");
      }
      if (messageText.includes('optimize') || messageText.includes('performance')) {
        contextMessages.push("Running performance analysis...", "Checking optimization opportunities...");
      }

      const baseMessages = forceAgentMode ? agentMessages : commonMessages;
      return [...contextMessages, ...baseMessages];
    };

    // Create a placeholder assistant message that will be updated with streaming chunks
    const assistantMessage = {
      role: 'assistant',
      content: "Initializing request...", // Will be updated by real status events
      timestamp: new Date(),
      provider: 'openai', // Default, will be updated
      agent_mode: isBricksMode ? 'bricks' : forceAgentMode, // Set 'bricks' for Bricks mode, otherwise use forceAgentMode
      tool_calls_count: 0,
      debug_tool_data: [],
      tokens_used: 0,
      cost: 0,
      response_time: 0,
      isError: false,
      isStreaming: true, // Flag to indicate this is a streaming message
      processing_steps: [], // Will be populated during completion
      html: null,
      css: null,
      js: null
    }

    // Add the placeholder message that will be updated
    let messageIndex
    setMessages(prev => {
      messageIndex = prev.length
      return [...prev, assistantMessage]
    })

    // Track status updates from backend - no more fake cycling messages
    let hasReceivedContent = false;

    try {
      // Create the streaming request body
      const requestBody = {
        message: apiMessageContent,
        history: sanitizeMessageHistory(messages),
        agent_mode: isBricksMode ? 'bricks' : forceAgentMode, // Set 'bricks' for Bricks mode, otherwise use forceAgentMode
        session_id: currentSessionId,
        page_url: pageContext.url,
        page_context: pageContext,
        attached_files: attachedFiles.length > 0 ? attachedFiles.map(f => ({
          name: f.name,
          type: f.type,
          size: f.size,
          content: f.content,
          isImage: f.isImage || false
        })) : undefined,
        custom_system_message: enableCustomSystem && customSystemMessage ? customSystemMessage : undefined,
        web_search_enabled: webSearchEnabled,
        agent_id: selectedAgentId,
        streaming: true, // Flag to enable streaming
        ...(isBricksMode && siteContextEnabled ? {
          site_context_enabled: true,
          site_context_pages: selectedSiteContextPages,
          site_meta_title: siteMetaTitle,
          site_meta_description: siteMetaDescription
        } : {}),
        ...(isBricksMode ? {
          text_replacement_enabled: textReplacementEnabled,
          image_replacement_enabled: imageReplacementEnabled
        } : {}),
        ...(overrideProvider ? {
          override_provider: overrideProvider,
          override_model: overrideModel
        } : {})
      }

      // Use fetch for streaming with proper POST data since EventSource doesn't support POST
      const response = await fetch(`${adminData.restUrl}chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
          'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''

      let accumulatedContent = ''
      let responseMetadata = {}

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }
          
          // Decode the chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // Log debug messages for troubleshooting
                if (data.type === 'test' || data.type === 'debug') {
                  console.log('Streaming debug:', data.message);
                  continue;
                }
                
                // Handle real-time status updates from backend
                if (data.type === 'status') {
                  // Update the thinking message with real status from backend
                  setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages[messageIndex] && newMessages[messageIndex].isStreaming && !hasReceivedContent) {
                      newMessages[messageIndex] = {
                        ...newMessages[messageIndex],
                        content: data.message
                      };
                    }
                    return newMessages;
                  });
                  continue;
                }
                
                if (data.type === 'content') {
                  // Mark that we've received actual content
                  if (!hasReceivedContent) {
                    hasReceivedContent = true;
                  }
                  
                  // Accumulate content chunks
                  accumulatedContent += data.chunk || '';
                  
                  // Update the message in real-time and turn off streaming styling
                  setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages[messageIndex]) {
                      newMessages[messageIndex] = {
                        ...newMessages[messageIndex],
                        content: accumulatedContent,
                        isStreaming: false // Turn off streaming styling when content starts
                      };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'metadata') {
                  // Store metadata for final message update
                  responseMetadata = {
                    provider: data.provider,
                    tool_calls_count: data.tool_calls_count || 0,
                    debug_tool_data: data.debug_tool_data || [],
                    tokens_used: data.tokens_used || 0,
                    cost: data.cost || 0,
                    response_time: data.response_time || 0,
                    session_id: data.session_id
                  };
                } else if (data.type === 'complete') {
                  // Extract HTML, CSS, JS from final content
                  const { html: extractedHtml, css: extractedCss, js: extractedJs } = getPartsFromResponse(accumulatedContent);
                  
                  // For Bricks mode, check if we have component data from the library
                  let bricksStructure = null;
                  let bricksGlobalClasses = [];
                  
                  // Check both data.debug_tool_data and responseMetadata.debug_tool_data
                  const toolData = data.debug_tool_data || responseMetadata.debug_tool_data || [];
                  
                  if (isBricksMode && toolData && Array.isArray(toolData) && toolData.length > 0) {
                    const components = extractBricksComponentFromToolData(toolData);
                    if (components && components.length > 0) {
                      // Combine all components into a single structure for now (we'll store them separately in message)
                      // For insertion, we'll handle each component separately
                      const allElements = [];
                      const allGlobalClasses = [];
                      components.forEach((comp) => {
                        allElements.push(...comp.bricksJson);
                        allGlobalClasses.push(...(comp.globalClasses || []));
                      });
                      bricksStructure = allElements;
                      bricksGlobalClasses = allGlobalClasses;
                      // Store components array for thumbnail display
                      responseMetadata.components = components;
                    } else if (extractedHtml) {
                      // Fallback to HTML parsing (legacy flow)
                      try {
                        const rootId = generateId();
                        const parentId = 0;
                        const parserStates = getDefaultParserStates();
                        const cmValues = { html: extractedHtml, css: extractedCss, js: extractedJs };
                        bricksStructure = parseHtmlStringToObjectArray(rootId, parentId, cmValues, parserStates, bricksGlobalClasses);
                      } catch (parseError) {
                        console.error('❌ Streaming: Error parsing HTML:', parseError);
                      }
                    }
                  }
                  
                  // Final update with all metadata and extracted parts
                  setMessages(prev => {
                    const newMessages = [...prev];
                    if (newMessages[messageIndex]) {
                      newMessages[messageIndex] = {
                        ...newMessages[messageIndex],
                        ...responseMetadata,
                        tool_calls_count: data.tool_calls_count || 0,
                        tokens_used: data.tokens_used || 0,
                        cost: data.cost || 0,
                        response_time: data.response_time || 0,
                        reasoning: data.reasoning || null,
                        debug_tool_data: data.debug_tool_data || responseMetadata.debug_tool_data || [],
                        processing_steps: data.processing_steps || [],
                        isStreaming: false,
                        html: extractedHtml,
                        css: extractedCss,
                        js: extractedJs,
                        bricks_structure: isBricksMode ? (bricksStructure || null) : undefined,
                        globalClasses: isBricksMode ? bricksGlobalClasses : undefined,
                        components: isBricksMode && responseMetadata.components ? responseMetadata.components : undefined
                      };
                    }
                    return newMessages;
                  });

                  // Update session ID if new
                  if (!currentSessionId && responseMetadata.session_id) {
                    setCurrentSessionId(responseMetadata.session_id);
                    loadChatSessions();
                    saveLastSession(responseMetadata.session_id);
                  }

                  // Update credits if provided
                  if (data.credits) {
                    setCreditsInfo(data.credits);
                  }

                  // Provide data back to parent component
                  if (onAiResponseUpdate) {
                    if (isBricksMode && bricksStructure) {
                      // Bricks mode with component or parsed structure
                      onAiResponseUpdate({
                        html: extractedHtml,
                        css: extractedCss,
                        js: extractedJs,
                        bricks_structure: bricksStructure,
                        globalClasses: bricksGlobalClasses
                      });
                    } else if (extractedHtml) {
                      // Regular HTML/CSS/JS
                      onAiResponseUpdate({
                        html: extractedHtml,
                        css: extractedCss,
                        js: extractedJs
                      });
                    }
                  }

                  // Streaming complete
                  return; // Exit the streaming loop
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Streaming error');
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        
        // Streaming error occurred
        
        // Update message with error
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[messageIndex]) {
            newMessages[messageIndex] = {
              ...newMessages[messageIndex],
              content: 'Sorry, I encountered an error while streaming the response.',
              isError: true,
              isStreaming: false
            };
          }
          return newMessages;
        });
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Streaming setup error:', error)
      
      // Streaming setup failed
      
      // Update message with error
      setMessages(prev => {
        const newMessages = [...prev]
        if (newMessages[messageIndex]) {
          newMessages[messageIndex] = {
            ...newMessages[messageIndex],
            content: `Sorry, I encountered an error: ${error.message}`,
            isError: true,
            isStreaming: false
          }
        }
        return newMessages
      })
    }
  }

  // Helper: Detect if user wants to generate an image
  const detectImageGenerationIntent = (message) => {
    const imageKeywords = [
      'generate image',
      'create image',
      'make image',
      'draw image',
      'generate picture',
      'create picture',
      'make picture',
      'generate an image',
      'create an image',
      'make an image'
    ]
    
    const lowerMessage = message.toLowerCase()
    return imageKeywords.some(keyword => lowerMessage.includes(keyword))
  }

  // Helper: Generate image
  const generateImage = async (prompt, provider = 'openai', model = 'dall-e-3', size = '1024x1024', format = 'png') => {
    try {
      const response = await fetch(`${adminData.restUrl}generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          prompt: prompt,
          provider: provider,
          model: model,
          size: size,
          format: format,
          quality: 'standard',
          style: 'vivid',
          session_id: currentSessionId // Pass current session ID
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Image generation failed')
      }

      return data
    } catch (error) {
      console.error('Image generation error:', error)
      throw error
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return
    
    // Prepare display message content (what the user sees in chat)
    let displayContent = inputMessage || ''
    if (attachedFiles.length > 0) {
      const filesDisplay = attachedFiles.map(file => {
        if (file.isImage) {
          return `📷 **Image:** ${file.name} (${(file.size / 1024).toFixed(1)}KB)`
        } else {
          return `📎 **File:** ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`
        }
      }).join('\n')
      
      displayContent = displayContent ? `${displayContent}\n\n${filesDisplay}` : filesDisplay
    }
    
    // Prepare API message content (what gets sent to the AI with full file contents)
    let apiMessageContent = inputMessage || ''
    if (attachedFiles.length > 0) {
      const filesContent = attachedFiles.map(file => {
        if (file.isImage && file.content) {
          return `**Image: ${file.name}** (${file.type}, ${(file.size / 1024).toFixed(1)}KB)\n${file.content}`
        } else if (file.content && !file.isImage) {
          return `**File: ${file.name}** (${file.type})\n\`\`\`\n${file.content}\n\`\`\``
        } else {
          return `**File: ${file.name}** (${file.type}, ${(file.size / 1024).toFixed(1)}KB) - Binary file attached`
        }
      }).join('\n\n')
      
      apiMessageContent = apiMessageContent ? `${apiMessageContent}\n\n${filesContent}` : filesContent
    }
    
    const userMessage = {
      role: 'user',
      content: displayContent, // This is what shows in the chat UI
      fullContent: apiMessageContent, // Store the full content for AI context
      timestamp: new Date(),
      userId: adminData?.currentUser?.id,
      userName: adminData?.currentUser?.name,
      userAvatar: adminData?.currentUser?.avatar,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = inputMessage
    setInputMessage('')
    // Only clear files if persistence is disabled
    if (!persistFiles) {
      setAttachedFiles([])
    }

    // Handle image generation if mode is enabled
    if (imageGenerationMode) {
      setIsLoading(true)
      try {
        const result = await generateImage(
          messageToSend,
          imageGenProvider,
          imageGenModel,
          imageAspectRatio,
          imageOutputFormat
        )
        
        // Update session ID if this is a new session
        if (!currentSessionId && result.session_id) {
          setCurrentSessionId(result.session_id)
          // Save as last opened session
          saveLastSession(result.session_id)
          // Refresh chat sessions list to include the new session
          loadChatSessions()
        }
        
        // Create markdown content with generated images
        let imageContent = '🎨 **Image Generated Successfully!**\n\n'
        
        result.images.forEach((image, index) => {
          const imageUrl = image.url || image.b64_json
          if (imageUrl) {
            // Use SEO-friendly alt text from backend or fallback
            const altText = image.alt || `Generated Image ${index + 1}`
            imageContent += `![${altText}](${imageUrl})\n\n`
            if (image.revised_prompt) {
              imageContent += `*Revised Prompt:* ${image.revised_prompt}\n\n`
            }
          }
        })
        
        const assistantMessage = {
          role: 'assistant',
          content: imageContent,
          timestamp: new Date(),
          provider: `${imageGenProvider}-${imageGenModel}`,
          agent_mode: false,
          tool_calls_count: 0,
          isError: false,
          isImageGeneration: true,
          generatedImages: result.images
        }
        
        setMessages(prev => [...prev, assistantMessage])
        
        // Update credits info
        if (result.credits) {
          setCreditsInfo(result.credits)
        }
        
        setIsLoading(false)
        return
      } catch (error) {
        console.error('Image generation error:', error)
        const errorMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error generating the image: ${error.message || 'Unknown error'}`,
          timestamp: new Date(),
          isError: true
        }
        setMessages(prev => [...prev, errorMessage])
        setIsLoading(false)
        return
      }
    }

    try {
      // Get current post information from adminData
      const currentPost = adminData?.currentPost || {}
      
      // Build context information for the AI
      let pageContext = {
        url: typeof window !== 'undefined' ? window.location.href : '',
        post_id: currentPost.id || null,
        post_type: currentPost.type || null,
        post_title: currentPost.title || '',
        context: currentPost.context || 'unknown',
        ...(isBricksMode ? {
          bricks_framework: selectedFramework,
          text_replacement_enabled: textReplacementEnabled,
          image_replacement_enabled: imageReplacementEnabled
        } : {})
      }

      // Check if streaming is enabled
      const isStreamingEnabled = settings?.streaming_enabled === true

      // Streaming now works in Bricks mode via the regular /chat endpoint with agent_mode: 'bricks'
      if (isStreamingEnabled) {
        // Set loading to false to ensure no loading spinner shows
        setIsLoading(false)
        // Set streaming state to disable UI during streaming
        setIsStreaming(true)
        // Use Server-Sent Events for streaming
        await handleStreamingResponse(apiMessageContent, pageContext)
        // Clear streaming state when done
        setIsStreaming(false)
      } else {
        // Only set loading state for non-streaming requests
        setIsLoading(true)
        
        // Always use the /chat endpoint - Bricks mode is now handled via agent_mode: 'bricks'
        // This ensures we use the new MCP-based component library system
        const endpoint = `${adminData.restUrl}chat`;

        // Prepare request body - use consistent format for all modes
        const requestBody = {
          message: apiMessageContent, // Use the API version with full content
          history: sanitizeMessageHistory(messages),
          agent_mode: isBricksMode ? 'bricks' : forceAgentMode, // Set 'bricks' for Bricks mode, otherwise use forceAgentMode
          session_id: currentSessionId,
          page_url: pageContext.url,
          page_context: pageContext,
          attached_files: attachedFiles.length > 0 ? attachedFiles.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            content: f.content,
            isImage: f.isImage || false
          })) : undefined,
          custom_system_message: enableCustomSystem && customSystemMessage ? customSystemMessage : undefined,
          web_search_enabled: webSearchEnabled,
          agent_id: selectedAgentId,
          ...(isBricksMode && siteContextEnabled ? {
            site_context_enabled: true,
            site_context_pages: selectedSiteContextPages,
            site_meta_title: siteMetaTitle,
            site_meta_description: siteMetaDescription
          } : {}),
          ...(isBricksMode ? {
            text_replacement_enabled: textReplacementEnabled,
            image_replacement_enabled: imageReplacementEnabled
          } : {}),
          ...(overrideProvider ? {
            override_provider: overrideProvider,
            override_model: overrideModel
          } : {})
        };

        // Use regular fetch for non-streaming
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': adminData.nonces.wp_rest,
            'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false',
          },
          body: JSON.stringify(requestBody)
        })

        const data = await response.json()

        if (data.success) {
          // Update current session ID if this is a new session
          if (!currentSessionId && data.session_id) {
            setCurrentSessionId(data.session_id)
            // Refresh chat sessions list to include the new session
            loadChatSessions() // Don't auto-load, we're already in the new session
            // Persist as last opened session
            saveLastSession(data.session_id)
          }

          // Handle response based on mode
          let chatContent, extractedHtml, extractedCss, extractedJs, parsedBricksStructure, globalClasses, components;

          if (isBricksMode) {
            // First, check if we have a component from the component library (via MCP tools)
            components = extractBricksComponentFromToolData(data.debug_tool_data);
            
            if (components && components.length > 0) {
              // Combine all components for storage, but keep track of individual components
              const allElements = [];
              const allGlobalClasses = [];
              
              components.forEach((comp) => {
                allElements.push(...comp.bricksJson);
                allGlobalClasses.push(...(comp.globalClasses || []));
              });
              
              parsedBricksStructure = allElements;
              globalClasses = allGlobalClasses;
              
              // Update chat content to reflect component usage
              if (components.length === 1) {
                const comp = components[0];
                chatContent = data.ai_response || `✅ **Component Ready: "${comp.name}"**\n\nThis component is ready to insert into your Bricks canvas. Click the "Insert into Bricks" button below!`;
                if (comp.category) {
                  chatContent += `\n\n**Component Details:**\n- Category: ${comp.category}\n- ${comp.bricksJson.length} Bricks elements\n- ${comp.globalClasses.length} CSS classes`;
                }
              } else {
                chatContent = data.ai_response || `✅ **${components.length} Components Ready**\n\nAll components are ready to insert into your Bricks canvas. Click the "Insert into Bricks" button below to insert all components at once!`;
                chatContent += `\n\n**Components:**\n${components.map((comp, idx) => {
                  return `${idx + 1}. ${comp.name} (${comp.category || 'other'}) - ${comp.bricksJson.length} elements, ${comp.globalClasses.length} classes`;
                }).join('\n')}`;
              }
              
              extractedHtml = '';
              extractedCss = '';
              extractedJs = '';
            } else {
              // Fallback: Bricks mode response includes converted HTML/CSS/JS (legacy flow)
              chatContent = data.ai_response || 'Generated Bricks structure successfully!';
              extractedHtml = data.html || '';
              extractedCss = data.css || '';
              extractedJs = data.js || '';

              // Parse HTML into Bricks structure if we have HTML
              if (extractedHtml) {
                try {
                  // Generate IDs for root and parent
                  const rootId = generateId();
                  const parentId = 0; // Root level insertion
                  
                  // Get default parser states
                  const parserStates = getDefaultParserStates();
                  
                  // Initialize global classes array (will be populated by parser)
                  globalClasses = [];
                  
                  // Parse HTML into Bricks elements array
                  const cmValues = {
                    html: extractedHtml,
                    css: extractedCss,
                    js: extractedJs
                  };
                  
                  parsedBricksStructure = parseHtmlStringToObjectArray(
                    rootId,
                    parentId,
                    cmValues,
                    parserStates,
                    globalClasses
                  );
                  
                  // Add success message with stats
                  chatContent += `\n\n**Structure Generated:**\n- ${parsedBricksStructure.length} Bricks elements\n- ${globalClasses.length} CSS classes\n- ${extractedCss ? 'Includes CSS styling' : 'No CSS'}\n- ${extractedJs ? 'Includes JavaScript' : 'No JavaScript'}`;
                } catch (parseError) {
                  console.error('❌ Error parsing HTML:', parseError);
                  chatContent += '\n\n⚠️ Warning: HTML was generated but could not be parsed into Bricks structure. You can still use the raw HTML/CSS.';
                  parsedBricksStructure = null;
                  globalClasses = [];
                }
              }
            }
          } else {
            // Regular chat mode
            const responseContent = data.response;
            chatContent = getTextFromResponse(responseContent);
            const parts = getPartsFromResponse(responseContent);
            extractedHtml = parts.html;
            extractedCss = parts.css;
            extractedJs = parts.js;
          }

          const assistantMessage = {
            role: 'assistant',
            content: chatContent,
            timestamp: new Date(),
            provider: data.provider,
            agent_mode: isBricksMode ? 'bricks' : forceAgentMode,
            tool_calls_count: data.tool_calls_count || 0,
            debug_tool_data: data.debug_tool_data || [],
            tokens_used: data.tokens_used,
            cost: data.cost,
            response_time: data.response_time,
            isError: false,
            html: extractedHtml,
            css: extractedCss,
            js: extractedJs,
          bricks_structure: isBricksMode ? parsedBricksStructure : undefined,
          globalClasses: isBricksMode ? globalClasses : undefined,
          components: isBricksMode && components.length > 0 ? components : undefined // Store components with thumbnails
        }
        setMessages(prev => [...prev, assistantMessage])
          // Update credit info from response
          if (data.credits) {
            setCreditsInfo(data.credits)
          }
          // Provide parsed Bricks structure back to parent (e.g., Bricks builder) if present
          if (onAiResponseUpdate && isBricksMode && parsedBricksStructure) {
            onAiResponseUpdate({
              html: extractedHtml,
              css: extractedCss,
              js: extractedJs,
              bricks_structure: parsedBricksStructure,
              globalClasses: globalClasses
            });
          } else if (onAiResponseUpdate && extractedHtml) {
            // Fallback for non-Bricks mode or if parsing failed
            onAiResponseUpdate({
              html: extractedHtml,
              css: extractedCss,
              js: extractedJs
            });
          }
        } else {
        const errorMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.message || 'Unknown error'}`,
          timestamp: new Date(),
          isError: true
        }
        setMessages(prev => [...prev, errorMessage])
        // Update credit info from error response if available
        if (data.credits) {
          setCreditsInfo(data.credits)
        }
      }
      } // End of else block for non-streaming
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting. Please try again.',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setIsLoading(false)
    setIsStreaming(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (content) => {
    // Ensure we always pass a string to ReactMarkdown to avoid warnings
    let safeContent = ''
    if (typeof content === 'string') {
      safeContent = content
    } else if (Array.isArray(content)) {
      safeContent = getTextFromResponse(content)
    } else if (content && typeof content === 'object') {
      safeContent = content.message || content.html || JSON.stringify(content)
    } else if (content != null) {
      safeContent = String(content)
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        skipHtml={false}
        components={{
          // Prevent wrapping of images in p tags
          p: ({ children }) => {
            const childrenArray = React.Children.toArray(children)
            
            // Check if any child is the custom img component (React element with function type that has src prop)
            const hasImageComponent = childrenArray.some(child => 
              React.isValidElement(child) && 
              typeof child.type === 'function' &&
              child.props?.src
            )
            
            // Check if any child is an img element
            const hasImage = childrenArray.some(child => 
              React.isValidElement(child) && 
              child.type === 'img'
            )
            
            const shouldRenderAsDiv = hasImage || hasImageComponent
            if (shouldRenderAsDiv) {
              return <div className="mb-2 last:mb-0 text-gray-900 dark:text-gray-100">{children}</div>
            }
            
            return <p className="mb-2 last:mb-0 text-gray-900 dark:text-gray-100">{children}</p>
          },
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-900 dark:text-gray-100">{children}</em>,
          code: ({ children }) => <code className="leading-[1.5] bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono text-gray-900 dark:text-gray-100">{children}</code>,
          pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto overflow-y-auto max-h-[500px] text-sm font-mono text-gray-900 dark:text-gray-100 max-w-full break-all">{children}</pre>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-gray-900 dark:text-gray-100">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-gray-900 dark:text-gray-100">{children}</ol>,
          li: ({ children }) => <li className="mb-1 text-gray-900 dark:text-gray-100">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-2">{children}</blockquote>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{children}</h3>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors">{children}</a>,
          br: () => <br className="block" />,
          img: ({ src, alt }) => {
            const isUnsplash = src && src.includes('images.unsplash.com')
            
            const handleImageClick = () => {
              // Get higher resolution version of current image
              let highResSrc = src
              if (src.includes('images.unsplash.com')) {
                // Try to get the url_full from the image data if available
                const imageData = findUnsplashImageData(src)
                if (imageData && imageData.url_full) {
                  highResSrc = imageData.url_full
                } else {
                  // Fallback: Replace dimensions with higher resolution params
                  highResSrc = src.replace(/w=\d+/, 'w=1920').replace(/h=\d+/, 'h=1080')
                }
              }
              
              // For now, just show the single image (simplified for better performance)
              setLightboxImages([{ src: highResSrc, alt: alt || '' }])
              setCurrentImageIndex(0)
              resetLightboxState()
              setLightboxOpen(true)
            }

            if (!isUnsplash) {
              const handleSaveAsFeatured = () => {
                saveAsFeaturedImage(src, '', alt || 'AI Generated Image', '', '')
              }
              
              const handleSaveToLibrary = async () => {
                try {
                  // Try to find the generated image data to get proper title
                  const currentMsg = messages.find(m => m.generatedImages?.some(img => img.url === src))
                  const imageData = currentMsg?.generatedImages?.find(img => img.url === src)
                  
                  const resp = await fetch(`${adminData.restUrl}save-to-media-library`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-WP-Nonce': adminData.nonces.wp_rest,
                    },
                    body: JSON.stringify({
                      image_url: src,
                      alt: imageData?.alt || alt || 'AI Generated Image',
                      title: imageData?.title || alt || 'AI Generated Image'
                    }),
                  })
                  const data = await resp.json()
                  if (data.success) {
                    showSuccess(data.message || 'Image saved to Media Library!')
                  } else {
                    showError(data.message || 'Failed to save image')
                  }
                } catch (err) {
                  console.error('Save to media library error', err)
                  showError('Failed to save image to Media Library')
                }
              }
              
              return (
                <div className="inline-block my-4">
                  <img 
                    src={src} 
                    alt={alt || ''} 
                    className="rounded-lg shadow max-w-full block cursor-pointer hover:opacity-75 transition-opacity" 
                    onClick={handleImageClick}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleSaveToLibrary}
                      className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                    >
                      Save to Library
                    </button>
                    <button
                      onClick={handleSaveAsFeatured}
                      className="inline-flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                    >
                      Set as Featured
                    </button>
                  </div>
                </div>
              )
            }

            const handleSave = () => {
              // Use alt text if available, otherwise extract a meaningful title from the URL
              const effectiveAlt = alt || extractTitleFromUnsplashUrl(src) || 'Unsplash Image'
              // Extract metadata from the image URL or find it in the debug data
              const imageData = findUnsplashImageData(src)
              
              // Ensure we have the correct download_location for this specific image
              const downloadLocation = imageData?.download_location || ''
              
              if (!downloadLocation) {
                console.warn('No download_location found for image:', src)
                showError('Unable to find download location for this image. Image metadata may be missing.')
                return
              }
              
              saveUnsplashImage(
                src, 
                downloadLocation, 
                effectiveAlt,
                imageData?.id || '',
                imageData?.photographer || ''
              )
            }

            const handleSaveAsFeatured = () => {
              // Use alt text if available, otherwise extract a meaningful title from the URL
              const effectiveAlt = alt || extractTitleFromUnsplashUrl(src) || 'Unsplash Image'
              // Extract metadata from the image URL or find it in the debug data
              const imageData = findUnsplashImageData(src)
              
              // Ensure we have the correct download_location for this specific image
              const downloadLocation = imageData?.download_location || ''
              
              if (!downloadLocation) {
                console.warn('No download_location found for featured image:', src)
                showError('Unable to find download location for this image. Image metadata may be missing.')
                return
              }
              
              saveAsFeaturedImage(
                src, 
                downloadLocation, 
                effectiveAlt,
                imageData?.id || '',
                imageData?.photographer || ''
              )
            }

            // Get image data for photographer attribution and links
            const imageData = findUnsplashImageData(src)
            
            return (
              <div className="inline-block my-4">
                {imageData && (
                  <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                    {imageData.photographer && imageData.photographer_url && (
                      <span>
                        Photographer:{' '}
                        <a 
                          href={addUnsplashUTMParams(imageData.photographer_url)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {imageData.photographer}
                        </a>
                        {imageData.unsplash_link && (
                          <span>
                            {' • '}
                            <a 
                              href={addUnsplashUTMParams(imageData.unsplash_link)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              View on Unsplash
                            </a>
                          </span>
                        )}
                      </span>
                    )}
                    {!imageData.photographer && imageData.unsplash_link && (
                      <span>
                        <a 
                          href={addUnsplashUTMParams(imageData.unsplash_link)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          View on Unsplash
                        </a>
                      </span>
                    )}
                  </div>
                )}
                <img 
                  src={src} 
                  alt={alt || ''} 
                  className="rounded-lg shadow max-w-full block cursor-pointer hover:opacity-75 transition-opacity" 
                  onClick={handleImageClick}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                  >
                    Save to Library
                  </button>
                  <button
                    onClick={handleSaveAsFeatured}
                    className="inline-flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                  >
                    Set as Featured
                  </button>
                </div>
              </div>
            )
          },
        }}
      >
        {safeContent}
      </ReactMarkdown>
    )
  }

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat cleared! How can I help you today?',
        timestamp: new Date(),
        isWelcomeMessage: true
      }
    ])
    setCurrentSessionId(null) // Reset session ID for new conversation
    setCustomTitle('') // Reset custom title
    setIsEditingTitle(false) // Stop editing if in edit mode
    setForceAgentMode(true)   // Default back to Agent Mode
    setSelectedAgentId(null)  // Reset AI agent selection
    setOverrideProvider(null) // Reset provider override
    setOverrideModel(null)    // Reset model override
    // Only clear files if persistence is disabled
    if (!persistFiles) {
      setAttachedFiles([]) // Clear any attached files
    }
  }

  const startNewChat = () => {
    clearChat()
    // Clear the last session preference since user explicitly wants a new chat
    saveLastSession('')
    loadChatSessions() // Refresh the sessions list without auto-loading
    setForceAgentMode(true)
  }

  const loadSession = async (session) => {
    try {
      const response = await fetch(`${adminData.restUrl}chat-history?session_id=${session.id}`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.history) {
          // Convert database format to frontend format
          const formattedMessages = data.history.map(msg => {
            const fullContent = msg.content
            
            // Extract display content for user messages with file attachments
            let displayContent = fullContent
            if (msg.role === 'user' && (fullContent.includes('**File:') || fullContent.includes('**Image:'))) {
              // Try to extract the original message text before file content
              const lines = fullContent.split('\n')
              const fileStartIndex = lines.findIndex(line => line.includes('**File:') || line.includes('**Image:'))
              if (fileStartIndex > 0) {
                displayContent = lines.slice(0, fileStartIndex).join('\n').trim()
                
                // Add file summary for display
                const fileLines = lines.slice(fileStartIndex)
                const fileCount = fileLines.filter(line => line.includes('**File:') || line.includes('**Image:')).length
                if (fileCount > 0) {
                  displayContent += displayContent ? `\n\n📎 ${fileCount} file${fileCount > 1 ? 's' : ''} attached` : `📎 ${fileCount} file${fileCount > 1 ? 's' : ''} attached`
                }
              }
            }
            
            return {
              role: msg.role,
              content: displayContent,
              fullContent: fullContent, // Store full content for AI context
              timestamp: msg.created_at ? new Date(msg.created_at) : new Date(msg.timestamp || Date.now()),
              provider: msg.provider,
              model: msg.model,
              userId: msg.user_id,
              userName: msg.user_name,
              userAvatar: msg.user_avatar,
              agent_mode: msg.agent_mode,
              reasoning: msg.reasoning,
              tool_calls_count: msg.tool_calls_count,
              debug_tool_data: msg.debug_tool_data,
              processing_steps: msg.processing_steps || [],
              tokens_used: msg.tokens_used,
              cost: msg.cost,
              response_time: msg.response_time
            }
          })
          
          setMessages(formattedMessages)
          setCurrentSessionId(session.id)
          // Load the custom title from the session
          setCustomTitle(session.title || '')
          setIsHistoryOpen(false)
          // Update Agent Mode to reflect the saved session preference
          if (typeof session.agent_mode !== 'undefined') {
            setForceAgentMode(session.agent_mode)
          }
          // Restore selected agent if saved with session
          if (session.agent_id) {
            setSelectedAgentId(parseInt(session.agent_id))
          } else {
            setSelectedAgentId(null)
          }
          // Restore provider/model override if saved with session
          if (session.override_provider) {
            setOverrideProvider(session.override_provider)
            setOverrideModel(session.override_model || null)
          } else {
            setOverrideProvider(null)
            setOverrideModel(null)
          }
          // Persist last opened session
          saveLastSession(session.id)
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error)
      showError('Failed to load chat session')
    }
  }

  const deleteSession = async (sessionId) => {
    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // If we deleted the current session, clear the chat
          if (currentSessionId === sessionId) {
            clearChat()
          }
          
          // Update the sessions list locally and also refresh from server
          setChatSessions(prevSessions => 
            prevSessions.filter(session => session.id !== sessionId)
          )
          loadChatSessions() // Don't auto-load after deletion
          showSuccess('Chat conversation deleted successfully')
        }
      } else {
        showError('Failed to delete chat conversation')
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
      showError('Failed to delete chat conversation')
    }
  }

  const confirmDeleteSession = (session) => {
    setSessionToDelete(session)
  }

  const handleDeleteConfirm = () => {
    if (sessionToDelete) {
      deleteSession(sessionToDelete.id)
      setSessionToDelete(null)
    }
  }

  const deleteAllSessions = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions/delete-all`, {
        method: 'DELETE',
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Clear all sessions from state
          setChatSessions([])
          // Clear current chat if it was one of the deleted sessions
          clearChat()
          showSuccess(`Successfully deleted ${data.deleted_count || 'all'} chat conversations`)
        } else {
          showError('Failed to delete all conversations: ' + (data.message || 'Unknown error'))
        }
      } else {
        showError('Failed to delete all conversations')
      }
    } catch (error) {
      console.error('Failed to delete all sessions:', error)
      showError('Failed to delete all conversations')
    }
  }

  const confirmDeleteAllSessions = () => {
    setShowDeleteAllConfirm(true)
  }

  const handleDeleteAllConfirm = () => {
    deleteAllSessions()
    setShowDeleteAllConfirm(false)
  }

  const getChatTitle = () => {
    // Use custom title if set and we have a session
    if (customTitle.trim() && currentSessionId) {
      return customTitle
    }
    // Find the first user message to use as title
    const firstUserMessage = messages.find(msg => msg.role === 'user')
    if (firstUserMessage) {
      // Truncate long messages and create a title
      const title = firstUserMessage.content.length > 50
        ? firstUserMessage.content.substring(0, 50) + '...'
        : firstUserMessage.content
      return title
    }
    return 'New Conversation'
  }

  const startEditingTitle = () => {
    if (!currentSessionId) {
      showError('Please start a conversation before editing the title')
      return
    }
    setCustomTitle(getChatTitle())
    setIsEditingTitle(true)
  }

  const saveTitle = async () => {
    setIsEditingTitle(false)
    
    if (customTitle.trim() === '') {
      // Reset to auto-generated title if empty
      setCustomTitle('')
      return
    }
    
    // Save title to database if we have a session ID
    if (currentSessionId) {
      try {
        const response = await fetch(`${adminData.restUrl}chat-sessions/${currentSessionId}/title`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
          body: JSON.stringify({
            title: customTitle.trim()
          })
        })
        
        const data = await response.json()
        
        if (data.success) {
          showSuccess('Chat title updated successfully!')
          
          // Update the chat sessions list to reflect the new title
          setChatSessions(prevSessions => 
            prevSessions.map(session => 
              session.id === currentSessionId 
                ? { ...session, title: customTitle.trim() }
                : session
            )
          )
        } else {
          showError('Failed to update chat title: ' + (data.message || 'Unknown error'))
          // Revert title on error
          setCustomTitle('')
        }
      } catch (error) {
        console.error('Failed to update chat title:', error)
        showError('Failed to update chat title')
        // Revert title on error
        setCustomTitle('')
      }
    }
  }

  const cancelEditTitle = () => {
    setIsEditingTitle(false)
    setCustomTitle(customTitle) // Revert to previous value
  }

  const handleTitleKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveTitle()
    } else if (e.key === 'Escape') {
      cancelEditTitle()
    }
  }

  const startEditingMessage = (index, content) => {
    setEditingMessageIndex(index)
    setEditingMessageContent(content)
  }

  const cancelEditingMessage = () => {
    setEditingMessageIndex(null)
    setEditingMessageContent('')
  }

  const saveEditedMessage = async () => {
    if (editingMessageIndex === null || !editingMessageContent.trim()) {
      cancelEditingMessage()
      return
    }

    // Update the message content
    const updatedMessages = [...messages]
    updatedMessages[editingMessageIndex].content = editingMessageContent.trim()
    // Also update fullContent to match the edited content
    updatedMessages[editingMessageIndex].fullContent = editingMessageContent.trim()
    
    // Ensure user info is preserved for user messages
    if (updatedMessages[editingMessageIndex].role === 'user') {
      updatedMessages[editingMessageIndex].userId = updatedMessages[editingMessageIndex].userId || adminData?.currentUser?.id
      updatedMessages[editingMessageIndex].userName = updatedMessages[editingMessageIndex].userName || adminData?.currentUser?.name
      updatedMessages[editingMessageIndex].userAvatar = updatedMessages[editingMessageIndex].userAvatar || adminData?.currentUser?.avatar
    }
    
    // Remove all messages after the edited one (restart conversation from this point)
    const messagesUpToEdit = updatedMessages.slice(0, editingMessageIndex + 1)
    
    setMessages(messagesUpToEdit)
    setEditingMessageIndex(null)
    setEditingMessageContent('')
    setIsLoading(true)

    // Send the edited message to get a new AI response
    try {
      // Get current post information from adminData
      const currentPost = adminData?.currentPost || {}
      
      // Build context information for the AI
      let pageContext = {
        url: typeof window !== 'undefined' ? window.location.href : '',
        post_id: currentPost.id || null,
        post_type: currentPost.type || null,
        post_title: currentPost.title || '',
        context: currentPost.context || 'unknown',
        ...(isBricksMode ? {
          bricks_framework: selectedFramework,
          text_replacement_enabled: textReplacementEnabled,
          image_replacement_enabled: imageReplacementEnabled
        } : {})
      }

      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
          'X-Web-Search-Enabled': webSearchEnabled ? 'true' : 'false',
        },
        body: JSON.stringify({
          message: editingMessageContent.trim(),
          history: sanitizeMessageHistory(messagesUpToEdit),
          agent_mode: isBricksMode ? 'bricks' : forceAgentMode, // Set 'bricks' for Bricks mode, otherwise use forceAgentMode
          session_id: currentSessionId,
          is_message_edit: true,
          truncate_at_message: editingMessageIndex,
          page_url: pageContext.url,
          page_context: pageContext,
          web_search_enabled: webSearchEnabled,
          agent_id: selectedAgentId,
          ...(isBricksMode && siteContextEnabled ? {
            site_context_enabled: true,
            site_context_pages: selectedSiteContextPages,
            site_meta_title: siteMetaTitle,
            site_meta_description: siteMetaDescription
          } : {}),
          ...(isBricksMode ? {
            text_replacement_enabled: textReplacementEnabled,
            image_replacement_enabled: imageReplacementEnabled
          } : {}),
          ...(overrideProvider ? {
            override_provider: overrideProvider,
            override_model: overrideModel
          } : {})
        })
      })

      const data = await response.json()

      if (data.success) {
        // Handle response based on mode
        let chatContent, extractedHtml, extractedCss, extractedJs, parsedBricksStructure, globalClasses, components;

        if (isBricksMode) {
          // First, check if we have a component from the component library (via MCP tools)
          components = extractBricksComponentFromToolData(data.debug_tool_data);
          
          if (components && components.length > 0) {
            // Combine all components for storage, but keep track of individual components
            const allElements = [];
            const allGlobalClasses = [];
            
            components.forEach((comp) => {
              allElements.push(...comp.bricksJson);
              allGlobalClasses.push(...(comp.globalClasses || []));
            });
            
            parsedBricksStructure = allElements;
            globalClasses = allGlobalClasses;
            
            // Update chat content to reflect component usage
            if (components.length === 1) {
              const comp = components[0];
              chatContent = data.response || `✅ **Component Ready: "${comp.name}"**\n\nThis component is ready to insert into your Bricks canvas. Click the "Insert into Bricks" button below!`;
              if (comp.category) {
                chatContent += `\n\n**Component Details:**\n- Category: ${comp.category}\n- ${comp.bricksJson.length} Bricks elements\n- ${comp.globalClasses.length} CSS classes`;
              }
            } else {
              chatContent = data.response || `✅ **${components.length} Components Ready**\n\nAll components are ready to insert into your Bricks canvas. Click the "Insert into Bricks" button below to insert all components at once!`;
              chatContent += `\n\n**Components:**\n${components.map((comp, idx) => {
                return `${idx + 1}. ${comp.name} (${comp.category || 'other'}) - ${comp.bricksJson.length} elements, ${comp.globalClasses.length} classes`;
              }).join('\n')}`;
            }
            
            extractedHtml = '';
            extractedCss = '';
            extractedJs = '';
          } else {
            // Fallback: Bricks mode response includes converted HTML/CSS/JS (legacy flow)
            const responseContent = data.response;
            chatContent = getTextFromResponse(responseContent);
            const parts = getPartsFromResponse(responseContent);
            extractedHtml = parts.html;
            extractedCss = parts.css;
            extractedJs = parts.js;

            // Parse HTML into Bricks structure if we have HTML
            if (extractedHtml) {
              try {
                // Generate IDs for root and parent
                const rootId = generateId();
                const parentId = 0; // Root level insertion
                
                // Get default parser states
                const parserStates = getDefaultParserStates();
                
                // Initialize global classes array (will be populated by parser)
                globalClasses = [];
                
                // Parse HTML into Bricks elements array
                const cmValues = {
                  html: extractedHtml,
                  css: extractedCss,
                  js: extractedJs
                };
                
                parsedBricksStructure = parseHtmlStringToObjectArray(
                  rootId,
                  parentId,
                  cmValues,
                  parserStates,
                  globalClasses
                );
                
                // Add success message with stats
                chatContent += `\n\n**Structure Generated:**\n- ${parsedBricksStructure.length} Bricks elements\n- ${globalClasses.length} CSS classes\n- ${extractedCss ? 'Includes CSS styling' : 'No CSS'}\n- ${extractedJs ? 'Includes JavaScript' : 'No JavaScript'}`;
              } catch (parseError) {
                console.error('❌ Error parsing HTML:', parseError);
                chatContent += '\n\n⚠️ Warning: HTML was generated but could not be parsed into Bricks structure. You can still use the raw HTML/CSS.';
                parsedBricksStructure = null;
                globalClasses = [];
              }
            }
          }
        } else {
          // Regular chat mode
          const responseContent = data.response;
          chatContent = getTextFromResponse(responseContent);
          const parts = getPartsFromResponse(responseContent);
          extractedHtml = parts.html;
          extractedCss = parts.css;
          extractedJs = parts.js;
        }

        const assistantMessage = {
          role: 'assistant',
          content: chatContent,
          timestamp: new Date(),
          provider: data.provider,
          agent_mode: isBricksMode ? 'bricks' : (data.agent_mode || forceAgentMode),
          tool_calls_count: data.tool_calls_count || 0,
          debug_tool_data: data.debug_tool_data || [],
          tokens_used: data.tokens_used,
          cost: data.cost,
          response_time: data.response_time,
          isError: false,
          html: extractedHtml,
          css: extractedCss,
          js: extractedJs,
          bricks_structure: isBricksMode ? parsedBricksStructure : undefined,
          globalClasses: isBricksMode ? globalClasses : undefined,
          components: isBricksMode && components.length > 0 ? components : undefined // Store components with thumbnails
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Provide parsed Bricks structure back to parent (e.g., Bricks builder) if present
        if (onAiResponseUpdate && isBricksMode && parsedBricksStructure) {
          onAiResponseUpdate({
            html: extractedHtml,
            css: extractedCss,
            js: extractedJs,
            bricks_structure: parsedBricksStructure,
            globalClasses: globalClasses
          });
        } else if (onAiResponseUpdate && extractedHtml) {
          // Fallback for non-Bricks mode or if parsing failed
          onAiResponseUpdate({
            html: extractedHtml,
            css: extractedCss,
            js: extractedJs
          });
        }
      } else {
        const errorMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${data.message || 'Unknown error'}`,
          timestamp: new Date(),
          isError: true
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting. Please try again.',
        timestamp: new Date(),
        isError: true
      }
      setMessages(prev => [...prev, errorMessage])
    }

    setIsLoading(false)
  }

  const handleEditMessageKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      saveEditedMessage()
    } else if (e.key === 'Escape') {
      cancelEditingMessage()
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showSuccess('Message copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy text: ', err)
      showError('Failed to copy message')
    }
  }

  const toggleDebugData = (messageIndex) => {
    setShowingDebugData(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }))
  }

  const toggleChainOfThought = (messageIndex) => {
    setShowingChainOfThought(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }))
  }

  const formatConversationForSharing = () => {
    const chatTitle = getChatTitle()
    
    // Filter out system messages, welcome messages, and get the actual conversation
    const shareableMessages = messages.filter(msg => 
      msg.role !== 'system' && !msg.isWelcomeMessage
    )
    
    if (shareableMessages.length === 0) {
      return `# ${chatTitle}\n\n*No conversation to share yet.*`
    }
    
    // Get the date from the first actual message, not the current date
    const firstMessageDate = shareableMessages[0]?.timestamp || new Date()
    const conversationDate = firstMessageDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    let formattedText = `# ${chatTitle}\n\n`
    formattedText += `*Conversation from ${conversationDate}*\n\n`
    formattedText += `---\n\n`
    
    shareableMessages.forEach((message, index) => {
      // Use the actual timestamp from when the message was created
      const timestamp = message.timestamp.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      
      const messageDate = message.timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
      
      if (message.role === 'user') {
        const userName = message.userName || adminData?.currentUser?.name || 'User'
        formattedText += `**👤 ${userName}** *${messageDate} at ${timestamp}*\n\n`
        formattedText += `${message.content}\n\n`
      } else if (message.role === 'assistant') {
        formattedText += `**🤖 AI Assistant** *${messageDate} at ${timestamp}*`
        if (message.agent_mode) {
          formattedText += ` • Agent Mode`
        }
        if (message.provider) {
          formattedText += ` • ${message.provider}`
        }
        formattedText += `\n\n`
        formattedText += `${message.content}\n\n`
      }
      
      // Add separator between messages except for the last one
      if (index < shareableMessages.length - 1) {
        formattedText += `---\n\n`
      }
    })
    
    formattedText += `\n*Generated by MagicAssistant - AI-Powered WordPress Assistant*`
    
    return formattedText
  }

  const copyConversationToClipboard = async () => {
    try {
      const formattedConversation = formatConversationForSharing()
      await navigator.clipboard.writeText(formattedConversation)
      showSuccess('Conversation copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy conversation: ', err)
      showError('Failed to copy conversation')
    }
  }

  const openShareModal = () => {
    const shareableMessages = messages.filter(msg => 
      msg.role !== 'system' && !msg.isWelcomeMessage
    )
    
    if (shareableMessages.length === 0) {
      showError('Start a conversation before sharing')
      return
    }
    
    // Reset share modal state
    setShareAsPermanent(false)
    setShareExpiry(30)
    setIsCreatingShare(false)
    setIsShareModalOpen(true)
  }

  const createPermanentShare = async () => {
    if (isCreatingShare) return
    
    setIsCreatingShare(true)
    
    try {
      const formattedText = formatConversationForSharing()
      const title = getChatTitle()
      
      const response = await fetch(`${adminData.restUrl}shared-conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          title: title,
          session_id: currentSessionId,
          formatted_content: formattedText,
          expires_in_days: shareExpiry > 0 ? shareExpiry : 0
        })
      })

      const data = await response.json()

      if (data.success) {
        showSuccess(`Conversation shared! URL: ${data.share_url}`)
        
        // Copy URL to clipboard automatically
        try {
          await navigator.clipboard.writeText(data.share_url)
          showSuccess('Share URL copied to clipboard!')
        } catch (err) {
          console.error('Failed to copy URL:', err)
        }
        
        setIsShareModalOpen(false)
      } else {
        showError('Failed to create permanent share: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error creating permanent share:', error)
      showError('Failed to create permanent share')
    }
    
    setIsCreatingShare(false)
  }

  const insertMessageHtml = (msg) => {
    // Extract content from wrapped structure (new format) or use array directly (backwards compatibility)
    const bricksContent = msg.bricks_structure?.content || msg.bricks_structure;
    // Try multiple extraction paths: direct globalClasses field, nested in bricks_structure, or fallback
    const globalClasses = msg.globalClasses || msg.bricks_structure?.globalClasses || [];

    // Prefer using the pre-converted bricks_structure (avoids creating global classes)
    if (typeof window.magicAssistantInsertStructure === 'function' && bricksContent) {
      window.magicAssistantInsertStructure(bricksContent, globalClasses);
    } else {
      // Fallback to HTML parsing
      const html = msg.html || (typeof msg.content === 'string' && msg.content.includes('<') ? msg.content : '');
      if (typeof window.magicAssistantInsertHTML === 'function' && html) {
        console.warn('Using fallback HTML parser. Bricks structure not available.');
        window.magicAssistantInsertHTML(html, msg.css || '', msg.js || '');
      } else if (!html) {
        alert('No HTML found in this message.');
      } else {
        alert('MagicAssistant Bricks integration not found! Make sure you are in Bricks Builder.');
      }
    }
  };

  const extractTitleFromUnsplashUrl = (url) => {
    if (!url || !url.includes('images.unsplash.com')) return ''
    
    try {
      // Try to extract meaningful info from URL structure
      // Example: https://images.unsplash.com/photo-1234567890123-abcdef123456?...
      const urlParts = url.split('/')
      const photoId = urlParts[urlParts.length - 1]?.split('?')[0]
      
      if (photoId && photoId.startsWith('photo-')) {
        // Extract the date and hash from photo ID for a basic title
        const idParts = photoId.replace('photo-', '').split('-')
        if (idParts.length >= 2) {
          return `Unsplash Photo ${idParts[0]}`
        }
      }
      
      return 'Unsplash Image'
    } catch (error) {
      return 'Unsplash Image'
    }
  }

  const findUnsplashImageData = (imageUrl) => {
    // Search through all messages for debug_tool_data containing unsplash_search_images or unsplash_get_random_images
    for (const message of messages) {
      if (message.debug_tool_data && Array.isArray(message.debug_tool_data)) {
        for (const toolData of message.debug_tool_data) {
          if ((toolData.tool === 'unsplash_search_images' || toolData.tool === 'unsplash_get_random_images') && toolData.success && toolData.result) {
            const images = Array.isArray(toolData.result) ? toolData.result : []
            // Find the image that matches the URL (compare url_small, url_full, or url_regular)
            const matchingImage = images.find(img => {
              // Check all possible URL variations to ensure we find the correct image
              return img.url_small === imageUrl || 
                     img.url_full === imageUrl || 
                     img.url_regular === imageUrl ||
                     // Also check for URL with different query parameters
                     (img.url_small && img.url_small.split('?')[0] === imageUrl.split('?')[0]) ||
                     (img.url_full && img.url_full.split('?')[0] === imageUrl.split('?')[0]) ||
                     (img.url_regular && img.url_regular.split('?')[0] === imageUrl.split('?')[0])
            })
            if (matchingImage) {
              return matchingImage
            }
          }
        }
      }
    }
    
    // Log when no match is found for debugging
    console.warn('No Unsplash image data found for URL:', imageUrl)
    return null
  }

  const saveUnsplashImage = async (imgUrl, downloadLoc = '', altText = '', unsplashId = '', photographer = '') => {
    try {
      const resp = await fetch(`${adminData.restUrl}unsplash-save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          image_url: imgUrl,
          download_location: downloadLoc,
          alt: altText,
          title: altText || 'Unsplash Image',
          unsplash_id: unsplashId,
          photographer,
        }),
      })
      const data = await resp.json()
      if (data.success) {
        showSuccess('Image saved to media library!')
      } else {
        showError(data.message || 'Failed to save image')
      }
    } catch (err) {
      console.error('Save image error', err)
      showError('Failed to save image')
    }
  }

  const saveAsFeaturedImage = async (imgUrl, downloadLoc = '', altText = '', unsplashId = '', photographer = '', postId = null) => {
    // If no postId provided, show post selector
    if (!postId) {
      // Get current post info from adminData
      const currentPost = adminData?.currentPost || {}
      const currentPostId = currentPost.id
      
      if (!currentPostId) {
        // No current post, show post selector
        setPendingFeaturedImage({
          imgUrl,
          downloadLoc,
          altText,
          unsplashId,
          photographer
        })
        await fetchAvailablePosts()
        setShowPostSelector(true)
        return
      }
      
      postId = currentPostId
    }
    
    try {
      const resp = await fetch(`${adminData.restUrl}save-as-featured-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          image_url: imgUrl,
          download_location: downloadLoc,
          alt: altText,
          title: altText || 'AI Generated Image',
          unsplash_id: unsplashId,
          photographer,
          post_id: postId
        }),
      })
      const data = await resp.json()
      if (data.success) {
        showSuccess(data.message || 'Image set as featured image!')
      } else {
        showError(data.message || 'Failed to set featured image')
      }
    } catch (err) {
      console.error('Save as featured image error', err)
      showError('Failed to set featured image')
    }
  }

  // File handling functions
  const handleFileUpload = (files) => {
    const newFiles = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
      content: null, // Will be populated when read
      isImage: file.type.startsWith('image/'),
      dataUrl: null // For images
    }))
    
    // Process files based on type
    newFiles.forEach(fileObj => {
      if (fileObj.isImage) {
        // For images, create data URL for preview and send as base64
        const reader = new FileReader()
        reader.onload = (e) => {
          fileObj.dataUrl = e.target.result
          fileObj.content = e.target.result // base64 data URL
          setAttachedFiles(prev => [...prev.filter(f => f.id !== fileObj.id), fileObj])
        }
        reader.readAsDataURL(fileObj.file)
      } else if (fileObj.type.startsWith('text/') || 
          fileObj.name.endsWith('.txt') || 
          fileObj.name.endsWith('.md') || 
          fileObj.name.endsWith('.json') ||
          fileObj.name.endsWith('.js') ||
          fileObj.name.endsWith('.css') ||
          fileObj.name.endsWith('.html') ||
          fileObj.name.endsWith('.php') ||
          fileObj.name.endsWith('.py') ||
          fileObj.name.endsWith('.xml') ||
          fileObj.name.endsWith('.csv')) {
        // For text files, read as text
        const reader = new FileReader()
        reader.onload = (e) => {
          fileObj.content = e.target.result
          setAttachedFiles(prev => [...prev.filter(f => f.id !== fileObj.id), fileObj])
        }
        reader.readAsText(fileObj.file)
      }
    })
    
    setAttachedFiles(prev => [...prev, ...newFiles])
  }

  const removeAttachedFile = (fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const createCustomFile = () => {
    if (!customFileContent.trim() || !customFileName.trim()) {
      showError('Please provide both file name and content')
      return
    }

    const fileExtension = customFileType === 'txt' ? '.txt' : `.${customFileType}`
    const fileName = customFileName.endsWith(fileExtension) ? customFileName : `${customFileName}${fileExtension}`
    
    const customFile = {
      id: Date.now() + Math.random(),
      name: fileName,
      size: new Blob([customFileContent]).size,
      type: `text/${customFileType}`,
      file: new File([customFileContent], fileName, { type: `text/${customFileType}` }),
      content: customFileContent,
      isCustomCreated: true,
      isImage: false,
      dataUrl: null
    }

    setAttachedFiles(prev => [...prev, customFile])
    setCustomFileContent('')
    setCustomFileName('')
    setIsFileModalOpen(false)
    showSuccess('Custom file created and attached!')
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const saveCustomSystemMessage = () => {
    localStorage.setItem('magicassistant_custom_system_message', customSystemMessage)
    localStorage.setItem('magicassistant_enable_custom_system', enableCustomSystem)
    showSuccess('Custom system message saved!')
  }

  const clearCustomSystemMessage = () => {
    setCustomSystemMessage('')
    setEnableCustomSystem(false)
    localStorage.removeItem('magicassistant_custom_system_message')
    localStorage.removeItem('magicassistant_enable_custom_system')
    showSuccess('Custom system message cleared!')
  }

  const saveFilePersistenceSetting = () => {
    localStorage.setItem('magicassistant_persist_files', persistFiles)
    showSuccess('File persistence setting saved!')
  }

  const saveAgentSelection = async () => {
    if (!currentSessionId) {
      showError('Please start a conversation before selecting an agent')
      return
    }
    
    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions/${currentSessionId}/agent`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          agent_id: selectedAgentId
        })
      })
      
      const data = await response.json()
      if (data.success) {
        showSuccess('AI Agent selection saved!')
        // Update chat sessions to reflect agent selection
        setChatSessions(prevSessions => 
          prevSessions.map(session => 
            session.id === currentSessionId 
              ? { ...session, agent_id: selectedAgentId }
              : session
          )
        )
      } else {
        showError(data.message || 'Failed to save agent selection')
      }
    } catch (error) {
      console.error('Failed to save agent selection:', error)
      showError('Failed to save agent selection')
    }
  }

  const saveProviderOverride = async () => {
    if (!currentSessionId) {
      showError('Please start a conversation before setting a model override')
      return
    }

    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions/${currentSessionId}/provider`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          provider: overrideProvider || null,
          model: overrideModel || null
        })
      })

      const data = await response.json()
      if (data.success) {
        showSuccess(overrideProvider ? `Switched to ${aiProviderOptions.find(p => p.value === overrideProvider)?.label || overrideProvider}` : 'Using global default settings')
        // Update chat sessions to reflect provider override
        setChatSessions(prevSessions =>
          prevSessions.map(session =>
            session.id === currentSessionId
              ? { ...session, override_provider: overrideProvider, override_model: overrideModel }
              : session
          )
        )
      } else {
        showError(data.message || 'Failed to save model override')
      }
    } catch (error) {
      console.error('Failed to save provider override:', error)
      showError('Failed to save model override')
    }
  }

  const clearProviderOverride = async () => {
    setOverrideProvider(null)
    setOverrideModel(null)
    if (currentSessionId) {
      try {
        await fetch(`${adminData.restUrl}chat-sessions/${currentSessionId}/provider`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': adminData.nonces.wp_rest,
          },
          body: JSON.stringify({ provider: null, model: null })
        })
        showSuccess('Using global default settings')
        setChatSessions(prevSessions =>
          prevSessions.map(session =>
            session.id === currentSessionId
              ? { ...session, override_provider: null, override_model: null }
              : session
          )
        )
      } catch (error) {
        console.error('Failed to clear provider override:', error)
      }
    }
  }

  // If in Content Mode, render that instead
  if (isContentMode && !isDrawerMode) {
    return <ContentMode adminData={adminData} onExitContentMode={() => setIsContentMode(false)} />
  }

  return (
    
    <div className={`h-[calc(100vh-7.4rem)] mx-auto flex flex-col ${isDrawerMode ? 'h-full' : ''}`}>
      {/* Header - new layout */}
      {!isDrawerMode && (
        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <Button size="sm" color="gray" onClick={() => setIsSettingsOpen(true)}>Settings</Button>
            <Button size="sm" color="gray" onClick={() => setIsHistoryOpen(true)}>History</Button>
            <Button size="sm" color="gray" onClick={openShareModal} disabled={messages.filter(msg => msg.role !== 'system' && !msg.isWelcomeMessage).length === 0}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share
            </Button>
          </div>
          
          {/* Chat Title */}
          <div className="flex-1 px-4">
            {isEditingTitle && currentSessionId ? (
              <div className="flex items-center justify-center space-x-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={saveTitle}
                  autoFocus
                  className="text-lg font-semibold text-gray-900 dark:text-white text-center bg-transparent border-b-2 border-blue-500 dark:border-blue-400 focus:outline-none focus:border-blue-600 dark:focus:border-blue-300 min-w-0 flex-1 max-w-md"
                  placeholder="Enter chat title..."
                />
                <button
                  onClick={saveTitle}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={cancelEditTitle}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <h1 
                className={`text-lg font-semibold text-gray-900 dark:text-white text-center truncate transition-colors ${
                  currentSessionId ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''
                }`}
                onClick={currentSessionId ? startEditingTitle : undefined}
                title={currentSessionId ? "Click to edit title" : "Start a conversation to edit title"}
              >
                {getChatTitle()}
              </h1>
            )}
          </div>
          
            <div className="flex items-center space-x-2 shrink-0">
              {creditsInfo && formatLimitDisplay(creditsInfo) && (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {formatLimitDisplay(creditsInfo)}
                </span>
              )}
              <CustomSelect
                value={chatModeOptions.find(option => option.value === getCurrentChatMode())}
                onChange={handleChatModeChange}
                options={chatModeOptions}
                isDisabled={isBricksMode}
                darkMode={isDarkMode}
                size="compact"
              />
              <Button size="sm" onClick={startNewChat}>New chat</Button>
            </div>
        </div>
      )}

      {/* Drawer mode compact header */}
      {isDrawerMode && (
        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
          <div className="flex-1 min-w-0">
            {isEditingTitle && currentSessionId ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={handleTitleKeyPress}
                  onBlur={saveTitle}
                  autoFocus
                  className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-blue-500 dark:border-blue-400 focus:outline-none focus:border-blue-600 dark:focus:border-blue-300 min-w-0 flex-1"
                  placeholder="Enter chat title..."
                />
                <button
                  onClick={saveTitle}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={cancelEditTitle}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <h3 
                className={`text-sm font-medium text-gray-900 dark:text-white truncate transition-colors ${
                  currentSessionId ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400' : ''
                }`}
                onClick={currentSessionId ? startEditingTitle : undefined}
                title={currentSessionId ? "Click to edit title" : "Start a conversation to edit title"}
              >
                {getChatTitle()}
              </h3>
            )}
          </div>
          
          <div className="flex items-center space-x-1 ml-2">
            {creditsInfo && formatLimitDisplay(creditsInfo) && (
              <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-24">
                {formatLimitDisplay(creditsInfo)}
              </span>
            )}
            <CustomSelect
              value={chatModeOptions.find(option => option.value === getCurrentChatMode())}
              onChange={handleChatModeChange}
              options={chatModeOptions}
              isDisabled={isBricksMode}
              darkMode={isDarkMode}
              size="compact"
            />
            <Button size="xs" onClick={startNewChat}>New</Button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={`overflow-y-auto ${
        isDrawerMode 
          ? 'h-[calc(100%-190px)]' 
          : 'h-[calc(100vh-18.7rem)] sm:h-[calc(100vh-15.4rem)]'
      }`}>
        <div className="max-w-6xl mx-auto py-3 lg:py-3 space-y-3 px-3 lg:px-3">
          {messages.map((message, index) => (
            <div
              key={index}
              data-message-index={index}
              className={`p-3 shadow-xs rounded-lg flex flex-col items-start gap-4 group relative pe-14 ${
                message.role === 'user'
                  ? 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  : message.isError
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30'
                    : 'bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30'
              }`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {message.role === 'user' ? (
                  <img
                    src={message.userAvatar || adminData?.currentUser?.avatar || `https://www.gravatar.com/avatar/default?s=24&d=mp`}
                    alt={message.userName || adminData?.currentUser?.name || 'User'}
                    className="h-6 w-6 rounded-full border border-gray-200 dark:border-gray-600"
                    title={message.userName || adminData?.currentUser?.name || 'User'}
                    onError={(e) => {
                      e.target.src = `https://www.gravatar.com/avatar/default?s=24&d=mp`
                    }}
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                    AI
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="format dark:format-invert format-blue flex-1 text-gray-900 dark:text-gray-100 overflow-x-auto text-sm leading-[normal]">
                {editingMessageIndex === index ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingMessageContent}
                      onChange={(e) => setEditingMessageContent(e.target.value)}
                      onKeyDown={handleEditMessageKeyPress}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows="3"
                      autoFocus
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={saveEditedMessage}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        Save & Continue
                      </button>
                      <button
                        onClick={cancelEditingMessage}
                        className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Component Thumbnails */}
                    {message.components && message.components.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-3">
                        {message.components.map((comp, compIdx) => (
                          comp.thumbnail && (
                            <div key={compIdx} className="relative group">
                              <img
                                src={comp.thumbnail}
                                alt={comp.name || 'Component preview'}
                                className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                title={comp.name}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
                                {comp.name}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    <div className={`${message.isError ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'} ${message.isStreaming ? 'opacity-60 italic' : ''}`}>
                      {formatMessage(message.content)}
                    </div>
                  </>
                )}
                
                {/* Chain of Thought */}
                {showingChainOfThought[index] && message.processing_steps && message.processing_steps.length > 0 && (
                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">🧠 Chain of Thought</span>
                      <span className="text-xs text-purple-500 dark:text-purple-400">({message.processing_steps.length} steps)</span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {message.processing_steps.map((step, stepIndex) => {
                        const timestamp = new Date(step.timestamp * 1000);
                        const timeString = timestamp.toLocaleTimeString();
                        return (
                          <div key={stepIndex} className="flex items-start gap-3 p-2 bg-white/50 dark:bg-gray-800/50 rounded border-l-2 border-purple-300 dark:border-purple-600">
                            <span className="text-xs text-purple-600 dark:text-purple-400 font-mono min-w-[60px]">
                              {stepIndex + 1}.
                            </span>
                            <div className="flex-1">
                              <div className="text-sm text-purple-800 dark:text-purple-200">
                                {step.message}
                              </div>
                              <div className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                                {timeString}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Debug Tool Data */}
                {showingDebugData[index] && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    {message.debug_tool_data && message.debug_tool_data.length > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔧 Raw Tool Data</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">({message.debug_tool_data.length} tools)</span>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {message.debug_tool_data.map((toolData, toolIndex) => (
                            <div key={toolIndex} className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  toolData.success 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {toolData.success ? '✅' : '❌'} {toolData.tool}
                                </span>
                                {toolData.execution_time && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {toolData.execution_time}ms
                                  </span>
                                )}
                              </div>
                              <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto break-all whitespace-pre-wrap text-gray-800 dark:text-gray-200 font-mono">
                                {JSON.stringify(toolData.success ? toolData.result : toolData.error, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">🔧 Debug Information</span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div><strong>Role:</strong> {message.role}</div>
                          <div><strong>Provider:</strong> {message.provider || 'N/A'}</div>
                          <div><strong>Agent Mode:</strong> {message.agent_mode ? 'Yes' : 'No'}</div>
                          <div><strong>Tool Calls:</strong> {message.tool_calls_count || 0}</div>
                          <div><strong>Timestamp:</strong> {message.timestamp.toISOString()}</div>
                          <div><strong>Tokens Used:</strong> {message.tokens_used || 'N/A'}</div>
                          <div><strong>Cost:</strong> {message.cost ? `$${message.cost.toFixed(6)}` : 'N/A'}</div>
                          {message.response_time && <div><strong>Response Time:</strong> {(message.response_time * 1000).toFixed(0)}ms</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Meta information */}
                <div className="text-xs mt-3 text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                  <span>{message.timestamp.toLocaleDateString()} {message.timestamp.toLocaleTimeString()}</span>
                  {message.role === 'user' && message.userName && (
                    <>
                      <span>•</span>
                      <span>{message.userName}</span>
                    </>
                  )}
                  {message.role === 'user' && editingMessageIndex !== index && (
                    <button
                      type="button"
                      onClick={() => startEditingMessage(index, message.content)}
                      className="inline-flex cursor-pointer justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white transition-colors ml-1"
                      title="Edit message"
                    >
                      <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path d="m14.304 4.844 2.852 2.852M7 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4.5m2.409-9.91a2.017 2.017 0 0 1 0 2.853l-6.844 6.844L8 14l.713-3.565 6.844-6.844a2.015 2.015 0 0 1 2.852 0Z"/>
                      </svg>
                      <span className="sr-only">Edit message</span>
                    </button>
                  )}
                  {message.provider && (
                    <>
                      <span>•</span>
                      <span>{message.provider}</span>
                    </>
                  )}
                  {message.role === 'assistant' && isBricksMode && message.bricks_structure && Array.isArray(message.bricks_structure) && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!isBricksBuilder()) {
                            alert('Not in Bricks Builder! Please open this in the Bricks editor.');
                            return;
                          }
                          
                          // Extract all components from debug_tool_data to handle multiple components
                          let components = [];
                          if (message.debug_tool_data && Array.isArray(message.debug_tool_data)) {
                            components = extractBricksComponentFromToolData(message.debug_tool_data);
                          }
                          
                          if (components && components.length > 0) {
                            // Insert each component separately, one after another
                            let allSuccess = true;
                            for (let i = 0; i < components.length; i++) {
                              const comp = components[i];
                              
                              // Small delay between insertions to ensure proper sequencing
                              if (i > 0) {
                                await new Promise(resolve => setTimeout(resolve, 300));
                              }
                              
                              const success = insertBricksStructure(comp.bricksJson, comp.globalClasses || []);
                              if (!success) {
                                console.error(`❌ Failed to insert component ${i + 1}: ${comp.name}`);
                                allSuccess = false;
                                // Continue with other components even if one fails
                              }
                            }
                            
                            if (!allSuccess) {
                              console.error('Some components failed to insert. Check console for details.');
                            }
                          } else {
                            // Fallback: Insert combined structure (backwards compatibility)
                            const globalClasses = message.globalClasses || [];
                            const success = insertBricksStructure(message.bricks_structure, globalClasses);
                            if (!success) {
                              alert('Failed to insert structure. Check console for details.');
                            }
                          }
                        }}
                        className="inline-flex items-center gap-1 cursor-pointer justify-center rounded px-2 py-1 text-white bg-green-600 hover:bg-green-700 transition-colors ml-1 text-xs font-medium"
                        title="Insert component(s) into Bricks canvas"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Insert into Bricks
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Include both bricks_structure and globalClasses for complete paste functionality
                          const jsonData = {
                            content: message.bricks_structure || [],
                            globalClasses: message.globalClasses || [],
                            source: 'bricksCopiedElements',
                            sourceUrl: typeof window !== 'undefined' ? window.location.href : '',
                            version: '1.9.9'
                          };
                          const json = JSON.stringify(jsonData, null, 2);
                          navigator.clipboard.writeText(json).catch(err => {
                            console.error('Failed to copy:', err);
                          });
                        }}
                        className="inline-flex items-center gap-1 cursor-pointer justify-center rounded px-2 py-1 text-white bg-blue-600 hover:bg-blue-700 transition-colors ml-1 text-xs font-medium"
                        title="Copy Bricks JSON structure with global classes to clipboard"
                      >
                        📋 Copy JSON
                      </button>
                    </>
                  )}
                  {message.agent_mode && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                      🤖 Agent Mode
                    </span>
                  )}
                  {message.tool_calls_count > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">
                      {message.tool_calls_count} tools used
                    </span>
                  )}
                  {message.processing_steps && message.processing_steps.length > 0 && message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => toggleChainOfThought(index)}
                      className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800 rounded text-xs transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="View chain of thought - see how AI processed this request"
                    >
                      🧠 {message.processing_steps.length} steps
                    </button>
                  )}
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => toggleDebugData(index)}
                      className={`px-2 py-1 rounded text-xs transition-all cursor-pointer opacity-0 group-hover:opacity-100 ${
                        message.debug_tool_data && message.debug_tool_data.length > 0
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-800'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={message.debug_tool_data && message.debug_tool_data.length > 0 ? "Toggle raw tool data" : "Show debug information"}
                    >
                      🔧 {showingDebugData[index] ? 'Hide' : 'Debug'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading message */}
          {isLoading && (
            <div className="p-6 bg-white dark:bg-gray-800 shadow-xs rounded-lg flex items-start gap-6 border border-gray-200 dark:border-gray-700">
              <div className="h-6 w-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                AI
              </div>
              <div className="format dark:format-invert format-blue flex-1">
                <div className="flex items-center space-x-2">
                  <Spinner size="sm" />
                  <span className="text-gray-600 dark:text-gray-300 text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={`border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 ${
        isDrawerMode ? 'p-3' : 'p-4'
      }`}>
        {!settings?.mcp_enabled ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              Enable MCP in Settings to allow the AI to perform WordPress actions for you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Attached Files Display */}
            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {persistFiles && (
                  <div className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Files will persist throughout chat
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                {attachedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
                    {file.isImage ? (
                      <div className="flex items-center gap-2">
                        {file.dataUrl && (
                          <img 
                            src={file.dataUrl} 
                            alt={file.name}
                            className="w-8 h-8 object-cover rounded border"
                          />
                        )}
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    ) : (
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                    <span className="text-blue-800 dark:text-blue-200">{file.name}</span>
                    {file.isCustomCreated && (
                      <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 px-2 py-0.5 rounded">Custom</span>
                    )}
                    {file.isImage && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded">Image</span>
                    )}
                    <button
                      onClick={() => removeAttachedFile(file.id)}
                      className="text-red-500 hover:text-red-700 ml-1"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
                </div>
              </div>
            )}
            
            {/* Image Generation Options Panel */}
            {imageGenerationMode && (
              <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100">🎨 Image Generation Settings</h4>
                  <span className="text-xs text-purple-600 dark:text-purple-300">Mode Active</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</label>
                    <select
                      value={imageGenProvider}
                      onChange={(e) => {
                        setImageGenProvider(e.target.value)
                        // Reset model when provider changes
                        if (e.target.value === 'openai') setImageGenModel('dall-e-3')
                        else if (e.target.value === 'google') setImageGenModel('gemini-2.5-flash-image')
                      }}
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="google">Google</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                    <select
                      value={imageGenModel}
                      onChange={(e) => setImageGenModel(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {imageGenProvider === 'openai' && (
                        <>
                          <option value="dall-e-3">DALL-E 3</option>
                          <option value="dall-e-2">DALL-E 2</option>
                        </>
                      )}
                      {imageGenProvider === 'google' && (
                        <>
                          <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Nano Banana)</option>
                          <option value="imagen-4.0-fast-generate-001">Imagen 4 (Fast)</option>
                          <option value="imagen-4.0-generate-001">Imagen 4 (Standard)</option>
                          <option value="imagen-4.0-ultra-generate-001">Imagen 4 (Ultra)</option>
                          <option value="imagen-3.0-generate-002">Imagen 3</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Aspect Ratio</label>
                    <select
                      value={imageAspectRatio}
                      onChange={(e) => setImageAspectRatio(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="1024x1024">Square (1:1)</option>
                      <option value="1024x1792">Portrait (9:16)</option>
                      <option value="1792x1024">Landscape (16:9)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Output Format</label>
                    <select
                      value={imageOutputFormat}
                      onChange={(e) => setImageOutputFormat(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                      <option value="webp">WebP</option>
                    </select>
                  </div>
                </div>
                <p className="mt-2 text-xs text-purple-600 dark:text-purple-300">Type your image description below and hit send to generate</p>
              </div>
            )}
            
            <div 
              className={`${
                isDragOver ? 'ring-2 ring-blue-500 ring-opacity-50 rounded-lg' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Textarea
                placeholder={imageGenerationMode ? "Describe the image you want to generate..." : "Ask me anything about your WordPress site..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || isStreaming}
                rows={isDrawerMode ? 2 : 3}
                className={`w-full resize-y text-sm leading-relaxed placeholder-gray-500 dark:placeholder-gray-400 ${isDrawerMode ? 'text-sm' : ''}`}
              />
              
              {/* Button row below textarea */}
              <div className="flex items-center justify-between mt-2">
                {/* File buttons - left side */}
                <div className="flex gap-2">

                  {/* Create Custom File Button */}
                  <Tooltip content="Create custom file" className="z-50">
                    <button
                      onClick={() => setIsFileModalOpen(true)}
                      disabled={isLoading || isStreaming}
                      className="flex items-center justify-center w-8 h-8 bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </Tooltip>
                  
                  {/* File Upload Button */}
                  <Tooltip content="Upload file" className="z-50">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isStreaming}
                      className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                  </Tooltip>
                  
                  {/* Web Search Toggle Button */}
                  <Tooltip content={webSearchEnabled ? "Web search enabled" : "Enable web search"} className="z-50">
                    <button
                      onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                      disabled={isLoading || isStreaming}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                        webSearchEnabled
                          ? 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                      }`}
                    >
                      <svg className={`w-4 h-4 ${
                      webSearchEnabled 
                        ? 'text-blue-600 dark:text-blue-300' 
                        : 'text-gray-600 dark:text-gray-300'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    </button>
                  </Tooltip>
                  
                  {/* Image Generation Button */}
                  <Tooltip content="Generate image with DALL-E" className="z-50">
                    <button
                      onClick={() => setImageGenerationMode(!imageGenerationMode)}
                      disabled={isLoading || isStreaming}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        imageGenerationMode 
                          ? 'bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600' 
                          : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-700 dark:hover:bg-purple-600'
                      }`}
                      title={imageGenerationMode ? "Disable Image Generation" : "Enable Image Generation"}
                    >
                      <svg className={`w-4 h-4 ${imageGenerationMode ? 'text-white' : 'text-purple-600 dark:text-purple-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </Tooltip>

                  {/* Bricks Settings Dropdown (only in Bricks mode) */}
                  {isBricksMode && (
                    <div className="relative">
                      <Tooltip content="Bricks settings" className="z-50">
                        <button
                          onClick={() => setIsBricksSettingsOpen(!isBricksSettingsOpen)}
                          disabled={isLoading || isStreaming}
                          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                            (siteContextEnabled || textReplacementEnabled || imageReplacementEnabled)
                              ? 'bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-500'
                              : 'bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800'
                          }`}
                        >
                          <svg className={`w-4 h-4 ${(siteContextEnabled || textReplacementEnabled || imageReplacementEnabled) ? 'text-white' : 'text-orange-600 dark:text-orange-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                        </button>
                      </Tooltip>

                      {/* Dropdown Menu */}
                      {isBricksSettingsOpen && (
                        <>
                          {/* Backdrop to close dropdown */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsBricksSettingsOpen(false)}
                          />
                          <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Bricks Settings</h4>
                            </div>
                            <div className="p-3 space-y-2">
                              {/* Site Context */}
                              <button
                                onClick={() => {
                                  setIsSiteContextModalOpen(true);
                                  setIsBricksSettingsOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className={`w-8 h-8 flex items-center justify-center rounded-md ${siteContextEnabled ? 'bg-green-500' : 'bg-green-100 dark:bg-green-900'}`}>
                                  <svg className={`w-4 h-4 ${siteContextEnabled ? 'text-white' : 'text-green-600 dark:text-green-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex flex-col flex-1 gap-2">
                                  <div className="font-medium text-gray-900 dark:text-white">Site Context</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {siteContextEnabled ? 'Enabled' : 'Configure site info for AI'}
                                  </div>
                                </div>
                              </button>

                              {/* Text Replacement Toggle */}
                              <button
                                onClick={() => {
                                  const newValue = !textReplacementEnabled;
                                  setTextReplacementEnabled(newValue);
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem('magicassistant_bricks_text_replacement_enabled', newValue.toString());
                                  }
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className={`w-8 h-8 flex items-center justify-center rounded-md ${textReplacementEnabled ? 'bg-purple-500' : 'bg-purple-100 dark:bg-purple-900'}`}>
                                  <svg className={`w-4 h-4 ${textReplacementEnabled ? 'text-white' : 'text-purple-600 dark:text-purple-300'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                  </svg>
                                </div>
                                <div className="flex flex-col flex-1 gap-2">
                                  <div className="font-medium text-gray-900 dark:text-white">Text Replacement</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {textReplacementEnabled ? 'ON - Auto-replace placeholder text' : 'OFF - Keep original text'}
                                  </div>
                                </div>
                                <div className={`w-10 h-5 rounded-full transition-colors ${textReplacementEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                  <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${textReplacementEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </div>
                              </button>

                              {/* Image Replacement Toggle */}
                              <button
                                onClick={() => {
                                  const newValue = !imageReplacementEnabled;
                                  setImageReplacementEnabled(newValue);
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem('magicassistant_bricks_image_replacement_enabled', newValue.toString());
                                  }
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className={`w-8 h-8 flex items-center justify-center rounded-md ${imageReplacementEnabled ? 'bg-teal-500' : 'bg-teal-100 dark:bg-teal-900'}`}>
                                  <svg className={`w-4 h-4 ${imageReplacementEnabled ? 'text-white' : 'text-teal-600 dark:text-teal-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div className="flex flex-col flex-1 gap-2">
                                  <div className="font-medium text-gray-900 dark:text-white">Image Replacement</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {imageReplacementEnabled ? 'ON - Auto-replace placeholder images' : 'OFF - Keep original images'}
                                  </div>
                                </div>
                                <div className={`w-10 h-5 rounded-full transition-colors ${imageReplacementEnabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                                  <div className={`w-4 h-4 mt-0.5 rounded-full bg-white shadow transition-transform ${imageReplacementEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </div>
                              </button>

                              {/* Framework Selector */}
                              <div className="px-3 py-2.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900">
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                  </div>
                                  <div className="flex flex-col flex-1 gap-2">
                                    <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">Framework</div>
                                    <select
                                      value={selectedFramework}
                                      onChange={(e) => {
                                        const newFramework = e.target.value;
                                        setSelectedFramework(newFramework);
                                        if (typeof window !== 'undefined') {
                                          localStorage.setItem('magicassistant_bricks_framework', newFramework);
                                        }
                                      }}
                                      className="w-full text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                      <option value="Native">Native</option>
                                      <option value="ACSS">ACSS</option>
                                      <option value="CoreFramework">CoreFramework</option>
                                      <option value="ATF">ATF</option>
                                    </select>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Send button - right side */}
                <Button
                  onClick={sendMessage}
                  disabled={(isLoading || isStreaming) || (!inputMessage.trim() && attachedFiles.length === 0)}
                  size={isDrawerMode ? "sm" : "default"}
                  className="rounded-full p-2 text-primary-600 hover:bg-primary-100 dark:text-white dark:hover:bg-gray-600"
                >
                  {(isLoading || isStreaming) ? <Spinner size="sm" /> : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
              accept=".txt,.md,.json,.js,.css,.html,.py,.php,.xml,.csv,.log,.jpg,.jpeg,.png,.gif,.webp,.bmp,.svg"
            />
          </div>
        )}
      </div>

      {/* History Drawer */}
      {!isDrawerMode && (
        <Drawer 
          open={isHistoryOpen} 
          onClose={() => setIsHistoryOpen(false)} 
          position="right" 
          className="bg-white dark:bg-gray-900 border-l border-gray-300 dark:border-gray-700"
          theme={{
            root: {
              backdrop: "fixed inset-0 z-30 bg-black/10"
            }
          }}
        >
          <div className="mb-4 flex items-center justify-between pt-[32px]">
            <h5 className="text-base font-semibold text-gray-500 dark:text-gray-400">Chat History</h5>
            <div className="flex items-center gap-2">
              {chatSessions.length > 0 && (
                <Button 
                  size="xs" 
                  color="failure" 
                  onClick={confirmDeleteAllSessions}
                  title="Delete all conversations"
                  className="bg-red-600 text-white"
                >
                  Delete All
                </Button>
              )}
              <Button size="xs" color="light" onClick={() => setIsHistoryOpen(false)}>Close</Button>
            </div>
          </div>
          <ul className="space-y-2">
            {chatSessions.length === 0 && <li className="text-sm text-gray-500">No saved conversations yet.</li>}
            {chatSessions.map(s => (
              <li key={s.id} className="group relative">
                <button 
                  onClick={() => loadSession(s)} 
                  className={`w-full text-left p-3 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm dark:text-white border-l-2 ${
                    currentSessionId === s.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <img
                      src={adminData?.currentUser?.avatar || `https://www.gravatar.com/avatar/default?s=20&d=mp`}
                      alt={adminData?.currentUser?.name || 'User'}
                      className="h-5 w-5 rounded-full border border-gray-200 dark:border-gray-600 flex-shrink-0 mt-0.5"
                      onError={(e) => {
                        e.target.src = `https://www.gravatar.com/avatar/default?s=20&d=mp`
                      }}
                    />
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {s.message_count} messages • {new Date(s.last_message_time).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDeleteSession(s)
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 hover:text-red-700"
                  title="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </Drawer>
      )}

      {/* Settings Modal */}
      {!isDrawerMode && (
        <ConfirmationModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          title="Chat Settings"
          showActions={false}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            {/* Custom System Message Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="enableCustomSystem"
                  checked={enableCustomSystem}
                  onChange={(e) => setEnableCustomSystem(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="enableCustomSystem" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
                  🤖 Enable Custom System Message
                </label>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Override the default system prompt with your own custom instructions for the AI.
              </p>
              
              <div className="space-y-3">
                <textarea
                  value={customSystemMessage}
                  onChange={(e) => setCustomSystemMessage(e.target.value)}
                  placeholder="Enter your custom system message here... For example: 'You are a helpful WordPress expert who always provides detailed explanations with code examples.'"
                  rows={6}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
                  disabled={!enableCustomSystem}
                />
                
                <div className="flex gap-2">
                  <Button
                    onClick={saveCustomSystemMessage}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Save Custom Message
                  </Button>
                  <Button
                    onClick={clearCustomSystemMessage}
                    size="sm"
                    color="gray"
                  >
                    Clear & Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* File Persistence Settings */}
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="persistFiles"
                  checked={persistFiles}
                  onChange={(e) => setPersistFiles(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="persistFiles" className="ml-2 text-sm font-medium text-purple-900 dark:text-purple-100 cursor-pointer">
                  📎 Keep Files Attached Throughout Chat
                </label>
              </div>
              
              <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                When enabled, uploaded files will remain attached to all messages instead of being cleared after each send. 
                Useful for ongoing work with the same files.
              </p>
              
              <div className="flex gap-2">
                <Button
                  onClick={saveFilePersistenceSetting}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Save Setting
                </Button>
                {persistFiles && (
                  <Button
                    onClick={() => setAttachedFiles([])}
                    size="sm"
                    color="gray"
                  >
                    Clear Current Files
                  </Button>
                )}
              </div>
            </div>

            {/* AI Agent Selection */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center mb-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.94l1-4H9.03z" clipRule="evenodd" />
                </svg>
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">AI Agent Selection</h3>
              </div>
              
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                Select which AI Agent to use for this chat session. The agent will provide specialized context and behavior for your conversations.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Selected Agent
                  </label>
                  <select
                    value={selectedAgentId || ''}
                    onChange={(e) => setSelectedAgentId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full p-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Agent (Default)</option>
                    {availableAgents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedAgentId && (
                  <div className="bg-blue-100 dark:bg-blue-800/30 rounded p-3">
                    {(() => {
                      const selectedAgent = availableAgents.find(agent => agent.id === selectedAgentId);
                      return selectedAgent ? (
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            {selectedAgent.name}
                          </p>
                          <p className="text-xs text-blue-800 dark:text-blue-200">
                            {selectedAgent.description}
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}
                
                <Button
                  onClick={saveAgentSelection}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Agent Selection
                </Button>
              </div>
            </div>

            {/* AI Model Override */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center mb-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <h3 className="text-sm font-medium text-green-900 dark:text-green-100">AI Model Override</h3>
              </div>

              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                Override the global AI settings for this chat session. Your choice will be remembered when you reload this conversation.
              </p>

              {/* Current Model Indicator */}
              <div className="mb-4 p-2 bg-green-100 dark:bg-green-800/30 rounded text-sm">
                <span className="font-medium">Currently using: </span>
                {overrideProvider ? (
                  <span className="text-green-700 dark:text-green-300">
                    {aiProviderOptions.find(p => p.value === overrideProvider)?.label || overrideProvider}
                    {overrideModel && ` (${overrideModel})`}
                    <span className="ml-2 text-xs bg-green-200 dark:bg-green-700 px-2 py-0.5 rounded">Override</span>
                  </span>
                ) : (
                  <span className="text-gray-600 dark:text-gray-400">Global default ({settings?.ai_provider || 'openai'})</span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    Provider
                  </label>
                  <select
                    value={overrideProvider || ''}
                    onChange={(e) => {
                      const newProvider = e.target.value || null
                      setOverrideProvider(newProvider)
                      setOverrideModel(null) // Reset model when provider changes
                    }}
                    className="w-full p-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                  >
                    {aiProviderOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {overrideProvider && getModelOptionsForProvider(overrideProvider).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                      Model
                    </label>
                    <select
                      value={overrideModel || ''}
                      onChange={(e) => setOverrideModel(e.target.value || null)}
                      className="w-full p-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Default for provider</option>
                      {getModelOptionsForProvider(overrideProvider).map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={saveProviderOverride}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={!currentSessionId}
                  >
                    Save Override
                  </Button>
                  {overrideProvider && (
                    <Button
                      onClick={clearProviderOverride}
                      size="sm"
                      color="gray"
                    >
                      Clear Override
                    </Button>
                  )}
                </div>

                {!currentSessionId && (
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Start a conversation to enable model override for this session.
                  </p>
                )}
              </div>
            </div>

            {/* Bricks Site Context Settings - Only show in Bricks Mode */}
            {isBricksMode && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                {renderSiteContextSettings()}
              </div>
            )}

            {/* Bricks Text Replacement Settings - Only show in Bricks Mode */}
            {isBricksMode && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                {renderTextReplacementSettings()}
              </div>
            )}


          </div>
        </ConfirmationModal>
      )}

      {isBricksMode && (
        <ConfirmationModal
          isOpen={isSiteContextModalOpen}
          onClose={() => setIsSiteContextModalOpen(false)}
          title="Bricks Site Context"
          showActions={false}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4">
            {renderSiteContextSettings()}
            <div className="flex justify-end">
              <Button
                size="sm"
                color="gray"
                onClick={() => setIsSiteContextModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </ConfirmationModal>
      )}

      {/* Custom File Creation Modal */}
      <ConfirmationModal
        isOpen={isFileModalOpen}
        onClose={() => setIsFileModalOpen(false)}
        title="Create Custom File"
        showActions={false}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Name
              </label>
              <input
                type="text"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="my-file"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Type
              </label>
              <select
                value={customFileType}
                onChange={(e) => setCustomFileType(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="txt">Text (.txt)</option>
                <option value="md">Markdown (.md)</option>
                <option value="json">JSON (.json)</option>
                <option value="js">JavaScript (.js)</option>
                <option value="css">CSS (.css)</option>
                <option value="html">HTML (.html)</option>
                <option value="php">PHP (.php)</option>
                <option value="py">Python (.py)</option>
                <option value="xml">XML (.xml)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              File Content
            </label>
            <textarea
              value={customFileContent}
              onChange={(e) => setCustomFileContent(e.target.value)}
              placeholder="Enter your file content here..."
              rows={12}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none font-mono text-sm"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setIsFileModalOpen(false)}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              onClick={createCustomFile}
              disabled={!customFileName.trim() || !customFileContent.trim()}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Create File
            </Button>
          </div>
        </div>
      </ConfirmationModal>

      {/* Delete Session Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Chat Conversation"
        message={`Are you sure you want to delete "${sessionToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
      />

      {/* Delete All Sessions Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAllConfirm}
        title="Delete All Chat Conversations"
        message={`Are you sure you want to delete all ${chatSessions.length} chat conversations? This action cannot be undone.`}
        confirmText="Delete All"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900"
        icon="delete"
      />

      {/* Share Conversation Modal */}
      {!isDrawerMode && (
        <ConfirmationModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          title="Share Conversation"
          showActions={false}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Permanent Share Options */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="shareAsPermanent"
                  checked={shareAsPermanent}
                  onChange={(e) => setShareAsPermanent(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="shareAsPermanent" className="ml-2 text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
                  🔗 Create permanent shareable link
                </label>
              </div>
              
              {shareAsPermanent && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will create a public URL that anyone can access to view this conversation.
                  </p>
                  
                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Expire after:
                    </label>
                    <select
                      value={shareExpiry}
                      onChange={(e) => setShareExpiry(parseInt(e.target.value))}
                      className="px-3 py-1 border border-blue-300 dark:border-blue-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={0}>Never</option>
                      <option value={1}>1 day</option>
                      <option value={7}>1 week</option>
                      <option value={30}>30 days</option>
                      <option value={90}>90 days</option>
                      <option value={365}>1 year</option>
                    </select>
                  </div>
                  
                  <Button
                    onClick={createPermanentShare}
                    disabled={isCreatingShare}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isCreatingShare ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        Creating Share Link...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                        </svg>
                        Create Permanent Link
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Preview</h3>
              <div className="max-h-96 overflow-y-auto">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                    {formatConversationForSharing()}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            
            {!shareAsPermanent && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={copyConversationToClipboard}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Copy to Clipboard
                </Button>
                
                <Button
                  onClick={() => {
                    const formattedText = formatConversationForSharing()
                    const blob = new Blob([formattedText], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${getChatTitle().replace(/[^a-z0-9]/gi, '_').toLowerCase()}_conversation.md`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                    showSuccess('Conversation downloaded as Markdown file!')
                  }}
                  color="gray"
                  className="flex-1"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download as Markdown
                </Button>
                
                <Button
                  onClick={() => {
                    const formattedText = formatConversationForSharing()
                    const dataUri = 'data:text/plain;charset=utf-8,' + encodeURIComponent(formattedText)
                    const newWindow = window.open()
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>${getChatTitle()} - Conversation</title>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1">
                            <style>
                              body { 
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                                max-width: 800px; 
                                margin: 2rem auto; 
                                padding: 2rem; 
                                line-height: 1.6; 
                                color: #333;
                                background: #fff;
                              }
                              h1 { color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; }
                              h2 { color: #1f2937; }
                              pre { background: #f3f4f6; padding: 1rem; border-radius: 8px; overflow-x: auto; }
                              code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; }
                              blockquote { border-left: 4px solid #e5e7eb; margin: 1rem 0; padding-left: 1rem; color: #6b7280; }
                              hr { border: none; height: 1px; background: #e5e7eb; margin: 2rem 0; }
                              @media (prefers-color-scheme: dark) {
                                body { background: #1f2937; color: #f9fafb; }
                                h1 { color: #60a5fa; border-bottom-color: #374151; }
                                h2 { color: #f9fafb; }
                                pre, code { background: #374151; }
                                blockquote { border-left-color: #4b5563; color: #9ca3af; }
                                hr { background: #4b5563; }
                              }
                            </style>
                          </head>
                          <body>
                            <div id="content"></div>
                            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                            <script>
                              document.getElementById('content').innerHTML = marked.parse(\`${formattedText.replace(/`/g, '\\`')}\`);
                            </script>
                          </body>
                        </html>
                      `)
                      newWindow.document.close()
                    } else {
                      showError('Unable to open preview window. Please allow popups.')
                    }
                  }}
                  color="gray"
                  className="flex-1"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open in New Tab
                </Button>
              </div>
            )}
            
            <div className="flex justify-end">
              <Button color="gray" onClick={() => setIsShareModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </ConfirmationModal>
      )}

      {/* Post Selector Modal */}
      {showPostSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Select Post or Page</h3>
              <button
                onClick={() => setShowPostSelector(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {loadingPosts ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading posts...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availablePosts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => {
                      if (pendingFeaturedImage) {
                        saveAsFeaturedImage(
                          pendingFeaturedImage.imgUrl,
                          pendingFeaturedImage.downloadLoc,
                          pendingFeaturedImage.altText,
                          pendingFeaturedImage.unsplashId,
                          pendingFeaturedImage.photographer,
                          post.id
                        )
                      }
                      setShowPostSelector(false)
                      setPendingFeaturedImage(null)
                    }}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {post.title}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {post.type === 'post' ? 'Post' : 'Page'} • {post.status}
                    </div>
                  </button>
                ))}
                {availablePosts.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No posts or pages found
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowPostSelector(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxOpen && (
        <div 
          className="fixed bg-black bg-opacity-90" 
          style={{ 
            zIndex: 999999,
            top: window.innerWidth > 782 ? '32px' : '46px', // WordPress admin bar height
            left: window.innerWidth > 960 ? '160px' : '0', // WordPress sidebar width
            right: '0',
            bottom: '0'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setLightboxOpen(false)
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="relative w-full h-full flex items-center justify-center p-6 overflow-hidden">
            <img
              src={lightboxImages[currentImageIndex]?.src}
              alt={lightboxImages[currentImageIndex]?.alt || ''}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
              style={{
                transform: `scale(${lightboxZoom}) translate(${lightboxPosition.x / lightboxZoom}px, ${lightboxPosition.y / lightboxZoom}px)`,
                cursor: isDragging ? 'grabbing' : (lightboxZoom > 1 ? 'zoom-out' : 'zoom-in')
              }}
              onMouseDown={handleMouseDown}
              onWheel={(e) => handleLightboxZoom(e.deltaY > 0 ? -0.2 : 0.2, e)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only zoom if we haven't been dragging
                if (!hasDragged) {
                  // Click to zoom in if not zoomed, zoom out if zoomed
                  if (lightboxZoom === 1) {
                    handleLightboxZoom(1, e); // Zoom to 2x
                  } else {
                    setLightboxZoom(1);
                    setLightboxPosition({ x: 0, y: 0 });
                  }
                }
                // Reset drag state for next interaction
                setHasDragged(false);
              }}
              draggable={false}
            />
            
            {/* Close button */}
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Zoom controls */}
            <div className="absolute top-2 left-2 flex flex-col gap-2">
              <button
                onClick={(e) => handleLightboxZoom(0.2, e)}
                className="w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity"
                title="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              <button
                onClick={(e) => handleLightboxZoom(-0.2, e)}
                className="w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity"
                title="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.preventDefault(); setLightboxZoom(1); setLightboxPosition({ x: 0, y: 0 }); }}
                className="w-8 h-8 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity text-xs"
                title="Reset zoom"
              >
                1:1
              </button>
            </div>
            
            {/* Navigation arrows - only show if multiple images */}
            {lightboxImages.length > 1 && (
              <>
                <button
                  onClick={() => { setCurrentImageIndex(currentImageIndex > 0 ? currentImageIndex - 1 : lightboxImages.length - 1); resetLightboxState(); }}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => { setCurrentImageIndex(currentImageIndex < lightboxImages.length - 1 ? currentImageIndex + 1 : 0); resetLightboxState(); }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                  {currentImageIndex + 1} / {lightboxImages.length}
                </div>
              </>
            )}
            
            {/* Zoom indicator */}
            {lightboxZoom !== 1 && (
              <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {Math.round(lightboxZoom * 100)}%
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

export default ChatInterface
