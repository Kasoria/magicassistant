import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import MediaLibraryImageGen from './components/MediaLibraryImageGen.jsx'

const MediaLibraryIntegration = () => {
  const [modalElement, setModalElement] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [renderKey, setRenderKey] = useState(0) // Force remount when this changes
  const setRenderKeyRef = useRef(null)
  setRenderKeyRef.current = setRenderKey

  const handleImageGenerated = useCallback(async (images) => {
    console.log('🔄 MediaLibraryIntegration - handleImageGenerated called with', images.length, 'images')
    
    // Images are in uploads folder, but need to be saved to media library
    try {
      console.log('💾 Starting to save images to media library...')
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        const imageUrl = image.url || ''
        const imageAlt = image.alt || 'AI Generated Image'
        const imageTitle = image.title || imageAlt
        
        console.log(`💾 Saving image ${i + 1}/${images.length}:`, {
          url: imageUrl.substring(0, 100) + '...',
          title: imageTitle,
          alt: imageAlt
        })
        
        const response = await fetch(`${window.matAdminData.restUrl}save-to-media-library`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': window.matAdminData.nonces.wp_rest,
          },
          body: JSON.stringify({
            image_url: imageUrl,
            alt: imageAlt,
            title: imageTitle
          }),
        })
        
        const data = await response.json()
        if (!data.success) {
          console.error('❌ Failed to save image to media library:', data)
        } else {
          console.log('✅ Image saved to media library:', data.attachment_id)
        }
      }
      
      console.log('✅ All images saved, closing modal and reloading...')
      
      // Close modal
      setIsOpen(false)
      const modal = document.getElementById('mat-image-gen-modal')
      if (modal) {
        modal.style.display = 'none'
      }
      
      // Reload the page to show the new images in media library
      window.location.reload()
    } catch (err) {
      console.error('❌ Error saving images to media library:', err)
      // Still reload the page
      window.location.reload()
    }
  }, [])

  useEffect(() => {
    console.log('MediaLibraryIntegration: useEffect running...')
    
    // Get REST URL and nonce from localized data
    const restUrl = window.matAdminData?.restUrl || window.matPublicData?.restUrl
    const nonce = window.matAdminData?.nonces?.wp_rest || window.matPublicData?.nonces?.wp_rest

    if (!restUrl || !nonce) {
      console.error('MagicAssistant: Missing REST URL or nonce')
      return
    }

    console.log('MagicAssistant: REST URL and nonce found, setting up button...')

    let currentModalElement = null
    let currentIsOpen = false

    // Create button next to "Add Media File" button in header
    const addGenerateButton = () => {
      console.log('addGenerateButton: Looking for header area with Add Media button...')
      
      // Look for the "Add Media" button - it's usually a button with class "page-title-action" or near .page-title-action
      // Or it might be in a .wrap > h1 area
      const addMediaButton = document.querySelector('.page-title-action, a.page-title-action, .wrap h1 .page-title-action')
      console.log('addGenerateButton: Add Media button found?', !!addMediaButton)
      
      if (!addMediaButton) {
        // Try alternative selector - sometimes it's in the h1 directly
        const titleH1 = document.querySelector('.wrap h1')
        if (titleH1) {
          const checkButtons = titleH1.querySelectorAll('a, button')
          const addMediaBtn = Array.from(checkButtons).find(btn => 
            btn.textContent.includes('Add') || btn.classList.contains('page-title-action')
          )
          if (addMediaBtn) {
            addButtonNextTo(addMediaBtn)
            return
          }
        }
        console.log('addGenerateButton: No Add Media button found, will retry')
        return
      }

      addButtonNextTo(addMediaButton)
    }
    
    const addButtonNextTo = (referenceButton) => {
      // Check if button already exists
      if (document.getElementById('mat-generate-image-btn')) {
        console.log('addGenerateButton: Button already exists')
        return
      }

      console.log('addGenerateButton: Creating button...')

      const button = document.createElement('a')
      button.id = 'mat-generate-image-btn'
      button.className = 'page-title-action aria-button-if-js'
      button.setAttribute('role', 'button')
      button.setAttribute('aria-expanded', 'false')
      button.href = '#'
      button.textContent = 'Generate Image'
      button.addEventListener('click', (e) => {
        e.preventDefault()
        openModal()
      })

      // Insert after the reference button (Add Media File button)
      // WordPress typically has the buttons directly after the h1, so we insert after the Add Media button
      if (referenceButton && referenceButton.parentNode) {
        // Check if there's whitespace text node after referenceButton that we should preserve
        const nextSibling = referenceButton.nextSibling
        if (nextSibling && nextSibling.nodeType === 3) {
          // There's a text node (whitespace), insert before it
          referenceButton.parentNode.insertBefore(button, nextSibling)
        } else {
          // Insert after the reference button
          referenceButton.parentNode.insertBefore(button, referenceButton.nextSibling)
        }
        console.log('addGenerateButton: Button inserted after Add Media button')
      } else {
        // Fallback: try to find h1 and append after Add Media button
        const titleH1 = document.querySelector('.wrap h1')
        if (titleH1 && referenceButton) {
          // Insert after the Add Media button
          referenceButton.parentNode.insertBefore(button, referenceButton.nextSibling)
          console.log('addGenerateButton: Button inserted after Add Media button (fallback)')
        }
      }
    }

    // Create modal
    const createModal = () => {
      if (currentModalElement) return

      const modal = document.createElement('div')
      modal.id = 'mat-image-gen-modal'
      modal.style.display = 'none'
      modal.style.position = 'fixed'
      modal.style.top = '0'
      modal.style.left = '0'
      modal.style.width = '100%'
      modal.style.height = '100%'
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
      modal.style.zIndex = '100000'
      modal.style.alignItems = 'center'
      modal.style.justifyContent = 'center'

      const modalContent = document.createElement('div')
      modalContent.style.backgroundColor = 'white'
      modalContent.style.borderRadius = '8px'
      modalContent.style.width = '90%'
      modalContent.style.maxWidth = '600px'
      modalContent.style.maxHeight = '90vh'
      modalContent.style.overflow = 'auto'
      modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)'
      modalContent.style.position = 'relative'

      const closeButton = document.createElement('button')
      closeButton.innerHTML = '&times;'
      closeButton.style.position = 'absolute'
      closeButton.style.top = '10px'
      closeButton.style.right = '15px'
      closeButton.style.background = 'none'
      closeButton.style.border = 'none'
      closeButton.style.fontSize = '30px'
      closeButton.style.cursor = 'pointer'
      closeButton.style.color = '#666'
      closeButton.style.lineHeight = '1'
      closeButton.style.padding = '0'
      closeButton.style.width = '30px'
      closeButton.style.height = '30px'

      const closeModal = () => {
        const modal = document.getElementById('mat-image-gen-modal')
        if (modal) {
          modal.style.display = 'none'
          currentIsOpen = false
        }
      }

      closeButton.addEventListener('click', closeModal)

      modalContent.appendChild(closeButton)

      modal.appendChild(modalContent)
      document.body.appendChild(modal)

      currentModalElement = modalContent
      setModalElement(modalContent)

      // Close on outside click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal()
        }
      })
    }

    const openModal = () => {
      if (!currentModalElement) {
        createModal()
        // Wait a bit for modal to be created
        setTimeout(() => {
          const modal = document.getElementById('mat-image-gen-modal')
          if (modal) {
            modal.style.display = 'flex'
            currentIsOpen = true
            setIsOpen(true)
            // Increment render key to force remount
            if (setRenderKeyRef.current) {
              setRenderKeyRef.current(prev => prev + 1)
            }
          }
        }, 100)
      } else {
        const modal = document.getElementById('mat-image-gen-modal')
        if (modal) {
          modal.style.display = 'flex'
          currentIsOpen = true
          setIsOpen(true)
          // Increment render key to force remount when reopening or switching buttons
          if (setRenderKeyRef.current) {
            setRenderKeyRef.current(prev => prev + 1)
          }
        }
      }
    }

    const closeModal = () => {
      const modal = document.getElementById('mat-image-gen-modal')
      if (modal) {
        modal.style.display = 'none'
        currentIsOpen = false
        setIsOpen(false)
      }
    }

    // Add toolbar buttons for Enhance/Combine
    const addToolbarButtons = () => {
      const toolbarSecondary = document.querySelector('.media-toolbar-secondary')
      if (!toolbarSecondary) return

      // Check if buttons already exist
      if (document.getElementById('mat-enhance-ai-btn') || document.getElementById('mat-combine-ai-btn')) {
        return
      }

      // Enhance button (1 image)
      const enhanceButton = document.createElement('button')
      enhanceButton.id = 'mat-enhance-ai-btn'
      enhanceButton.type = 'button'
      enhanceButton.className = 'button media-button button-primary button-large'
      enhanceButton.textContent = 'Enhance with AI'
      enhanceButton.style.display = 'none' // Hidden by default
      enhanceButton.addEventListener('click', (e) => {
        e.preventDefault()
        openModalWithSelectedImages(1)
      })

      // Combine button (2+ images)
      const combineButton = document.createElement('button')
      combineButton.id = 'mat-combine-ai-btn'
      combineButton.type = 'button'
      combineButton.className = 'button media-button button-primary button-large'
      combineButton.textContent = 'Combine with AI'
      combineButton.style.display = 'none' // Hidden by default
      combineButton.addEventListener('click', (e) => {
        e.preventDefault()
        openModalWithSelectedImages(2)
      })

      // Insert before Cancel button or at the end
      const cancelButton = toolbarSecondary.querySelector('.select-mode-toggle-button')
      if (cancelButton && cancelButton.parentNode) {
        cancelButton.parentNode.insertBefore(enhanceButton, cancelButton)
        cancelButton.parentNode.insertBefore(combineButton, cancelButton)
      } else {
        toolbarSecondary.appendChild(enhanceButton)
        toolbarSecondary.appendChild(combineButton)
      }

      // Watch for selection changes
      const updateButtonVisibility = () => {
        // Get selected attachments from WordPress media library
        let selectedCount = 0
        const selectedAttachments = []

        if (window.wp && window.wp.media && window.wp.media.frame) {
          const frame = window.wp.media.frame
          const selection = frame.state().get('selection')
          if (selection) {
            selectedCount = selection.length || 0
            selection.each((attachment) => {
              const attData = attachment.toJSON()
              selectedAttachments.push({
                id: attData.id,
                url: attData.url,
                name: attData.filename || `image-${attData.id}`,
                type: attData.type || 'image/jpeg'
              })
            })
          }
        }

        // Also check DOM for selected items
        if (selectedCount === 0) {
          const selectedItems = document.querySelectorAll('.attachment.selected, .media-frame .attachment.selected')
          selectedCount = selectedItems.length
          selectedItems.forEach((item) => {
            const data = item.getAttribute('data-id')
            const img = item.querySelector('img')
            if (data && img) {
              selectedAttachments.push({
                id: data,
                url: img.src || img.getAttribute('src'),
                name: `image-${data}`,
                type: 'image/jpeg'
              })
            }
          })
        }

        // Update button visibility
        enhanceButton.style.display = selectedCount === 1 ? 'inline-block' : 'none'
        combineButton.style.display = selectedCount >= 2 ? 'inline-block' : 'none'

        // Store selected attachments for later use
        window.matSelectedAttachments = selectedAttachments
      }

      // Check initially and watch for changes
      updateButtonVisibility()
      
      // Listen to WordPress selection events
      if (window.wp && window.wp.media) {
        document.addEventListener('selectionchange', updateButtonVisibility)
        // Also check periodically in case WordPress updates selection
        setInterval(updateButtonVisibility, 500)
      }
    }

    const openModalWithSelectedImages = (minCount) => {
      const selectedAttachments = window.matSelectedAttachments || []
      
      if (selectedAttachments.length < minCount) {
        alert(`Please select ${minCount} or more image${minCount > 1 ? 's' : ''}`)
        return
      }

      // Store selected images to pass to modal
      window.matModalInitialImages = selectedAttachments
      openModal()
    }

    // Try to add header button on load
    addGenerateButton()

    // Try to add toolbar buttons
    addToolbarButtons()

    // Watch for media library updates (WordPress sometimes reloads the page)
    const observer = new MutationObserver((mutations) => {
      // Check if Add Media button exists but our button doesn't
      const addMediaButton = document.querySelector('.page-title-action, a.page-title-action, .wrap h1 .page-title-action')
      if (addMediaButton && !document.getElementById('mat-generate-image-btn')) {
        addGenerateButton()
      }
      
      // Check if toolbar exists but our buttons don't
      const toolbarSecondary = document.querySelector('.media-toolbar-secondary')
      if (toolbarSecondary && !document.getElementById('mat-enhance-ai-btn')) {
        addToolbarButtons()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
    }
  }, []) // Empty dependency array - only run once on mount

  // Store root instance to properly clean up
  const rootRef = React.useRef(null)
  const containerRef = React.useRef(null)

  // Render MediaLibraryImageGen component when modal is open
  useEffect(() => {
    if (!isOpen || !modalElement) {
      // Clean up when modal closes
      if (rootRef.current && containerRef.current) {
        try {
          rootRef.current.unmount()
        } catch (e) {
          console.warn('Error unmounting root:', e)
        }
        if (containerRef.current && containerRef.current.parentNode) {
          containerRef.current.parentNode.removeChild(containerRef.current)
        }
        rootRef.current = null
        containerRef.current = null
      }
      return
    }

    const restUrl = window.matAdminData?.restUrl || window.matPublicData?.restUrl
    const nonce = window.matAdminData?.nonces?.wp_rest || window.matPublicData?.nonces?.wp_rest

    if (!restUrl || !nonce) {
      console.error('MagicAssistant: Missing REST URL or nonce')
      return
    }

    // Clean up any existing React render first
    if (rootRef.current && containerRef.current) {
      try {
        rootRef.current.unmount()
      } catch (e) {
        console.warn('Error unmounting previous root:', e)
      }
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current)
      }
      rootRef.current = null
      containerRef.current = null
    }

    // Clear any remaining child nodes (except close button) to ensure clean slate
    // Close button is the first child, so we keep it and remove everything else
    while (modalElement.children.length > 1) {
      modalElement.removeChild(modalElement.lastChild)
    }

    // Create a container div inside modalContent
    const container = document.createElement('div')
    modalElement.appendChild(container)
    containerRef.current = container

    // Get initial images if modal was opened with selection
    // Clone the array to avoid reference issues and ensure we have the current value
    let initialImages = null
    if (window.matModalInitialImages && Array.isArray(window.matModalInitialImages) && window.matModalInitialImages.length > 0) {
      initialImages = [...window.matModalInitialImages] // Clone the array
      // Clear it after reading so next render starts fresh
      window.matModalInitialImages = null
    }

    const root = createRoot(container)
    rootRef.current = root
    root.render(
      <MediaLibraryImageGen
        restUrl={restUrl}
        nonce={nonce}
        onImageGenerated={handleImageGenerated}
        initialImages={initialImages}
      />
    )

    return () => {
      // Clean up when modal closes or component unmounts
      if (rootRef.current && containerRef.current) {
        try {
          rootRef.current.unmount()
        } catch (e) {
          console.warn('Error unmounting root in cleanup:', e)
        }
        if (containerRef.current && containerRef.current.parentNode) {
          containerRef.current.parentNode.removeChild(containerRef.current)
        }
        rootRef.current = null
        containerRef.current = null
      }
    }
  }, [isOpen, modalElement, handleImageGenerated, renderKey])

  return null // This component doesn't render anything visible
}

// Initialize when DOM is ready
const initMediaLibraryIntegration = () => {
  console.log('MagicAssistant Media Library: Looking for root element...')
  const rootElement = document.getElementById('mat-media-library-root')
  
  if (!rootElement) {
    console.log('MagicAssistant Media Library: Root element not found, retrying...')
    setTimeout(initMediaLibraryIntegration, 100)
    return
  }

  console.log('MagicAssistant Media Library: Root element found! Initializing...')
  const root = createRoot(rootElement)
  root.render(<MediaLibraryIntegration />)
  console.log('MagicAssistant Media Library: Component rendered!')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMediaLibraryIntegration)
} else {
  // DOM is already ready, but wait a bit for WordPress to finish loading
  setTimeout(initMediaLibraryIntegration, 100)
}

export default MediaLibraryIntegration

