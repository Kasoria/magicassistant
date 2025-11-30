import { useState, useEffect, useCallback } from 'react'
import {
  ENHANCEMENT_TYPES,
  TRANSLATION_LANGUAGES,
  REWRITE_TONES,
  enhanceMultipleTexts,
  getRequiredOption
} from '../utils/textEnhancementService'
import { stripHtmlTags, containsDynamicTags, getWordCount } from '../utils/bricksTextUtils'

/**
 * Icon components for enhancement types
 */
const EnhancementIcons = {
  'check-circle': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'compress': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  'expand': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  'briefcase': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'smile': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'lightbulb': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  'globe': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'edit': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  'wand': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

/**
 * Simple diff view component
 */
const DiffView = ({ original, enhanced }) => {
  if (!original || !enhanced) return null

  const originalPlain = stripHtmlTags(original)
  const enhancedPlain = stripHtmlTags(enhanced)

  return (
    <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#dc2626', display: 'block', marginBottom: '4px' }}>Original</span>
        <span style={{ textDecoration: 'line-through', color: '#b91c1c' }}>{originalPlain}</span>
      </div>
      <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#16a34a', display: 'block', marginBottom: '4px' }}>Enhanced</span>
        <span style={{ color: '#15803d' }}>{enhancedPlain}</span>
      </div>
    </div>
  )
}

/**
 * Loading spinner component
 */
const LoadingSpinner = () => (
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
    <p style={{ marginTop: '16px', color: '#6b7280', fontSize: '14px' }}>Enhancing your text...</p>
  </div>
)

/**
 * Text Enhancement Modal Component
 */
const TextEnhancementModal = ({
  isOpen,
  onClose,
  elements = [],
  onApply
}) => {
  // State
  const [selectedType, setSelectedType] = useState(null)
  const [targetLanguage, setTargetLanguage] = useState('es')
  const [rewriteTone, setRewriteTone] = useState('professional')
  const [customPrompt, setCustomPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [editedResults, setEditedResults] = useState({})
  const [selectedForApply, setSelectedForApply] = useState({})

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedType(null)
      setResults([])
      setEditedResults({})
      setError(null)
      // Initialize selection - all elements selected by default
      const initialSelection = {}
      elements.forEach(el => {
        initialSelection[el.id] = true
      })
      setSelectedForApply(initialSelection)
    }
  }, [isOpen, elements])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
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

  // Handle enhancement type selection
  const handleTypeSelect = useCallback(async (typeId) => {
    const requiredOption = getRequiredOption(typeId)

    // If type requires options, just select it (don't run yet)
    if (requiredOption) {
      setSelectedType(typeId)
      setResults([])
      setError(null)
      return
    }

    // Run enhancement immediately for types without options
    await runEnhancement(typeId)
  }, [elements])

  // Run the enhancement
  const runEnhancement = useCallback(async (typeId, options = {}) => {
    setSelectedType(typeId)
    setIsLoading(true)
    setError(null)
    setResults([])

    try {
      // Prepare texts from elements
      const texts = elements.map(el => ({
        id: el.id,
        text: el.settings?.text || '',
        label: el.label || el.name || 'Element'
      }))

      // Build options based on type
      const enhancementOptions = { ...options }
      if (typeId === 'translate') {
        enhancementOptions.targetLanguage = targetLanguage
      } else if (typeId === 'rewrite') {
        enhancementOptions.tone = rewriteTone
      } else if (typeId === 'custom') {
        enhancementOptions.customPrompt = customPrompt
      }

      // Call enhancement service
      const enhancedTexts = await enhanceMultipleTexts(texts, typeId, enhancementOptions)

      setResults(enhancedTexts)

      // Initialize edited results with enhanced texts
      const edited = {}
      enhancedTexts.forEach(r => {
        edited[r.id] = r.enhancedText
      })
      setEditedResults(edited)

    } catch (err) {
      setError(err.message || 'Failed to enhance text')
    } finally {
      setIsLoading(false)
    }
  }, [elements, targetLanguage, rewriteTone, customPrompt])

  // Handle running enhancement with options
  const handleRunWithOptions = useCallback(() => {
    if (selectedType === 'custom' && !customPrompt.trim()) {
      setError('Please enter a custom prompt')
      return
    }
    runEnhancement(selectedType)
  }, [selectedType, customPrompt, runEnhancement])

  // Handle applying results
  const handleApply = useCallback(() => {
    const textsToApply = []

    elements.forEach(el => {
      if (selectedForApply[el.id] && editedResults[el.id]) {
        textsToApply.push({
          elementId: el.id,
          newText: editedResults[el.id]
        })
      }
    })

    if (textsToApply.length > 0 && onApply) {
      onApply(textsToApply)
    }

    onClose()
  }, [elements, selectedForApply, editedResults, onApply, onClose])

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  // Toggle element selection
  const toggleElementSelection = (elementId) => {
    setSelectedForApply(prev => ({
      ...prev,
      [elementId]: !prev[elementId]
    }))
  }

  // Update edited result
  const updateEditedResult = (elementId, newText) => {
    setEditedResults(prev => ({
      ...prev,
      [elementId]: newText
    }))
  }

  // Reset to try different enhancement
  const handleTryDifferent = () => {
    setSelectedType(null)
    setResults([])
    setError(null)
  }

  if (!isOpen) return null

  // Check for warnings
  const warnings = []
  elements.forEach(el => {
    const text = el.settings?.text || ''
    if (containsDynamicTags(text)) {
      warnings.push(`"${el.label || el.name}" contains dynamic data tags that will be treated as literal text`)
    }
    const wordCount = getWordCount(text)
    if (wordCount > 2000) {
      warnings.push(`"${el.label || el.name}" is very long (${wordCount} words) - results may be truncated`)
    }
  })

  const hasResults = results.length > 0
  const showOptionsPanel = selectedType && getRequiredOption(selectedType) && !hasResults

  // Inline styles for critical positioning (ensures visibility regardless of Tailwind loading)
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
    maxWidth: '768px',
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
    <div
      style={backdropStyles}
      onClick={handleBackdropClick}
    >
      <div style={modalContainerStyles}>
        <div style={modalStyles}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg style={{ width: '24px', height: '24px', color: '#3b82f6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>
                Enhance with AI
              </h3>
              {elements.length > 1 && (
                <span style={{ fontSize: '14px', color: '#6b7280' }}>
                  ({elements.length} elements)
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
            {/* Warnings */}
            {warnings.length > 0 && (
              <div style={{ padding: '12px', backgroundColor: '#fefce8', borderRadius: '8px', border: '1px solid #fef08a' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <svg style={{ width: '20px', height: '20px', color: '#ca8a04', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div style={{ fontSize: '14px', color: '#a16207' }}>
                    {warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </div>
                </div>
              </div>
            )}

            {/* Original Text Preview */}
            {!hasResults && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Original Text
                </label>
                <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px', maxHeight: '128px', overflowY: 'auto' }}>
                  {elements.map((el, index) => (
                    <div key={el.id} style={index > 0 ? { marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' } : {}}>
                      {elements.length > 1 && (
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                          {el.label || el.name}
                        </span>
                      )}
                      <p style={{ color: '#1f2937', fontSize: '14px', margin: 0 }}>
                        {stripHtmlTags(el.settings?.text) || <em style={{ color: '#9ca3af' }}>No text content</em>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enhancement Type Selection */}
            {!isLoading && !hasResults && (
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                  Choose Enhancement
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {Object.values(ENHANCEMENT_TYPES).map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => handleTypeSelect(type.id)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        borderRadius: '8px',
                        border: selectedType === type.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                        backgroundColor: selectedType === type.id ? '#eff6ff' : '#ffffff',
                        color: selectedType === type.id ? '#1d4ed8' : '#374151',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedType !== type.id) {
                          e.currentTarget.style.borderColor = '#93c5fd'
                          e.currentTarget.style.backgroundColor = '#f9fafb'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedType !== type.id) {
                          e.currentTarget.style.borderColor = '#e5e7eb'
                          e.currentTarget.style.backgroundColor = '#ffffff'
                        }
                      }}
                    >
                      <span style={{ marginBottom: '4px', width: '20px', height: '20px' }}>
                        {EnhancementIcons[type.icon]}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options Panel for types that need additional input */}
            {showOptionsPanel && (
              <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedType === 'translate' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                      Target Language
                    </label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#ffffff', color: '#111827', fontSize: '14px' }}
                    >
                      {TRANSLATION_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedType === 'rewrite' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                      Tone / Style
                    </label>
                    <select
                      value={rewriteTone}
                      onChange={(e) => setRewriteTone(e.target.value)}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#ffffff', color: '#111827', fontSize: '14px' }}
                    >
                      {REWRITE_TONES.map((tone) => (
                        <option key={tone.id} value={tone.id}>
                          {tone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedType === 'custom' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '4px' }}>
                      Your Instructions
                    </label>
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g., Make it sound more exciting and add a call to action"
                      rows={3}
                      style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#ffffff', color: '#111827', fontSize: '14px', resize: 'vertical' }}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRunWithOptions}
                  style={{ width: '100%', padding: '8px 16px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                >
                  Enhance Text
                </button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && <LoadingSpinner />}

            {/* Error State */}
            {error && (
              <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={handleTryDifferent}
                  style={{ marginTop: '8px', fontSize: '14px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Results */}
            {hasResults && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                    Enhanced Text
                  </label>
                  <button
                    type="button"
                    onClick={handleTryDifferent}
                    style={{ fontSize: '14px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Try different enhancement
                  </button>
                </div>

                {elements.map((el) => {
                  const result = results.find(r => r.id === el.id)
                  if (!result) return null

                  const originalText = el.settings?.text || ''
                  const enhancedText = editedResults[el.id] || result.enhancedText

                  return (
                    <div key={el.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                      {/* Element header with checkbox */}
                      {elements.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                          <input
                            type="checkbox"
                            id={`apply-${el.id}`}
                            checked={selectedForApply[el.id] || false}
                            onChange={() => toggleElementSelection(el.id)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <label htmlFor={`apply-${el.id}`} style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                            {el.label || el.name}
                          </label>
                        </div>
                      )}

                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Diff view */}
                        <DiffView original={originalText} enhanced={result.enhancedText} />

                        {/* Editable result */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#6b7280', marginBottom: '4px' }}>
                            Final Text (editable)
                          </label>
                          <textarea
                            value={enhancedText}
                            onChange={(e) => updateEditedResult(el.id, e.target.value)}
                            rows={3}
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#ffffff', color: '#111827', fontSize: '14px', resize: 'vertical' }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {hasResults && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', padding: '16px', borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '8px 16px', color: '#374151', backgroundColor: '#f3f4f6', fontWeight: 500, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={Object.values(selectedForApply).filter(Boolean).length === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: Object.values(selectedForApply).filter(Boolean).length === 0 ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: Object.values(selectedForApply).filter(Boolean).length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Apply Enhanced Text
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

TextEnhancementModal.displayName = 'TextEnhancementModal'

export default TextEnhancementModal
