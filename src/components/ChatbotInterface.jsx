import { useState, useEffect, useRef } from 'react'
import { Button } from 'flowbite-react'

/**
 * ChatbotInterface
 * ---------------
 * A polished, user-friendly chat interface designed specifically for website visitors.
 * This component provides a clean, modern chatbot experience with quick messages,
 * typing indicators, and customizable styling.
 * 
 * Unlike the admin ChatInterface, this is focused on simplicity and user experience
 * for public website visitors interacting with AI-powered chatbots.
 */

const ChatbotInterface = ({
  chatbot,
  onClose,
  isOpen = true,
  className = '',
  isPreview = false
}) => {
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [showClearConfirmation, setShowClearConfirmation] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Helper function to get local storage key
  const getStorageKey = () => `magicassistant_chatbot_${chatbot.id}_history`

  // Helper function to save chat history to local storage
  const saveChatHistory = (chatMessages, currentSessionId) => {
    try {
      const storageData = {
        sessionId: currentSessionId,
        messages: chatMessages,
        lastUpdated: new Date().toISOString()
      }
      localStorage.setItem(getStorageKey(), JSON.stringify(storageData))
    } catch (error) {
      console.error('Error saving chat history to localStorage:', error)
    }
  }

  // Helper function to load chat history from local storage
  const loadChatHistory = () => {
    try {
      const stored = localStorage.getItem(getStorageKey())
      if (stored) {
        const storageData = JSON.parse(stored)
        return storageData
      }
    } catch (error) {
      console.error('Error loading chat history from localStorage:', error)
    }
    return null
  }

  // Helper function to clear chat history
  const clearChatHistory = () => {
    try {
      localStorage.removeItem(getStorageKey())
      // Generate new session ID
      const newSessionId = `chatbot_${chatbot.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setSessionId(newSessionId)

      // Reset to welcome message if configured
      if (chatbot.behavior_settings?.welcome_message) {
        const welcomeMsg = {
          id: 'welcome',
          role: 'assistant',
          content: chatbot.behavior_settings.welcome_message,
          timestamp: new Date().toISOString()
        }
        setMessages([welcomeMsg])
        saveChatHistory([welcomeMsg], newSessionId)
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('Error clearing chat history:', error)
    }
  }

  // Initialize session and load history on mount
  useEffect(() => {
    // Try to load existing chat history
    const storedData = loadChatHistory()

    if (storedData && storedData.sessionId && storedData.messages && storedData.messages.length > 0) {
      // Restore previous session
      setSessionId(storedData.sessionId)
      setMessages(storedData.messages)
    } else {
      // Create new session
      const newSessionId = `chatbot_${chatbot.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setSessionId(newSessionId)

      // Add welcome message if configured
      if (chatbot.behavior_settings?.welcome_message) {
        const welcomeMsg = {
          id: 'welcome',
          role: 'assistant',
          content: chatbot.behavior_settings.welcome_message,
          timestamp: new Date().toISOString()
        }
        setMessages([welcomeMsg])
        saveChatHistory([welcomeMsg], newSessionId)
      }
    }
  }, [chatbot])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Focus input when chatbot opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage.trim()
    if (!messageToSend || isLoading) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString()
    }

    const updatedMessagesWithUser = [...messages, userMessage]
    setMessages(updatedMessagesWithUser)
    setInputMessage('')

    // Save immediately after user message
    saveChatHistory(updatedMessagesWithUser, sessionId)

    // Handle preview mode - just show a demo response
    if (isPreview) {
      // Show typing indicator if enabled
      if (chatbot.behavior_settings?.typing_indicator) {
        setIsLoading(true)
        setIsTyping(true)
      }

      // Simulate typing delay
      setTimeout(() => {
        const demoResponse = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'This is a preview of how your chatbot will respond to messages. The actual AI responses will be generated when the chatbot is active on your website.',
          timestamp: new Date().toISOString()
        }

        const updatedMessagesWithDemo = [...updatedMessagesWithUser, demoResponse]
        setMessages(updatedMessagesWithDemo)
        setIsLoading(false)
        setIsTyping(false)

        // Save demo response to local storage
        saveChatHistory(updatedMessagesWithDemo, sessionId)
      }, 1500)
      return
    }

    setIsLoading(true)

    // Show typing indicator if enabled
    if (chatbot.behavior_settings?.typing_indicator) {
      setIsTyping(true)
    }

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await fetch(`/wp-json/magicassistant/v1/public/chatbots/${chatbot.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          history: conversationHistory,
          session_id: sessionId
        })
      })

      const result = await response.json()

      if (result.success) {
        // Add AI response
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date().toISOString()
        }

        const updatedMessagesWithAI = [...updatedMessagesWithUser, aiMessage]
        setMessages(updatedMessagesWithAI)

        // Save AI response to local storage
        saveChatHistory(updatedMessagesWithAI, sessionId)
      } else {
        throw new Error(result.message || 'Failed to get response')
      }
    } catch (error) {
      console.error('Chat error:', error)

      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        isError: true
      }

      const updatedMessagesWithError = [...updatedMessagesWithUser, errorMessage]
      setMessages(updatedMessagesWithError)

      // Save error message to local storage
      saveChatHistory(updatedMessagesWithError, sessionId)
    } finally {
      setIsLoading(false)
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleQuickMessage = (message) => {
    sendMessage(message)
  }

  // Get styling values with defaults
  const styling = chatbot.chatbot_styling || {}

  // Layout & Dimensions
  const width = styling.width || 380
  const height = styling.height || 500
  const borderRadius = styling.border_radius || 12

  // Colors & Theme
  const primaryColor = styling.primary_color || '#3B82F6'
  const secondaryColor = styling.secondary_color || '#F3F4F6'
  const backgroundColor = styling.background_color || '#FFFFFF'

  // Header Styling
  const headerBg = styling.header_background || primaryColor
  const headerTextColor = styling.header_text_color || '#FFFFFF'
  const headerFontSize = styling.header_font_size || 16
  const headerFontWeight = styling.header_font_weight || 600

  // Message Styling
  const userMsgBg = styling.message_background_user || primaryColor
  const botMsgBg = styling.message_background_bot || secondaryColor
  const userMsgTextColor = styling.message_text_color_user || '#FFFFFF'
  const botMsgTextColor = styling.message_text_color_bot || '#1F2937'
  const messageFontSize = styling.message_font_size || 14
  const messageFontWeight = styling.message_font_weight || 400

  // Input & Button Styling
  const inputBg = styling.input_background || '#FFFFFF'
  const inputTextColor = styling.input_text_color || '#1F2937'
  const inputBorderColor = styling.input_border_color || '#D1D5DB'
  const inputFontSize = styling.input_font_size || 14
  const sendButtonBg = styling.send_button_background || primaryColor
  const sendButtonTextColor = styling.send_button_text_color || '#FFFFFF'
  const sendButtonHoverBg = styling.send_button_hover_background || '#2563EB'

  // Quick Messages
  const quickMsgBg = styling.quick_message_background || 'transparent'
  const quickMsgTextColor = styling.quick_message_text_color || primaryColor
  const quickMsgBorderColor = styling.quick_message_border_color || primaryColor
  const quickMsgFontSize = styling.quick_message_font_size || 12

  // Typography
  const fontFamily = styling.font_family || 'Inter, system-ui, sans-serif'

  // Animations & Effects
  const enableAnimations = styling.enable_animations !== false
  const typingIndicatorColor = styling.typing_indicator_color || '#9CA3AF'

  return (
    <div
      className={`flex flex-col h-full shadow-xl ${className}`}
      style={{
        borderRadius: `${borderRadius}px`,
        backgroundColor: backgroundColor,
        fontFamily: fontFamily,
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative'
      }}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center p-4 border-b"
        style={{
          backgroundColor: headerBg,
          color: headerTextColor,
          borderTopLeftRadius: `${borderRadius}px`,
          borderTopRightRadius: `${borderRadius}px`,
          borderBottomColor: headerBg + '20'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center overflow-hidden">
            {chatbot.custom_header_logo ? (
              <img
                src={chatbot.custom_header_logo}
                alt="Chatbot Logo"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  // Fallback to default icon if image fails to load
                  e.target.style.display = 'none'
                  e.target.nextSibling.style.display = 'block'
                }}
              />
            ) : null}
            <svg
              className={`w-5 h-5 ${chatbot.custom_header_logo ? 'hidden' : ''}`}
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{ display: chatbot.custom_header_logo ? 'none' : 'block' }}
            >
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.468L3 21l2.532-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
            </svg>
          </div>
          <div>
            <h3
              style={{
                fontSize: `${headerFontSize}px`,
                fontWeight: headerFontWeight,
                fontFamily: fontFamily
              }}
            >
              {chatbot.custom_header_name || chatbot.name}
            </h3>
            {isTyping && (
              <p
                className="opacity-75"
                style={{
                  fontSize: `${headerFontSize - 4}px`,
                  fontFamily: fontFamily
                }}
              >
                Typing...
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              onClick={() => setShowClearConfirmation(true)}
              className="hover:opacity-75 transition-opacity p-1"
              style={{ color: headerTextColor }}
              title="Start new chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="hover:opacity-75 transition-opacity p-1"
              style={{ color: headerTextColor }}
              title="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ backgroundColor: backgroundColor }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}${enableAnimations ? ' message-animation' : ''}`}
          >
            <div
              className="max-w-xs px-4 py-2"
              style={{
                backgroundColor: message.role === 'user'
                  ? userMsgBg
                  : message.isError
                    ? '#FEE2E2' // Red background for errors
                    : botMsgBg,
                color: message.role === 'user'
                  ? userMsgTextColor
                  : message.isError
                    ? '#DC2626' // Red text for errors
                    : botMsgTextColor,
                fontSize: `${messageFontSize}px`,
                fontWeight: messageFontWeight,
                fontFamily: fontFamily,
                borderTopLeftRadius: `${borderRadius}px`,
                borderTopRightRadius: `${borderRadius}px`,
                borderBottomRightRadius: message.role === 'user' ? '4px' : `${borderRadius}px`,
                borderBottomLeftRadius: message.role === 'assistant' ? '4px' : `${borderRadius}px`
              }}
            >
              {message.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className={`flex justify-start${enableAnimations ? ' typing-animation' : ''}`}>
            <div
              className="px-4 py-2"
              style={{
                backgroundColor: botMsgBg,
                borderRadius: `${borderRadius}px`,
                borderBottomLeftRadius: '4px'
              }}
            >
              <div className="flex space-x-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: typingIndicatorColor,
                    animation: enableAnimations ? 'bounce 1.4s infinite ease-in-out' : 'none'
                  }}
                ></div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: typingIndicatorColor,
                    animation: enableAnimations ? 'bounce 1.4s infinite ease-in-out' : 'none',
                    animationDelay: '0.16s'
                  }}
                ></div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: typingIndicatorColor,
                    animation: enableAnimations ? 'bounce 1.4s infinite ease-in-out' : 'none',
                    animationDelay: '0.32s'
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      {chatbot.quick_messages && chatbot.quick_messages.length > 0 && messages.length <= 1 && (
        <div className="px-4 pb-2" style={{ backgroundColor: backgroundColor }}>
          <div className="flex flex-wrap gap-2">
            {chatbot.quick_messages.filter(msg => msg.trim()).map((message, index) => (
              <button
                key={index}
                onClick={() => handleQuickMessage(message)}
                className={`px-3 py-2 rounded-full border transition-colors hover:opacity-75 disabled:opacity-50${enableAnimations ? ' quick-message-animation' : ''}`}
                style={{
                  backgroundColor: quickMsgBg,
                  borderColor: quickMsgBorderColor,
                  color: quickMsgTextColor,
                  fontSize: `${quickMsgFontSize}px`,
                  fontFamily: fontFamily,
                  borderRadius: `${borderRadius * 2}px` // More rounded for quick messages
                }}
                disabled={isLoading}
              >
                {message}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        className="p-4 border-t"
        style={{
          backgroundColor: backgroundColor,
          borderTopColor: inputBorderColor
        }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border focus:outline-none focus:ring-2 transition-colors"
            style={{
              backgroundColor: inputBg,
              borderColor: inputBorderColor,
              color: inputTextColor,
              fontSize: `${inputFontSize}px`,
              fontFamily: fontFamily,
              borderRadius: `${borderRadius}px`,
              focusRingColor: primaryColor
            }}
            onFocus={(e) => {
              e.target.style.borderColor = primaryColor;
              e.target.style.boxShadow = `0 0 0 2px ${primaryColor}25`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = inputBorderColor;
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            className="px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: sendButtonBg,
              color: sendButtonTextColor,
              borderRadius: `${borderRadius}px`,
              fontFamily: fontFamily
            }}
            onMouseEnter={(e) => {
              if (!isLoading && inputMessage.trim()) {
                e.target.style.backgroundColor = sendButtonHoverBg;
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = sendButtonBg;
            }}
          >
            {isLoading ? (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                style={{
                  animation: enableAnimations ? 'spin 1s linear infinite' : 'none'
                }}
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Clear Confirmation Dialog Overlay */}
      {showClearConfirmation && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: `${borderRadius}px`
          }}
          className={enableAnimations ? 'message-animation' : ''}
        >
          <div
            className="px-6 py-4"
            style={{
              backgroundColor: backgroundColor,
              borderRadius: `${borderRadius}px`,
              border: `2px solid ${primaryColor}`,
              fontFamily: fontFamily,
              maxWidth: '90%',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            <p
              className="mb-4 text-center"
              style={{
                fontSize: `${messageFontSize + 2}px`,
                fontWeight: 500,
                color: botMsgTextColor
              }}
            >
              Clear chat history and start a new conversation?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  clearChatHistory()
                  setShowClearConfirmation(false)
                }}
                className="px-4 py-2 transition-colors hover:opacity-75"
                style={{
                  backgroundColor: primaryColor,
                  color: '#FFFFFF',
                  borderRadius: `${borderRadius}px`,
                  fontSize: `${messageFontSize}px`,
                  fontFamily: fontFamily,
                  fontWeight: 500
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowClearConfirmation(false)}
                className="px-4 py-2 transition-colors hover:opacity-75"
                style={{
                  backgroundColor: backgroundColor,
                  color: botMsgTextColor,
                  border: `1px solid ${inputBorderColor}`,
                  borderRadius: `${borderRadius}px`,
                  fontSize: `${messageFontSize}px`,
                  fontFamily: fontFamily,
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      {enableAnimations && (
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% {
              -webkit-transform: scale(0);
              transform: scale(0);
            } 40% {
              -webkit-transform: scale(1.0);
              transform: scale(1.0);
            }
          }

          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .message-animation {
            animation: fadeIn 0.3s ease-out;
          }

          .quick-message-animation {
            animation: slideIn 0.2s ease-out;
          }

          .typing-animation {
            animation: fadeIn 0.2s ease-out;
          }
        `}</style>
      )}
    </div>
  )
}

export default ChatbotInterface