import React, { useState, useEffect, createContext, useContext, useCallback } from 'react'

// Toast Context
const ToastContext = createContext()

// Custom hook for using toasts
export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Individual Toast Component
const ToastItem = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  useEffect(() => {
    // Trigger animation on mount
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove()
      }, toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration])

  const handleRemove = () => {
    if (isRemoving) return
    setIsRemoving(true)
    setIsVisible(false)
    
    // Wait for animation to complete before removing
    setTimeout(() => {
      onRemove(toast.id)
      if (toast.onClose) {
        toast.onClose()
      }
    }, 300)
  }

  const getIcon = () => {
    const iconClass = "w-5 h-5"
    switch (toast.type) {
      case 'success':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'error':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'warning':
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        )
      case 'info':
      default:
        return (
          <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getTypeClasses = () => {
    switch (toast.type) {
      case 'success':
        return {
          container: 'border-l-green-500 bg-green-50 dark:bg-green-900/20',
          icon: 'text-green-600 bg-green-100 dark:bg-green-800/30 dark:text-green-400',
          text: 'text-green-800 dark:text-green-200'
        }
      case 'error':
        return {
          container: 'border-l-red-500 bg-red-50 dark:bg-red-900/20',
          icon: 'text-red-600 bg-red-100 dark:bg-red-800/30 dark:text-red-400',
          text: 'text-red-800 dark:text-red-200'
        }
      case 'warning':
        return {
          container: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
          icon: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-800/30 dark:text-yellow-400',
          text: 'text-yellow-800 dark:text-yellow-200'
        }
      case 'info':
      default:
        return {
          container: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20',
          icon: 'text-blue-600 bg-blue-100 dark:bg-blue-800/30 dark:text-blue-400',
          text: 'text-blue-800 dark:text-blue-200'
        }
    }
  }

  const typeClasses = getTypeClasses()

  return (
    <div
      className={`
        flex items-center p-4 mb-3 rounded-lg border-l-4 shadow-lg transition-all duration-300 ease-in-out transform
        ${typeClasses.container}
        ${isVisible && !isRemoving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
        }
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg ${typeClasses.icon}`}>
        {getIcon()}
      </div>

      {/* Message */}
      <div className={`ml-3 text-sm font-medium ${typeClasses.text} flex-1`}>
        {toast.title && (
          <div className="font-semibold mb-1">{toast.title}</div>
        )}
        <div>{toast.message}</div>
      </div>

      {/* Close Button */}
      <button
        type="button"
        className={`ml-3 -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 items-center justify-center transition-colors duration-200 ${typeClasses.text} hover:bg-white/50 dark:hover:bg-gray-800/50`}
        onClick={handleRemove}
        aria-label="Close toast"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// Toast Container Component
const ToastContainer = ({ toasts, position, onRemove }) => {
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-5 left-5 mt-8'
      case 'top-center':
        return 'top-5 left-1/2 transform -translate-x-1/2 mt-8'
      case 'top-right':
      default:
        return 'top-5 right-5 mt-8'
      case 'bottom-left':
        return 'bottom-5 left-5'
      case 'bottom-center':
        return 'bottom-5 left-1/2 transform -translate-x-1/2'
      case 'bottom-right':
        return 'bottom-5 right-5'
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className={`fixed z-50 max-w-sm w-full ${getPositionClasses()}`}>
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

// Toast Provider Component
export const ToastProvider = ({ children, position = 'top-right', maxToasts = 3 }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback(({
    message,
    type = 'info',
    title = null,
    duration = 5000,
    onClose = null
  }) => {
    const id = Date.now() + Math.random()
    const newToast = {
      id,
      message,
      type,
      title,
      duration,
      onClose
    }

    setToasts(prevToasts => {
      const updatedToasts = [newToast, ...prevToasts]
      // Limit the number of toasts
      return updatedToasts.slice(0, maxToasts)
    })

    return id
  }, [maxToasts])

  const removeToast = useCallback((id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id))
  }, [])

  const removeAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  // Convenience methods
  const showSuccess = useCallback((message, options = {}) => {
    return addToast({ message, type: 'success', ...options })
  }, [addToast])

  const showError = useCallback((message, options = {}) => {
    return addToast({ message, type: 'error', duration: 6000, ...options })
  }, [addToast])

  const showWarning = useCallback((message, options = {}) => {
    return addToast({ message, type: 'warning', ...options })
  }, [addToast])

  const showInfo = useCallback((message, options = {}) => {
    return addToast({ message, type: 'info', ...options })
  }, [addToast])

  const contextValue = {
    addToast,
    removeToast,
    removeAllToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    toasts
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts}
        position={position}
        onRemove={removeToast}
      />
    </ToastContext.Provider>
  )
}

export default ToastProvider 