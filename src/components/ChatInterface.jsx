import { useState, useRef, useEffect } from 'react'
import { Button, Card, Textarea, Spinner, Drawer } from 'flowbite-react'
import CustomSelect from './CustomSelect'
import { useToast } from './Toast'
import ConfirmationModal from './ConfirmationModal'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

const ChatInterface = ({ adminData, isDrawerMode = false }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your WordPress AI assistant. I can help you create content, manage your site, and answer questions. What would you like to do today?',
      timestamp: new Date(),
      isWelcomeMessage: true // Mark this as the welcome message
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [forceAgentMode, setForceAgentMode] = useState(true)
  const messagesEndRef = useRef(null)
  const { showError, showSuccess } = useToast()
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [chatSessions, setChatSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [editingMessageIndex, setEditingMessageIndex] = useState(null)
  const [editingMessageContent, setEditingMessageContent] = useState('')
  const [showingDebugData, setShowingDebugData] = useState({})
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareAsPermanent, setShareAsPermanent] = useState(false)
  const [shareExpiry, setShareExpiry] = useState(30)
  const [isCreatingShare, setIsCreatingShare] = useState(false)
  const [creditsInfo, setCreditsInfo] = useState(null)

  // Agent mode options for react-select
  const agentModeOptions = [
    { value: 'false', label: 'Chat Mode' },
    { value: 'true', label: 'Agent Mode' }
  ]

  // Determine if we're in dark mode by checking the document class
  const isDarkMode = document.documentElement.classList.contains('dark')

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
    loadSettings()
    loadChatSessions(true) // Auto-load last session only on initial mount
    
    // Check for prefilled message from SEO Analytics
    const prefillMessage = sessionStorage.getItem('mat_prefill_message')
    if (prefillMessage) {
      setInputMessage(prefillMessage)
      sessionStorage.removeItem('mat_prefill_message')
    }
  }, [])

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
        // Always set creditsInfo from settings.current_credits
        if (data.current_credits) {
          setCreditsInfo(data.current_credits)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
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

  const sendMessage = async () => {
    if (!inputMessage.trim()) return
    
    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date(),
      userId: adminData?.currentUser?.id,
      userName: adminData?.currentUser?.name,
      userAvatar: adminData?.currentUser?.avatar
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      // Get current post information from adminData
      const currentPost = adminData?.currentPost || {}
      
      // Build context information for the AI
      let pageContext = {
        url: typeof window !== 'undefined' ? window.location.href : '',
        post_id: currentPost.id || null,
        post_type: currentPost.type || null,
        post_title: currentPost.title || '',
        context: currentPost.context || 'unknown'
      }

      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          message: inputMessage,
          history: messages.filter(msg => msg.role !== 'system').map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          agent_mode: forceAgentMode,
          session_id: currentSessionId,
          page_url: pageContext.url,
          page_context: pageContext
        })
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
        
        const assistantMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          agent_mode: data.agent_mode,
          reasoning: data.reasoning,
          tool_calls_count: data.tool_calls_count,
          debug_tool_data: data.debug_tool_data,
          tokens_used: data.tokens_used,
          cost: data.cost,
          response_time: data.response_time
        }
        setMessages(prev => [...prev, assistantMessage])
        // Update credit info from response
        if (data.credits) {
          setCreditsInfo(data.credits)
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessage = (content) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          // Customize how different elements are rendered
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
          pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto text-sm font-mono">{children}</pre>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-2">{children}</blockquote>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2 text-gray-900 dark:text-white">{children}</h3>,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 dark:hover:text-blue-300 transition-colors">{children}</a>,
          br: () => <br className="block" />,
        }}
      >
        {content}
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
          const formattedMessages = data.history.map(msg => ({
            role: msg.role,
            content: msg.content,
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
            tokens_used: msg.tokens_used,
            cost: msg.cost,
            response_time: msg.response_time
          }))
          
          setMessages(formattedMessages)
          setCurrentSessionId(session.id)
          // Load the custom title from the session
          setCustomTitle(session.title || '')
          setIsHistoryOpen(false)
          // Update Agent Mode to reflect the saved session preference
          if (typeof session.agent_mode !== 'undefined') {
            setForceAgentMode(session.agent_mode)
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
        context: currentPost.context || 'unknown'
      }

      const response = await fetch(`${adminData.restUrl}chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
        body: JSON.stringify({
          message: editingMessageContent.trim(),
          history: messagesUpToEdit.filter(msg => msg.role !== 'system').map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          agent_mode: forceAgentMode,
          session_id: currentSessionId,
          is_message_edit: true,
          truncate_at_message: editingMessageIndex,
          page_url: pageContext.url,
          page_context: pageContext
        })
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          agent_mode: data.agent_mode,
          reasoning: data.reasoning,
          tool_calls_count: data.tool_calls_count,
          debug_tool_data: data.debug_tool_data,
          tokens_used: data.tokens_used,
          cost: data.cost,
          response_time: data.response_time
        }
        setMessages(prev => [...prev, assistantMessage])
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

  return (
    
    <div className={`h-[calc(100vh-7.4rem)] mx-auto flex flex-col ${isDrawerMode ? 'h-full' : ''}`}>
      {/* Header - new layout */}
      {!isDrawerMode && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
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
              {creditsInfo && typeof creditsInfo.remaining !== 'undefined' && (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {(() => {
                    let used = null
                    if (typeof creditsInfo.current !== 'undefined') {
                      used = Number(creditsInfo.current)
                    } else if (typeof creditsInfo.limit !== 'undefined' && typeof creditsInfo.remaining !== 'undefined') {
                      used = Number(creditsInfo.limit) - Number(creditsInfo.remaining)
                    }
                    if (used !== null && typeof creditsInfo.limit !== 'undefined') {
                      return `💳 ${used.toFixed(2)} / ${creditsInfo.limit}`
                    } else if (typeof creditsInfo.limit !== 'undefined') {
                      return `💳 ${creditsInfo.limit}`
                    } else {
                      return ''
                    }
                  })()}
                </span>
              )}
              <CustomSelect
                value={agentModeOptions.find(option => option.value === forceAgentMode.toString())}
                onChange={(option) => setForceAgentMode(option.value === 'true')}
                options={agentModeOptions}
                isDisabled={false}
                darkMode={isDarkMode}
                size="compact"
              />
              <Button size="sm" onClick={startNewChat}>New chat</Button>
            </div>
        </div>
      )}

      {/* Drawer mode compact header */}
      {isDrawerMode && (
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
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
            {creditsInfo && typeof creditsInfo.remaining !== 'undefined' && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {(() => {
                  let used = null
                  if (typeof creditsInfo.current !== 'undefined') {
                    used = Number(creditsInfo.current)
                  } else if (typeof creditsInfo.limit !== 'undefined' && typeof creditsInfo.remaining !== 'undefined') {
                    used = Number(creditsInfo.limit) - Number(creditsInfo.remaining)
                  }
                  if (used !== null && typeof creditsInfo.limit !== 'undefined') {
                    return `�� ${used.toFixed(2)} / ${creditsInfo.limit}`
                  } else if (typeof creditsInfo.limit !== 'undefined') {
                    return `💳 ${creditsInfo.limit}`
                  } else {
                    return ''
                  }
                })()}
              </span>
            )}
            <CustomSelect
              value={agentModeOptions.find(option => option.value === forceAgentMode.toString())}
              onChange={(option) => setForceAgentMode(option.value === 'true')}
              options={agentModeOptions}
              isDisabled={false}
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
        <div className="max-w-4xl mx-auto py-4 lg:py-6 space-y-6 px-4 lg:px-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-6 shadow-xs rounded-lg flex items-start gap-6 group relative pe-14 ${
                message.role === 'user'
                  ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  : message.isError
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
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
              <div className="format dark:format-invert format-blue flex-1">
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
                  <div className={`${message.isError ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatMessage(message.content)}
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
                  {message.role === 'assistant' && !message.isError && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(message.content)}
                      className="inline-flex cursor-pointer justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white transition-colors ml-1"
                      title="Copy message"
                    >
                      <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M8 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1h2a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2Zm6 1h-4v2H9a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2h-1V4Zm-6 8a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Z" clipRule="evenodd"/>
                      </svg>
                      <span className="sr-only">Copy text</span>
                    </button>
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
                  <span className="text-gray-600 dark:text-gray-300">AI is thinking...</span>
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
          <div className={`flex items-center gap-3`}>
            <div className="relative flex-1">
              <Textarea
                placeholder="Ask me anything about your WordPress site..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                rows={isDrawerMode ? 2 : 3}
                className={`w-full pr-16 resize-y text-sm leading-relaxed placeholder-gray-500 dark:placeholder-gray-400 ${isDrawerMode ? 'text-sm' : ''}`}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                size={isDrawerMode ? "sm" : "default"}
                className="absolute bottom-2 right-2 z-10 rounded-full p-2 text-primary-600 hover:bg-primary-100 dark:text-primary-500 dark:hover:bg-gray-600"
              >
                {isLoading ? <Spinner size="sm" /> : (
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
            <Button size="xs" color="light" onClick={() => setIsHistoryOpen(false)}>Close</Button>
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

      {/* Settings Modal (placeholder) */}
      {!isDrawerMode && (
        <ConfirmationModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          title="Chat Settings"
          showActions={false}
          maxWidth="max-w-2xl"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">Settings will show up here.</p>
        </ConfirmationModal>
      )}

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
    </div>
  )
}

export default ChatInterface
