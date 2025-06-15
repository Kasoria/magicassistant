import { useState, useRef, useEffect } from 'react'
import { Button, Card, TextInput, Spinner, Drawer } from 'flowbite-react'
import { useToast } from './Toast'
import ConfirmationModal from './ConfirmationModal'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

const ChatInterface = ({ adminData }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your WordPress AI assistant. I can help you create content, manage your site, and answer questions. What would you like to do today?',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState(null)
  const [forceAgentMode, setForceAgentMode] = useState(null)
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadSettings()
    loadChatSessions()
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
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadChatSessions = async () => {
    try {
      const response = await fetch(`${adminData.restUrl}chat-sessions`, {
        headers: {
          'X-WP-Nonce': adminData.nonces.wp_rest,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setChatSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputMessage.trim()) return
    
    if (!settings?.has_api_key) {
      showError('Please configure your AI API key in Settings first.')
      return
    }

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
          session_id: currentSessionId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update current session ID if this is a new session
        if (!currentSessionId && data.session_id) {
          setCurrentSessionId(data.session_id)
          // Refresh chat sessions list to include the new session
          loadChatSessions()
        }
        
        const assistantMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          agent_mode: data.agent_mode,
          reasoning: data.reasoning,
          tool_calls_count: data.tool_calls_count
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Reset force agent mode after message is sent
        if (forceAgentMode !== null) {
          setForceAgentMode(null)
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
        timestamp: new Date()
      }
    ])
    setCurrentSessionId(null) // Reset session ID for new conversation
    setCustomTitle('') // Reset custom title
    setIsEditingTitle(false) // Stop editing if in edit mode
  }

  const startNewChat = () => {
    clearChat()
    loadChatSessions() // Refresh the sessions list
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
            timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
            provider: msg.provider,
            model: msg.model,
            userId: msg.user_id,
            userName: msg.user_name,
            userAvatar: msg.user_avatar
          }))
          
          setMessages(formattedMessages)
          setCurrentSessionId(session.id)
          // Load the custom title from the session
          setCustomTitle(session.title || '')
          setIsHistoryOpen(false)
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
          loadChatSessions()
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
          truncate_at_message: editingMessageIndex
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
          tool_calls_count: data.tool_calls_count
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Reset force agent mode after message is sent
        if (forceAgentMode !== null) {
          setForceAgentMode(null)
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

  return (
    
    <div className="flex flex-col h-[calc(100vh-15rem)]">
      {/* Header - new layout */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <Button size="sm" color="gray" onClick={() => setIsSettingsOpen(true)}>Settings</Button>
          <Button size="sm" color="gray" onClick={() => setIsHistoryOpen(true)}>History</Button>
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
        
        <div className="flex items-center space-x-2">
          <select
            value={forceAgentMode || 'auto'}
            onChange={(e) => setForceAgentMode(e.target.value === 'auto' ? null : e.target.value === 'true')}
            className="text-xs border border-gray-300 rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="auto">Auto Mode</option>
            <option value="true">Force Agent</option>
            <option value="false">Force Chat</option>
          </select>
          <Button size="sm" onClick={startNewChat}>New chat</Button>
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto h-[calc(100vh-18.7rem)] sm:h-[calc(100vh-15.4rem)]">
        <div className="space-y-6 pt-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`p-4 shadow-xs rounded-lg flex items-start gap-6 group relative pe-14 ${
                message.role === 'user'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30'
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
      <div className="p-4 border-t border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
        {!settings.has_api_key ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm">
              Please configure your AI API key in Settings to start chatting with your assistant.
            </p>
          </div>
        ) : !settings.mcp_enabled ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              Enable MCP in Settings to allow the AI to perform WordPress actions for you.
            </p>
          </div>
        ) : (
          <div className="flex space-x-2">
            <TextInput
              type="text"
              placeholder="Ask me anything about your WordPress site..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
            >
              {isLoading ? <Spinner size="sm" /> : 'Send'}
            </Button>
          </div>
        )}
      </div>

      {/* History Drawer */}
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

      {/* Settings Modal (placeholder) */}
      <ConfirmationModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        title="Chat Settings"
        showActions={false}
        maxWidth="max-w-2xl"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">Settings content goes here.</p>
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
    </div>
  )
}

export default ChatInterface
