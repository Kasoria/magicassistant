import Select from 'react-select'
import { useEffect, useState } from 'react'

const CustomSelect = ({ 
  darkMode, 
  size = 'default',
  className = '',
  ...props 
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false)
  
  // Detect dark mode from multiple sources
  useEffect(() => {
    const detectDarkMode = () => {
      // Priority: 1. Prop passed from parent, 2. Document class, 3. System preference
      if (darkMode !== undefined) {
        setIsDarkMode(darkMode)
      } else if (document.documentElement.classList.contains('dark')) {
        setIsDarkMode(true)
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setIsDarkMode(true)
      } else {
        setIsDarkMode(false)
      }
    }

    detectDarkMode()

    // Listen for class changes on document element
    const observer = new MutationObserver(detectDarkMode)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [darkMode])

  const isCompact = size === 'compact'
  
  // Comprehensive styles with dark mode support as fallback
  const getCustomStyles = () => ({
    control: (provided, state) => ({
      ...provided,
      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
      borderColor: state.isFocused 
        ? '#0ea5e9' 
        : (isDarkMode ? '#4b5563' : '#d1d5db'),
      boxShadow: state.isFocused ? '0 0 0 1px #0ea5e9' : 'none',
      '&:hover': {
        borderColor: state.isFocused 
          ? '#0ea5e9' 
          : (isDarkMode ? '#6b7280' : '#9ca3af')
      },
      fontSize: isCompact ? '12px' : '14px',
      minHeight: isCompact ? '32px' : '42px',
      padding: isCompact ? '1px 2px' : '0'
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: isDarkMode ? '#374151' : '#ffffff',
      border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      fontSize: isCompact ? '12px' : '14px'
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? '#0ea5e9'
        : state.isFocused
        ? (isDarkMode ? '#4b5563' : '#f3f4f6')
        : 'transparent',
      color: state.isSelected
        ? '#ffffff'
        : (isDarkMode ? '#ffffff' : '#111827'),
      '&:hover': {
        backgroundColor: state.isSelected 
          ? '#0ea5e9' 
          : (isDarkMode ? '#4b5563' : '#f3f4f6')
      },
      fontSize: isCompact ? '12px' : '14px',
      padding: isCompact ? '4px 8px' : '8px 12px'
    }),
    singleValue: (provided) => ({
      ...provided,
      color: isDarkMode ? '#ffffff' : '#111827',
      fontSize: isCompact ? '12px' : '14px'
    }),
    input: (provided) => ({
      ...provided,
      color: isDarkMode ? '#ffffff' : '#111827',
      fontSize: isCompact ? '12px' : '14px'
    }),
    placeholder: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
      fontSize: isCompact ? '12px' : '14px'
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280',
      padding: isCompact ? '4px' : '8px'
    }),
    clearIndicator: (provided) => ({
      ...provided,
      color: isDarkMode ? '#9ca3af' : '#6b7280'
    }),
    indicatorSeparator: () => ({
      display: 'none'
    })
  })

  return (
    <div className={`react-select-container ${isDarkMode ? 'dark' : ''} ${className}`}>
      <Select
        {...props}
        styles={{
          ...getCustomStyles(),
          ...props.styles // Allow overriding styles if needed
        }}
        classNamePrefix="react-select"
      />
    </div>
  )
}

export default CustomSelect 