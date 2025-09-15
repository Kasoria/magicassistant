import { useEffect, useRef } from 'react'
import { Button } from 'flowbite-react'

const FormModal = ({ 
  isOpen, 
  onClose, 
  title,
  children,
  maxWidth = "max-w-4xl",
  onSave,
  saveText = "Save",
  saveButtonClass = "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-900",
  isSaving = false
}) => {
  const saveButtonRef = useRef(null)
  const hasInitiallyFocused = useRef(false)

  // Handle escape key and body overflow
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      
      // Only focus the first input field when modal initially opens
      if (!hasInitiallyFocused.current) {
        setTimeout(() => {
          const firstInput = document.querySelector('.modal-content input[type="text"], .modal-content textarea')
          if (firstInput) {
            firstInput.focus()
          }
        }, 100)
        hasInitiallyFocused.current = true
      }
    } else {
      // Reset focus tracking when modal closes
      hasInitiallyFocused.current = false
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

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
      <div className={`relative p-4 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        {/* Modal content */}
        <div className="relative bg-white rounded-lg shadow dark:bg-gray-800 modal-content">
          {/* Modal header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b rounded-t dark:border-gray-600">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <button 
              type="button" 
              className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white"
              onClick={onClose}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
              </svg>
              <span className="sr-only">Close modal</span>
            </button>
          </div>

          {/* Modal body */}
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            // Only submit if the submit button was clicked, not on Enter key in inputs
            if (e.nativeEvent.submitter && e.nativeEvent.submitter.type === 'submit') {
              onSave(); 
            }
          }}>
            <div className="p-4 md:p-5 space-y-4">
              {children}
            </div>

            {/* Modal footer */}
            <div className="flex items-center p-4 md:p-5 border-t border-gray-200 rounded-b dark:border-gray-600">
            <Button 
              type="submit"
              disabled={isSaving}
              ref={saveButtonRef}
              className={saveButtonClass}
            >
              {isSaving ? 'Saving...' : saveText}
            </Button>
            <Button 
              color="gray"
              onClick={onClose}
              className="ml-3"
              disabled={isSaving}
            >
              Cancel
            </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

FormModal.displayName = 'FormModal'

export default FormModal