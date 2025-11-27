import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import MediaLibraryImageGen from './components/MediaLibraryImageGen.jsx'


const ImageEditorIntegration = () => {
  const [modalElement, setModalElement] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const [renderKey, setRenderKey] = useState(0)
  const [currentImage, setCurrentImage] = useState(null)
  const setRenderKeyRef = useRef(null)
  setRenderKeyRef.current = setRenderKey

  const handleImageGenerated = useCallback(async (images) => {
    // Get the current attachment ID
    const attachmentId = window.matImageEditorData?.attachmentId
    
    if (!attachmentId) {
      console.error('❌ Missing attachment ID')
      alert('Error: Could not identify the current image. Please try again.')
      return
    }
    
    // Use the first generated image to replace the current attachment
    if (images.length === 0) {
      console.error('❌ No images generated')
      return
    }
    
    const image = images[0]
    const imageUrl = image.url || ''
    const imageAlt = image.alt || 'AI Enhanced Image'
    const imageTitle = image.title || imageAlt
    
    try {
      // Don't save automatically - just prepare the image for preview in editor
      // We'll use the generated image URL directly and let WordPress save it when user clicks "Save Edits"
      
      // Close modal
      setIsOpen(false)
      const modal = document.getElementById('mat-image-editor-modal')
      if (modal) {
        modal.style.display = 'none'
      }
      
      // Define functions first before using them - waitForImageEditor calls loadImageIntoEditor  
      // Note: loadImageIntoEditor must be defined before waitForImageEditor calls it
      const loadImageIntoEditor = (imageUrl, imageAlt, imageTitle) => {
        // This function loads the generated image into WordPress editor state
        const postid = attachmentId
        const imgElement = document.querySelector('#image-preview-0, .imgedit-wrap img, img[id*="image"]')
        
        if (!imgElement) {
          console.error('❌ Could not find image element in editor')
          alert('Could not find the image editor. Please refresh the page.')
          return
        }
        
        // Load the new image URL into the editor
        // WordPress's image editor tracks changes through imgData
        const newImageUrl = imageUrl + '?t=' + Date.now()
        
        // Store the generated image URL so we can save it when user clicks "Save Edits"
        window.matAIEditedImageUrl = imageUrl
        window.matAIEditedImageAlt = imageAlt
        window.matAIEditedImageTitle = imageTitle
        
        // Get the original image URL - try multiple methods
        const getOriginalImageUrl = async () => {
          // Method 1: Try to get from hidden input fields or data attributes in WordPress editor
          const hiddenInput = document.querySelector('input[name="imgedit-settings-0[url]"], input[name*="url"]')
          if (hiddenInput && hiddenInput.value && !hiddenInput.value.includes('admin-ajax.php')) {
            return hiddenInput.value.split('?')[0]
          }
          
          // Method 2: Try to get from img element's data attributes or data-src
          if (imgElement.dataset.src && !imgElement.dataset.src.includes('admin-ajax.php')) {
            return imgElement.dataset.src.split('?')[0]
          }
          
          // Method 3: Check if imgElement has a valid image source (wait a bit if needed)
          let originalSrc = imgElement.src.split('?')[0]
          if (originalSrc && !originalSrc.includes('admin-ajax.php') && !originalSrc.includes('data:')) {
            return originalSrc
          }
          
          // Method 4: Try to get from WordPress imageEdit object
          if (window.imageEdit && window.imageEdit.imgData) {
            if (window.imageEdit.imgData.url && !window.imageEdit.imgData.url.includes('admin-ajax.php')) {
              return window.imageEdit.imgData.url.split('?')[0]
            }
            if (window.imageEdit.imgData.origUrl && !window.imageEdit.imgData.origUrl.includes('admin-ajax.php')) {
              return window.imageEdit.imgData.origUrl.split('?')[0]
            }
          }
          
          // Method 5: Fetch from WordPress REST API using attachment ID
          if (attachmentId) {
            try {
              // Use WordPress core REST API endpoint (not plugin endpoint)
              const wpRestUrl = window.matImageEditorData.restUrl.replace('/magicassistant/v1/', '/wp/v2/')
              const response = await fetch(`${wpRestUrl}media/${attachmentId}`, {
                headers: {
                  'X-WP-Nonce': window.matImageEditorData.nonces.wp_rest,
                },
              })
              if (response.ok) {
                const attachment = await response.json()
                if (attachment && attachment.source_url) {
                  return attachment.source_url.split('?')[0]
                }
              } else {
                console.warn('REST API returned status:', response.status)
              }
            } catch (err) {
              console.warn('⚠️ Could not fetch attachment data:', err)
            }
          }
          
          // Method 6: Wait a bit and check imgElement again (image might be loading)
          if (originalSrc.includes('admin-ajax.php')) {
            await new Promise(resolve => setTimeout(resolve, 200))
            const retrySrc = imgElement.src.split('?')[0]
            if (retrySrc && !retrySrc.includes('admin-ajax.php') && !retrySrc.includes('data:')) {
              return retrySrc
            }
          }
          
          // Last resort: return what we have (might be admin-ajax.php, but we'll handle it)
          return originalSrc
        }
        
        // Create a new image to load
        const newImg = new Image()
        
        // Load the new image and capture original state when it loads
        newImg.onload = async () => {
          // Get original image URL
          const finalOriginalSrc = await getOriginalImageUrl()
          
          const originalWidth = imgElement.naturalWidth || imgElement.width || newImg.width
          const originalHeight = imgElement.naturalHeight || imgElement.height || newImg.height
          
          // Validate original URL
          if (finalOriginalSrc.includes('admin-ajax.php')) {
            console.error('❌ Could not determine valid original image URL')
            alert('Error: Could not find the original image. Please refresh the page and try again.')
            return
          }
          
          // Store original state for undo functionality
          if (!window.matAIOriginalImage) {
            window.matAIOriginalImage = {
              src: finalOriginalSrc,
              width: originalWidth,
              height: originalHeight
            }
          }
          
          // Update the current image source
          imgElement.src = newImageUrl
          
          // Update WordPress's image editor state if available
          if (window.imageEdit) {
            // Try to update imgData if it exists
            if (window.imageEdit.imgData) {
              if (window.imageEdit.imgData.sizer) {
                window.imageEdit.imgData.sizer.src = newImageUrl
              }
              // Store original in imgData
              if (!window.imageEdit.imgData.originalUrl) {
                window.imageEdit.imgData.originalUrl = finalOriginalSrc
              }
              if (!window.imageEdit.imgData.originalState) {
                window.imageEdit.imgData.originalState = {
                  src: finalOriginalSrc,
                  width: originalWidth,
                  height: originalHeight
                }
              }
            }
            
            // Mark as changed to enable save button
            if (typeof window.imageEdit.changed !== 'undefined') {
              window.imageEdit.changed = true
            }
            
            // Initialize history if needed
            if (!window.imageEdit.history) {
              window.imageEdit.history = []
            }
            
            // Add original to history for undo
            const originalState = window.matAIOriginalImage
            const lastHistory = window.imageEdit.history[window.imageEdit.history.length - 1]
            if (!lastHistory || lastHistory.src !== originalState.src) {
              window.imageEdit.history.push({
                src: originalState.src,
                width: originalState.width,
                height: originalState.height,
                type: 'original'
              })
            }
          }
          
          // Store AI-generated image state for redo functionality
          if (!window.matAIEditedImageState) {
            window.matAIEditedImageState = {
              url: newImageUrl.split('?')[0], // Remove cache buster
              src: newImageUrl,
              width: newImg.width,
              height: newImg.height
            }
          }
          
          // Helper function to normalize URLs for comparison
          const normalizeUrl = (url) => {
            if (!url) return ''
            return url.split('?')[0].split('#')[0].trim()
          }
          
          // Helper function to check if current image is AI-generated
          const isCurrentImageAI = () => {
            const currentSrc = normalizeUrl(imgElement.src)
            const aiSrc = normalizeUrl(window.matAIEditedImageState?.url || window.matAIEditedImageState?.src)
            return aiSrc && currentSrc === aiSrc
          }
          
          // Helper function to check if current image is original
          const isCurrentImageOriginal = () => {
            const currentSrc = normalizeUrl(imgElement.src)
            const originalSrc = normalizeUrl(window.matAIOriginalImage?.src)
            return originalSrc && currentSrc === originalSrc
          }
          
          // Hook into undo button to restore original image
          const undoButton = document.getElementById('image-undo-' + postid)
          const redoButton = document.getElementById('image-redo-' + postid)
          
          if (undoButton && !undoButton.hasAttribute('data-mat-ai-undo-hooked')) {
            undoButton.setAttribute('data-mat-ai-undo-hooked', 'true')
            
            undoButton.addEventListener('click', (e) => {
              // Only handle if we have AI state and are currently showing AI image
              if (window.matAIEditedImageState && window.matAIOriginalImage && isCurrentImageAI()) {
                // Prevent WordPress's default undo behavior
                e.preventDefault()
                e.stopPropagation()
                e.stopImmediatePropagation()
                
                const originalState = window.matAIOriginalImage
                
                // Restore original image
                imgElement.src = originalState.src
                if (window.imageEdit && window.imageEdit.imgData && window.imageEdit.imgData.sizer) {
                  window.imageEdit.imgData.sizer.src = originalState.src
                }
                
                // Mark that we're now showing original (but keep AI state for redo)
                window.matAICurrentState = 'original'
                
                // Update editor state
                if (window.imageEdit && typeof window.imageEdit.changed !== 'undefined') {
                  window.imageEdit.changed = true // Still changed from original
                }
                
                // Enable redo button
                if (redoButton) {
                  redoButton.disabled = false
                  redoButton.classList.remove('disabled')
                }
                
                // Keep save button enabled (user can still save the original if they want)
                const saveBtn = document.querySelector('.imgedit-submit-btn')
                if (saveBtn) {
                  saveBtn.disabled = false
                }
                
                // Force a repaint to ensure image updates
                imgElement.style.display = 'none'
                imgElement.offsetHeight // Trigger reflow
                imgElement.style.display = ''
              }
            }, true) // Use capture phase to run before WordPress's handler
          }
          
          // Hook into redo button to restore AI-generated image
          if (redoButton && !redoButton.hasAttribute('data-mat-ai-redo-hooked')) {
            redoButton.setAttribute('data-mat-ai-redo-hooked', 'true')
            
            redoButton.addEventListener('click', (e) => {
              // Only handle if we have AI state and are currently showing original image
              if (window.matAIEditedImageState && window.matAIOriginalImage && isCurrentImageOriginal()) {
                // Prevent WordPress's default redo behavior
                e.preventDefault()
                e.stopPropagation()
                e.stopImmediatePropagation()
                
                const aiState = window.matAIEditedImageState
                
                // Restore AI-generated image
                const aiImageUrl = aiState.src || aiState.url + '?t=' + Date.now()
                imgElement.src = aiImageUrl
                if (window.imageEdit && window.imageEdit.imgData && window.imageEdit.imgData.sizer) {
                  window.imageEdit.imgData.sizer.src = aiImageUrl
                }
                
                // Mark that we're now showing AI version
                window.matAICurrentState = 'ai'
                
                // Update editor state
                if (window.imageEdit && typeof window.imageEdit.changed !== 'undefined') {
                  window.imageEdit.changed = true
                }
                
                // Disable redo button (we're at the latest state)
                redoButton.disabled = true
                redoButton.classList.add('disabled')
                
                // Force a repaint to ensure image updates
                imgElement.style.display = 'none'
                imgElement.offsetHeight // Trigger reflow
                imgElement.style.display = ''
              }
            }, true) // Use capture phase to run before WordPress's handler
          }
          
          // Mark current state as AI-generated
          window.matAICurrentState = 'ai'
          
          // Enable the undo button (can undo to original)
          if (undoButton) {
            undoButton.disabled = false
            undoButton.classList.remove('disabled')
          }
          
          // Disable redo button (we're at the latest state)
          if (redoButton) {
            redoButton.disabled = true
            redoButton.classList.add('disabled')
          }
          
          // Enable the save button since there are changes
          const saveButton = document.querySelector('.imgedit-submit-btn')
          if (saveButton) {
            saveButton.disabled = false
          }
        }
        
        newImg.onerror = () => {
          console.error('❌ Failed to load new image')
          alert('Failed to load the generated image. Please try again.')
        }
        
        newImg.src = newImageUrl
        
        // Hook up save button interception (do this once, not per image load)
        setTimeout(() => {
          const saveButton = document.querySelector('.imgedit-submit-btn')
          if (saveButton && !saveButton.hasAttribute('data-mat-ai-hooked')) {
            saveButton.setAttribute('data-mat-ai-hooked', 'true')
            
            // Store original onclick handler if it exists
            const originalOnClick = saveButton.onclick
            
            saveButton.addEventListener('click', async (e) => {
              // Get current image element to check state
              const currentImgElement = document.querySelector('#image-preview-0, .imgedit-wrap img, img[id*="image"]')
              
              // Check if we have AI image state
              if (window.matAIEditedImageState || window.matAIEditedImageUrl) {
                // Determine which image to save based on current state
                const currentSrc = currentImgElement ? currentImgElement.src.split('?')[0] : ''
                const aiSrc = window.matAIEditedImageState?.url
                const originalSrc = window.matAIOriginalImage?.src
                
                // If we're showing the original (user clicked undo), let WordPress handle it normally
                // WordPress will save the current state as-is
                if (currentSrc === originalSrc) {
                  // Let WordPress handle saving the current state
                  if (originalOnClick) {
                    originalOnClick.call(saveButton, e)
                  }
                  return
                }
                
                // We're saving the AI-generated version (current state is AI image)
                if (currentSrc === aiSrc || window.matAICurrentState === 'ai') {
                  e.preventDefault()
                  e.stopPropagation()
                  
                  // Show loading state
                  const originalText = saveButton.textContent
                  saveButton.disabled = true
                  saveButton.textContent = 'Saving...'
                  
                  try {
                    // Get the AI image URL (use stored state or fallback)
                    const imageUrlToSave = window.matAIEditedImageUrl || window.matAIEditedImageState?.url
                    
                    // Save the AI-generated image
                    const response = await fetch(`${window.matImageEditorData.restUrl}replace-attachment`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-WP-Nonce': window.matImageEditorData.nonces.wp_rest,
                      },
                      body: JSON.stringify({
                        attachment_id: attachmentId,
                        image_url: imageUrlToSave,
                        alt: window.matAIEditedImageAlt || imageAlt,
                        title: window.matAIEditedImageTitle || imageTitle
                      }),
                    })
                    
                    const data = await response.json()
                    if (!data.success) {
                      console.error('❌ Failed to save AI-generated image:', data)
                      alert('Error: ' + (data.message || 'Failed to save the image. Please try again.'))
                      saveButton.disabled = false
                      saveButton.textContent = originalText
                    return
                  }
                  
                  // Clear all stored state (image is now saved)
                    delete window.matAIEditedImageUrl
                    delete window.matAIEditedImageAlt
                    delete window.matAIEditedImageTitle
                    delete window.matAIEditedImageState
                    delete window.matAIOriginalImage
                    delete window.matAICurrentState
                    
                    // Reload to show saved image
                    window.location.reload()
                  } catch (err) {
                    console.error('❌ Error saving AI-generated image:', err)
                    alert('Error: ' + (err.message || 'Failed to save the image. Please try again.'))
                    saveButton.disabled = false
                    saveButton.textContent = originalText
                  }
                } else {
                  // Unknown state, let WordPress handle it
                  if (originalOnClick) {
                    originalOnClick.call(saveButton, e)
                  }
                }
              } else {
                // No AI image state, let WordPress handle it normally
                if (originalOnClick) {
                  originalOnClick.call(saveButton, e)
                }
              }
            }, { once: false })
          }
        }, 100)
      }
      
      const waitForImageEditor = (maxAttempts = 20) => {
        if (!imageUrl) {
          console.error('No image URL provided')
          alert('No image URL provided. Please try again.')
          return
        }
        
        // Check if image editor is available - try multiple ways
        const imgElement = document.querySelector('#image-preview-0, .imgedit-wrap img, img[id*="image"]')
        
        if (!imgElement) {
          if (maxAttempts > 0) {
            setTimeout(() => waitForImageEditor(maxAttempts - 1), 100)
            return
          } else {
            console.error('Image element not found after waiting')
            alert('Image editor not ready. Please refresh the page and try again.')
            return
          }
        }
        
        // Editor is ready, proceed
        loadImageIntoEditor(imageUrl, imageAlt, imageTitle)
      }
      
      // Start the process - call waitForImageEditor to begin
      waitForImageEditor()
    } catch (err) {
      console.error('❌ Error loading image into editor:', err)
      alert('Error: ' + (err.message || 'Failed to load the image. Please try again.'))
    }
  }, [])

  useEffect(() => {
    // Get REST URL and nonce from localized data
    const restUrl = window.matImageEditorData?.restUrl
    const nonce = window.matImageEditorData?.nonces?.wp_rest
    const attachmentId = window.matImageEditorData?.attachmentId

    if (!restUrl || !nonce) {
      console.error('MagicAssistant: Missing REST URL or nonce')
      return
    }

    if (!attachmentId) {
      console.error('MagicAssistant: Missing attachment ID')
      return
    }

    let currentModalElement = null
    let currentIsOpen = false

    // Get current image info from the page
    const getImageInfo = () => {
      // Try to get the image URL from the WordPress attachment data
      const imageElement = document.querySelector('#image-preview-0, .imgedit-wrap img, img[id*="image"]')
      
      if (imageElement) {
        const imageSrc = imageElement.src
        const imageAlt = imageElement.alt || 'Image'
        const imageName = imageAlt || `attachment-${attachmentId}`
        
        return {
          id: attachmentId,
          url: imageSrc,
          name: imageName,
          type: 'image/jpeg'
        }
      }
      
      // Fallback: try to get from WordPress media editor data
      if (window.imageEdit && window.imageEdit.imgData) {
        const imgData = window.imageEdit.imgData
        return {
          id: attachmentId,
          url: imgData.sizer?.src || '',
          name: `attachment-${attachmentId}`,
          type: 'image/jpeg'
        }
      }
      
      return null
    }

    // Create button next to edit tools
    const addEditWithAIButton = () => {
      // Check if button already exists first
      if (document.getElementById('mat-edit-with-ai-btn')) {
        return
      }
      
      // Look for the submit/action buttons container (Undo, Redo, Cancel, Save)
      const submitContainer = document.querySelector('.imgedit-submit')
      
      if (!submitContainer) {
        return
      }

      const button = document.createElement('button')
      button.id = 'mat-edit-with-ai-btn'
      button.type = 'button'
      button.className = 'button button-primary'
      button.style.marginRight = '5px'
      button.textContent = 'Edit with AI'
      button.addEventListener('click', (e) => {
        e.preventDefault()
        const imageInfo = getImageInfo()
        if (imageInfo) {
          setCurrentImage(imageInfo)
          openModal()
        } else {
          alert('Could not detect the current image. Please try again.')
        }
      })

      // Insert before the Cancel Editing button
      const cancelButton = submitContainer.querySelector('.imgedit-cancel-btn')
      if (cancelButton) {
        submitContainer.insertBefore(button, cancelButton)
      } else {
        // Fallback: append to container
        submitContainer.appendChild(button)
      }
    }

    // Create modal
    const createModal = () => {
      if (currentModalElement) return

      const modal = document.createElement('div')
      modal.id = 'mat-image-editor-modal'
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
        const modal = document.getElementById('mat-image-editor-modal')
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
          const modal = document.getElementById('mat-image-editor-modal')
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
        const modal = document.getElementById('mat-image-editor-modal')
        if (modal) {
          modal.style.display = 'flex'
          currentIsOpen = true
          setIsOpen(true)
          // Increment render key to force remount
          if (setRenderKeyRef.current) {
            setRenderKeyRef.current(prev => prev + 1)
          }
        }
      }
    }

    // Try to add button on load
    addEditWithAIButton()

    // Watch for page updates (WordPress sometimes loads content dynamically)
    const observer = new MutationObserver((mutations) => {
      // Check if submit container exists but our button doesn't
      const submitContainer = document.querySelector('.imgedit-submit')
      if (submitContainer && !document.getElementById('mat-edit-with-ai-btn')) {
        addEditWithAIButton()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => {
      observer.disconnect()
    }
  }, [])

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

    const restUrl = window.matImageEditorData?.restUrl
    const nonce = window.matImageEditorData?.nonces?.wp_rest

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

    // Clear any remaining child nodes (except close button)
    while (modalElement.children.length > 1) {
      modalElement.removeChild(modalElement.lastChild)
    }

    // Create a container div inside modalContent
    const container = document.createElement('div')
    modalElement.appendChild(container)
    containerRef.current = container

    // Prepare initial images array if we have current image
    let initialImages = null
    if (currentImage) {
      initialImages = [currentImage]
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
  }, [isOpen, modalElement, handleImageGenerated, renderKey, currentImage])

  return null // This component doesn't render anything visible
}

// Store root instance to avoid creating multiple roots
let rootInstance = null

// Initialize when DOM is ready
const initImageEditorIntegration = () => {
  const rootElement = document.getElementById('mat-image-editor-root')
  
  if (!rootElement) {
    setTimeout(initImageEditorIntegration, 100)
    return
  }

  // Reuse existing root if it exists, otherwise create a new one
  if (!rootInstance) {
    rootInstance = createRoot(rootElement)
  }
  
  rootInstance.render(<ImageEditorIntegration />)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initImageEditorIntegration)
} else {
  // DOM is already ready, but wait a bit for WordPress to finish loading
  setTimeout(initImageEditorIntegration, 100)
}

export default ImageEditorIntegration

