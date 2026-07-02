import { useState, useEffect, useCallback } from 'react'
import {
  IMAGE_ORIENTATIONS,
  searchUnsplashImages,
  analyzeImageContext,
  trackUnsplashDownload,
  formatUnsplashAttribution
} from '../utils/imageEnhancementService'
import {
  getElementImageUrl,
  getElementDisplayName,
  isPlaceholderImage
} from '../utils/bricksImageUtils'

/**
 * Loading spinner component
 */
const LoadingSpinner = ({ message = 'Searching images...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '3px solid #e5e7eb',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ marginTop: '16px', color: '#6b7280', fontSize: '14px' }}>{message}</p>
  </div>
)

/**
 * Image thumbnail component with loading state
 */
const ImageThumbnail = ({ image, isSelected, onClick }) => {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        aspectRatio: '4/3',
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: isSelected ? '3px solid #3b82f6' : '2px solid transparent',
        backgroundColor: image.color || '#f3f4f6',
        transition: 'all 0.15s ease'
      }}
    >
      {!loaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: image.color || '#f3f4f6'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e5e7eb',
            borderTopColor: '#9ca3af',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      )}
      <img
        src={image.thumbUrl || image.url}
        alt={image.altDescription || image.description || 'Unsplash image'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        onLoad={() => setLoaded(true)}
      />
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: '#3b82f6',
          borderRadius: '50%',
          padding: '4px',
          display: 'flex'
        }}>
          <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </div>
      )}
    </div>
  )
}

/**
 * Image Enhancement Modal Component
 */
const ImageEnhancementModal = ({
  isOpen,
  onClose,
  elements = [],
  onApply
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestedQuery, setSuggestedQuery] = useState('')
  const [orientation, setOrientation] = useState('landscape')
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [selectedImages, setSelectedImages] = useState({}) // elementId -> selected image
  const [currentElementIndex, setCurrentElementIndex] = useState(0)

  // Current element being replaced
  const currentElement = elements[currentElementIndex]

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && elements.length > 0) {
      setCurrentElementIndex(0)
      setResults([])
      setSelectedImages({})
      setError(null)
      setSearchQuery('')
      setSuggestedQuery('')

      // Analyze context for search suggestion
      analyzeContext()
    }
  }, [isOpen, elements])

  // Analyze image context for search suggestions
  const analyzeContext = useCallback(async () => {
    if (!elements.length) return

    setIsAnalyzing(true)
    try {
      // Get site context
      const siteContext = {
        title: document.title || '',
        description: document.querySelector('meta[name="description"]')?.content || ''
      }

      // Analyze the first element's context
      const suggestion = await analyzeImageContext(elements[0], siteContext)
      setSuggestedQuery(suggestion)
      setSearchQuery(suggestion)
    } catch (err) {
      console.warn('Context analysis failed:', err)
      setSuggestedQuery('professional business')
      setSearchQuery('professional business')
    } finally {
      setIsAnalyzing(false)
    }
  }, [elements])

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      const images = await searchUnsplashImages(searchQuery.trim(), {
        per_page: 12,
        orientation
      })

      if (images.length === 0) {
        setError('No images found. Try a different search term.')
      } else {
        setResults(images)
      }
    } catch (err) {
      setError(err.message || 'Failed to search images')
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, orientation])

  // Handle image selection
  const selectImage = (image) => {
    if (!currentElement) return

    setSelectedImages(prev => ({
      ...prev,
      [currentElement.id]: image
    }))
  }

  // State for saving progress
  const [isSaving, setIsSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 })

  // Handle applying selected images - saves to media library first
  const handleApply = async () => {
    const selectedEntries = Object.entries(selectedImages)
    if (selectedEntries.length === 0) return

    setIsSaving(true)
    setSaveProgress({ current: 0, total: selectedEntries.length })

    const imagesToApply = []
    const pluginData = window.magicAssistantAdmin || window.magicaAdminData || window.magicaPublicData || window.magicAssistantData

    for (let i = 0; i < selectedEntries.length; i++) {
      const [elementId, selectedImage] = selectedEntries[i]
      setSaveProgress({ current: i + 1, total: selectedEntries.length })

      try {
        // Get the best quality URL for saving (prefer full, then regular)
        const imageUrlToSave = selectedImage.fullUrl || selectedImage.url

        if (!imageUrlToSave) {
          console.error('No URL found for image:', selectedImage)
          continue
        }

        // Save to WordPress media library via existing endpoint
        const saveResponse = await fetch(`${pluginData.restUrl}unsplash-save-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': pluginData.nonces?.wp_rest || '',
          },
          body: JSON.stringify({
            image_url: imageUrlToSave,
            download_location: selectedImage.downloadLocation || '',
            title: selectedImage.altDescription || selectedImage.description || 'Unsplash Image',
            alt: selectedImage.altDescription || selectedImage.description || formatUnsplashAttribution(selectedImage),
            photographer: selectedImage.photographer || '',
            unsplash_id: selectedImage.id || ''
          })
        })

        const saveData = await saveResponse.json()

        if (saveResponse.ok && saveData.success) {
          // Image saved to media library - use attachment ID and local URL
          imagesToApply.push({
            elementId,
            imageData: {
              id: saveData.attachment_id,
              url: saveData.url,
              filename: saveData.url.split('/').pop(),
              external: false, // Not external - it's in the media library now
              altText: selectedImage.altDescription || selectedImage.description || formatUnsplashAttribution(selectedImage)
            }
          })
        } else {
          console.error('Failed to save image to media library:', saveData)
          // Fallback to external URL if save fails
          imagesToApply.push({
            elementId,
            imageData: {
              url: imageUrlToSave,
              filename: `unsplash-${selectedImage.id}.jpg`,
              external: true,
              altText: selectedImage.altDescription || selectedImage.description || formatUnsplashAttribution(selectedImage)
            }
          })
        }
      } catch (error) {
        console.error('Error saving image:', error)
        // Fallback to external URL on error
        const imageUrl = selectedImage.fullUrl || selectedImage.url
        if (imageUrl) {
          imagesToApply.push({
            elementId,
            imageData: {
              url: imageUrl,
              filename: `unsplash-${selectedImage.id}.jpg`,
              external: true,
              altText: selectedImage.altDescription || selectedImage.description || formatUnsplashAttribution(selectedImage)
            }
          })
        }
      }
    }

    setIsSaving(false)

    if (imagesToApply.length > 0 && onApply) {
      onApply(imagesToApply)
    }

    onClose()
  }

  // Navigate to next element (for multi-element replacement)
  const goToNextElement = () => {
    if (currentElementIndex < elements.length - 1) {
      setCurrentElementIndex(prev => prev + 1)
    }
  }

  // Navigate to previous element
  const goToPrevElement = () => {
    if (currentElementIndex > 0) {
      setCurrentElementIndex(prev => prev - 1)
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading && !isSaving) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, isLoading])

  // Handle Enter key for search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSearch()
    }
  }

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading && !isSaving) {
      onClose()
    }
  }

  if (!isOpen) return null

  const currentImageUrl = currentElement ? getElementImageUrl(currentElement) : ''
  const isCurrentPlaceholder = isPlaceholderImage(currentImageUrl)
  const selectedImage = currentElement ? selectedImages[currentElement.id] : null
  const hasSelectedImages = Object.keys(selectedImages).length > 0

  // Inline styles
  const backdropStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 999999
  }

  const modalContainerStyles = {
    position: 'relative',
    padding: '16px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    overflowY: 'auto'
  }

  const modalStyles = {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  }

  return (
    <div style={backdropStyles} onClick={handleBackdropClick}>
      <div style={modalContainerStyles}>
        <div style={modalStyles}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '24px', height: '24px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Replace Image with AI
              </h3>
              {elements.length > 1 && (
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  ({currentElementIndex + 1} of {elements.length})
                </span>
              )}
            </div>
            <button
              type="button"
              style={{
                color: '#9ca3af',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={onClose}
              disabled={isLoading}
            >
              <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Current Image Preview */}
            {currentElement && (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                {/* Original Image */}
                <div style={{ flex: '0 0 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                    Current Image
                  </label>
                  <div style={{
                    width: '200px',
                    height: '150px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb'
                  }}>
                    {currentImageUrl ? (
                      <img
                        src={currentImageUrl}
                        alt={getElementDisplayName(currentElement)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                        No image
                      </div>
                    )}
                  </div>
                  {isCurrentPlaceholder && (
                    <span style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                      Placeholder detected
                    </span>
                  )}
                </div>

                {/* Selected Image Preview */}
                <div style={{ flex: '0 0 200px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                    Selected Replacement
                  </label>
                  <div style={{
                    width: '200px',
                    height: '150px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f0fdf4',
                    border: selectedImage ? '2px solid #22c55e' : '1px dashed #d1d5db'
                  }}>
                    {selectedImage ? (
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.altDescription || 'Selected image'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', textAlign: 'center', padding: '16px' }}>
                        Select an image from search results
                      </div>
                    )}
                  </div>
                  {selectedImage && (
                    <span style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px', display: 'block' }}>
                      by {selectedImage.photographer}
                    </span>
                  )}
                </div>

                {/* Element Info */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                    Element
                  </label>
                  <div style={{ fontSize: '14px', color: '#374151' }}>
                    {getElementDisplayName(currentElement)}
                  </div>
                </div>
              </div>
            )}

            {/* Search Controls */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              {/* Search Input */}
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Search Unsplash
                  {isAnalyzing && <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>(analyzing context...)</span>}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., modern office, nature landscape"
                  disabled={isLoading || isAnalyzing}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {suggestedQuery && suggestedQuery !== searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery(suggestedQuery)}
                    style={{
                      fontSize: '12px',
                      color: '#3b82f6',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      marginTop: '4px',
                      textDecoration: 'underline'
                    }}
                  >
                    Use AI suggestion: "{suggestedQuery}"
                  </button>
                )}
              </div>

              {/* Orientation Select */}
              <div style={{ flex: '0 0 140px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                  Orientation
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: '#fff'
                  }}
                >
                  {IMAGE_ORIENTATIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Button */}
              <button
                type="button"
                onClick={handleSearch}
                disabled={isLoading || !searchQuery.trim()}
                style={{
                  padding: '8px 20px',
                  backgroundColor: isLoading || !searchQuery.trim() ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </button>
            </div>

            {/* Loading State */}
            {isLoading && <LoadingSpinner />}

            {/* Error State */}
            {error && (
              <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Results Grid */}
            {results.length > 0 && !isLoading && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Select an image ({results.length} results)
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '4px'
                }}>
                  {results.map((image) => (
                    <ImageThumbnail
                      key={image.id}
                      image={image}
                      isSelected={selectedImage?.id === image.id}
                      onClick={() => selectImage(image)}
                    />
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '8px' }}>
                  Photos provided by <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Unsplash</a>
                </div>
              </div>
            )}

            {/* Multi-element navigation */}
            {elements.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <button
                  type="button"
                  onClick={goToPrevElement}
                  disabled={currentElementIndex === 0}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: currentElementIndex === 0 ? '#f3f4f6' : '#fff',
                    color: currentElementIndex === 0 ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: currentElementIndex === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Previous
                </button>
                <span style={{ padding: '6px 12px', color: '#6b7280', fontSize: '13px' }}>
                  {elements.map((el, idx) => (
                    <span
                      key={el.id}
                      onClick={() => setCurrentElementIndex(idx)}
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: idx === currentElementIndex ? '#3b82f6' : selectedImages[el.id] ? '#22c55e' : '#d1d5db',
                        margin: '0 4px',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={goToNextElement}
                  disabled={currentElementIndex === elements.length - 1}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: currentElementIndex === elements.length - 1 ? '#f3f4f6' : '#fff',
                    color: currentElementIndex === elements.length - 1 ? '#9ca3af' : '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: currentElementIndex === elements.length - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{ padding: '8px 16px', color: '#374151', backgroundColor: '#f3f4f6', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasSelectedImages || isSaving}
              style={{
                padding: '8px 16px',
                backgroundColor: (!hasSelectedImages || isSaving) ? '#9ca3af' : '#2563eb',
                color: '#ffffff',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                cursor: (!hasSelectedImages || isSaving) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSaving ? (
                <>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Saving {saveProgress.current}/{saveProgress.total}...
                </>
              ) : (
                <>Apply {Object.keys(selectedImages).length > 0 ? `(${Object.keys(selectedImages).length})` : ''} Image{Object.keys(selectedImages).length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

ImageEnhancementModal.displayName = 'ImageEnhancementModal'

export default ImageEnhancementModal
