import React, { useState, useEffect } from 'react'

const MediaLibraryImageGen = ({ restUrl, nonce, onImageGenerated, initialImages = null }) => {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [provider, setProvider] = useState('openai')
  const [model, setModel] = useState('gpt-image-2')
  const [size, setSize] = useState('1024x1024')
  const [format, setFormat] = useState('png')
  const [attachedImages, setAttachedImages] = useState([])

  // Load initial images if provided
  useEffect(() => {
    // Reset state when initialImages changes (different button clicked)
    // This ensures the UI updates properly when opening with different buttons
    setAttachedImages([])
    setPrompt('')
    setError(null)
    setIsLoading(false)
    
    if (initialImages && initialImages.length > 0) {
      // Convert image URLs to base64 for API
      const loadImages = async () => {
        const loadedImages = []
        await Promise.all(initialImages.map(async (img) => {
          try {
            const response = await fetch(img.url)
            const blob = await response.blob()
            return new Promise((resolve) => {
              const reader = new FileReader()
              reader.onload = () => {
                loadedImages.push({
                  name: img.name,
                  type: blob.type || 'image/jpeg', // Use blob.type for correct MIME type
                  size: blob.size,
                  content: reader.result, // base64 data URL (already in data:image/xxx;base64,... format)
                  isImage: true
                })
                resolve()
              }
              reader.readAsDataURL(blob)
            })
          } catch (err) {
            console.error('Failed to load image:', err)
          }
        }))
        setAttachedImages(loadedImages)
        
        // Set default prompt based on selection count
        if (initialImages.length === 1) {
          setPrompt('Enhance this image: ')
        } else {
          setPrompt('Combine these images: ')
        }
      }
      loadImages()
    }
  }, [initialImages])

  // Reset model when provider changes (match ChatInterface behavior)
  useEffect(() => {
    if (provider === 'openai') {
      setModel('gpt-image-2')
    } else if (provider === 'google') {
      setModel('gemini-3.1-flash-image')
    }
  }, [provider])

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Prepare request body
      const requestBody = {
        prompt: prompt.trim(),
        provider: provider,
        model: model,
        size: size,
        format: format,
        quality: 'standard',
        style: 'vivid',
      }

      // Add attached files if any, but only include metadata for logging
      if (attachedImages.length > 0) {
        const filesForAPI = attachedImages.map(img => ({
          name: img.name,
          type: img.type,
          size: img.size,
          content: img.content, // base64 data URL
          isImage: true
        }))
        requestBody.attached_files = filesForAPI
        
        // Log without the actual base64 content (too large)
        console.log('📤 MediaLibraryImageGen - Request payload (without base64):', {
          prompt: prompt.trim(),
          provider,
          model,
          size,
          format,
          attached_files_count: filesForAPI.length,
          attached_files_info: filesForAPI.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            content_length: f.content ? f.content.length : 0,
            content_preview: f.content ? f.content.substring(0, 50) : '',
            isImage: f.isImage
          }))
        })
        
        // Calculate approximate size
        const totalSize = filesForAPI.reduce((sum, f) => sum + (f.content ? f.content.length : 0), 0)
        console.log(`📊 Total attached image data size: ~${(totalSize / 1024).toFixed(2)} KB`)
      } else {
        console.log('📤 MediaLibraryImageGen - Request payload:', requestBody)
      }

      const response = await fetch(`${restUrl}generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WP-Nonce': nonce,
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      console.log('📥 MediaLibraryImageGen - Response received:', {
        success: data.success,
        images_count: data.images ? data.images.length : 0,
        has_error: !!data.message,
        error: data.message || null
      })

      if (!data.success) {
        const errorMsg = data.message || data.error || 'Image generation failed'
        console.error('❌ MediaLibraryImageGen - Generation failed:', errorMsg)
        throw new Error(errorMsg)
      }

      // Check if we actually got images
      if (!data.images || data.images.length === 0) {
        console.warn('⚠️ MediaLibraryImageGen - No images in response:', data)
        throw new Error('No images were generated')
      }

      console.log('✅ MediaLibraryImageGen - Success! Generated ' + data.images.length + ' image(s)')

      // Success! Images are now in the uploads folder, but need to be added to media library
      // Call the callback which will save each image to the media library and reload
      if (onImageGenerated) {
        await onImageGenerated(data.images)
      }

      // Reset
      setPrompt('')
      setError(null)
    } catch (err) {
      console.error('Image generation error:', err)
      setError(err.message || 'Failed to generate image')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generateImage()
    }
  }

  return (
    <div className="media-library-image-gen-container" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '10px' }}>
          {attachedImages.length > 0 
            ? (attachedImages.length === 1 ? 'Enhance Image with AI' : 'Combine Images with AI')
            : 'Generate Image with AI'}
        </h2>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
          {attachedImages.length > 0
            ? (attachedImages.length === 1 
                ? 'Enter instructions for enhancing the selected image'
                : 'Enter instructions for combining the selected images')
            : "Enter a description of the image you'd like to generate"}
        </p>
        {attachedImages.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
            <strong>Selected Images ({attachedImages.length}):</strong>
            {initialImages?.map((img, idx) => (
              <div key={idx} style={{ marginTop: '5px', fontSize: '12px' }}>
                • {img.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="e.g., A serene mountain landscape at sunset with vibrant colors..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Provider Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
          Provider
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="google">Google</option>
        </select>
      </div>

      {/* Model Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
          Model
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          {provider === 'openai' && (
            <>
              <option value="gpt-image-2">GPT Image 2 (Latest)</option>
              <option value="gpt-image-1.5">GPT Image 1.5</option>
              <option value="gpt-image-1-mini">GPT Image 1 Mini (Fast)</option>
            </>
          )}
          {provider === 'google' && (
            <>
              <option value="gemini-3-pro-image">Gemini 3 Pro Image (Nano Banana Pro)</option>
              <option value="gemini-3.1-flash-image">Gemini 3.1 Flash Image (Nano Banana 2)</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Nano Banana)</option>
            </>
          )}
        </select>
      </div>

      {/* Size Selection */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
          Size
        </label>
        <select
          value={size}
          onChange={(e) => setSize(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="1024x1024">1024x1024 (Square)</option>
          <option value="1024x1792">1024x1792 (Portrait)</option>
          <option value="1792x1024">1792x1024 (Landscape)</option>
        </select>
      </div>

      {/* Format Selection */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '14px' }}>
          Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={generateImage}
        disabled={isLoading || !prompt.trim()}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: isLoading ? '#999' : '#2271b1',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: isLoading || !prompt.trim() ? 'not-allowed' : 'pointer',
          opacity: isLoading || !prompt.trim() ? 0.6 : 1
        }}
      >
        {isLoading ? 'Generating...' : 'Generate Image'}
      </button>

      {isLoading && (
        <div style={{
          marginTop: '15px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666'
        }}>
          Generating your image...
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #2271b1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 10px;
        }
      `}</style>
    </div>
  )
}

export default MediaLibraryImageGen

