import { useEffect, useRef } from 'react'

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Are you sure?", 
  message = "This action cannot be undone.", 
  confirmText = "Yes, confirm", 
  cancelText = "No, cancel",
  confirmButtonClass = "bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900",
  items = [],
  icon = "warning",
  showActions = true,
  children = null,
  maxWidth = "max-w-md"
}) => {
  const confirmButtonRef = useRef(null)

  // Handle escape key and autofocus
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      
      // Autofocus the confirm button when modal opens (only if actions are shown)
      if (showActions) {
        setTimeout(() => {
          if (confirmButtonRef.current) {
            confirmButtonRef.current.focus()
          }
        }, 100)
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, showActions])

  if (!isOpen) return null

  const getIcon = () => {
    switch (icon) {
      case 'warning':
        return (
          <svg className="flex-shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        )
      case 'delete':
        return (
          <svg className="flex-shrink-0 w-4 h-4 text-red-400 dark:text-red-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        )
      case 'clone':
        return (
          <svg className="flex-shrink-0 w-4 h-4 text-blue-400 dark:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )
      default:
        return (
          <svg className="flex-shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        )
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-center items-center w-full h-full bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className={`relative p-4 w-full ${maxWidth}`}>
        {/* Modal content */}
        <div className="relative p-4 bg-white rounded-lg shadow dark:bg-gray-800 sm:p-5">
          {/* Close button */}
          <button 
            type="button" 
            className="text-gray-400 absolute top-2.5 right-2.5 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors duration-200"
            onClick={onClose}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
            <span className="sr-only">Close modal</span>
          </button>

          {/* Modal header */}
          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>

          {/* Custom children content or default message/items */}
          {children ? (
            <div className="mb-4">
              {children}
            </div>
          ) : (
            <>
              {/* Modal message */}
              <p className="mb-4 font-light text-gray-500 dark:text-gray-400">
                {message}
              </p>

              {/* Items list (if provided) */}
              {items.length > 0 && (
                <ul className="mb-4 space-y-2 text-left text-gray-500 sm:mb-5 dark:text-gray-400">
                  {items.map((item, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      {getIcon()}
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Action buttons - only show if showActions is true */}
          {showActions && (
            <div className="flex items-center space-x-4">
              <button 
                type="button" 
                className="py-2 px-3 text-sm font-medium text-gray-500 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-primary-300 hover:text-gray-900 focus:z-10 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:text-white dark:hover:bg-gray-600 dark:focus:ring-gray-600 transition-colors duration-200"
                onClick={onClose}
              >
                {cancelText}
              </button>
              <button 
                type="button" 
                className={`inline-flex items-center py-2 px-3 text-sm font-medium text-center text-white rounded-lg focus:ring-4 focus:outline-none transition-colors duration-200 ${confirmButtonClass}`}
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                ref={confirmButtonRef}
              >
                {icon === 'delete' && (
                  <svg className="w-4 h-4 mr-1.5 -ml-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
                  </svg>
                )}
                {icon === 'clone' && (
                  <svg className="w-4 h-4 mr-1.5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
                {confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Ensure component has a display name for debugging
ConfirmationModal.displayName = 'ConfirmationModal'

export default ConfirmationModal 