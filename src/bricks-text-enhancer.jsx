/**
 * Bricks Text Enhancer
 *
 * Entry point for the Bricks Builder text enhancement feature.
 * Injects an "Enhance with AI" option into Bricks' context menu
 * when text elements are selected.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import TextEnhancementModal from './components/TextEnhancementModal'
import {
  getSelectedTextElements,
  setElementText,
  getElementText,
  getElementDisplayName,
  getBricksAdmin,
  isTextElement,
  findTextElementsInHierarchy
} from './utils/bricksTextUtils'
import { isBricksBuilder } from './utils/bricksInserter'

/**
 * BricksTextEnhancer Component
 * Manages the context menu integration and modal rendering
 */
class BricksTextEnhancer {
  constructor() {
    this.root = null
    this.container = null
    this.observer = null
    this.isModalOpen = false
    this.targetElements = []
    this.initialized = false
    this.lastRightClickedElementId = null // Track which element was right-clicked
  }

  /**
   * Initialize the enhancer
   */
  init() {
    if (this.initialized) return

    // Only run in Bricks builder
    if (!isBricksBuilder()) {
      return
    }

    // Wait for Bricks to fully load
    this.waitForBricks().then(() => {
      this.createContainer()
      this.setupContextMenuObserver()
      this.initialized = true
    })
  }

  /**
   * Wait for Bricks builder to be ready
   */
  waitForBricks() {
    return new Promise((resolve) => {
      const checkBricks = () => {
        const brxBody = document.querySelector('.brx-body')
        if (brxBody && brxBody.__vue_app__) {
          resolve()
        } else {
          setTimeout(checkBricks, 100)
        }
      }

      // Start checking after a short delay
      setTimeout(checkBricks, 500)

      // Timeout after 10 seconds
      setTimeout(() => {
        resolve()
      }, 10000)
    })
  }

  /**
   * Create the React container for the modal
   */
  createContainer() {
    // Check if container already exists
    const existingContainer = document.getElementById('mat-bricks-text-enhancer-root')
    if (existingContainer) {
      this.container = existingContainer
    } else {
      // Create container for React portal
      this.container = document.createElement('div')
      this.container.id = 'mat-bricks-text-enhancer-root'
      document.body.appendChild(this.container)
    }

    // Create React root
    if (!this.root) {
      this.root = ReactDOM.createRoot(this.container)
    }

    this.render()
  }

  /**
   * Set up MutationObserver to detect context menu
   */
  setupContextMenuObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check for Bricks context menu
            const isContextMenu = this.isLikelyContextMenu(node)
            if (isContextMenu) {
              this.handleContextMenuOpen(node)
            }
          }
        })
      })
    })

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // Also try to intercept right-click events
    document.addEventListener('contextmenu', (e) => {
      // Capture the element that was right-clicked
      this.lastRightClickedElementId = this.getElementIdFromTarget(e.target)

      // Wait a bit for the menu to render
      setTimeout(() => {
        this.findAndProcessContextMenu()
      }, 100)
    })
  }

  /**
   * Extract Bricks element ID from a DOM target
   * Traverses up the DOM tree to find the element wrapper with data-id
   * Works for both canvas elements and structure panel elements
   */
  getElementIdFromTarget(target) {
    if (!target) return null

    let current = target

    // Traverse up to find the Bricks element wrapper
    while (current && current !== document.body) {
      // Check for data-id attribute (Bricks uses this for element identification in canvas)
      const dataId = current.getAttribute?.('data-id')
      if (dataId) {
        return dataId
      }

      // Check for structure panel elements which use data-element-id
      const elementId = current.getAttribute?.('data-element-id')
      if (elementId) {
        return elementId
      }

      // Also check for brxe-* class pattern which contains the element ID (canvas)
      const classList = current.classList
      if (classList) {
        for (const cls of classList) {
          if (cls.startsWith('brxe-')) {
            // The class is like "brxe-abc123" where abc123 is the element ID
            return cls.replace('brxe-', '')
          }
        }
      }

      current = current.parentElement
    }

    return null
  }

  /**
   * Get className as string (handles SVG elements which have SVGAnimatedString)
   */
  getClassNameString(node) {
    if (!node) return ''
    const className = node.className
    if (typeof className === 'string') return className
    if (className && typeof className.baseVal === 'string') return className.baseVal
    return ''
  }

  /**
   * Check if an element is likely a context menu
   */
  isLikelyContextMenu(node) {
    try {
      // Get className safely
      const classList = this.getClassNameString(node).toLowerCase()
      const nodeId = (node.id || '').toLowerCase()

      // Exclude known non-context-menu popups
      if (classList.includes('command-palette') ||
          classList.includes('bricks-popup-inner') ||
          nodeId === 'bricks-popup') {
        return false
      }

      // Skip small utility elements
      if (classList.includes('icon') || classList.includes('svg') || classList.includes('wrapper')) {
        return false
      }

      // Check by specific Bricks context menu ID (the actual one used by Bricks)
      if (nodeId === 'bricks-builder-context-menu') {
        return true
      }

      // Check by specific Bricks context menu class names
      if (classList.includes('bricks-context-menu') ||
          classList.includes('brx-context-menu')) {
        return true
      }

      // Check by other possible IDs
      if (nodeId === 'bricks-context-menu' || nodeId === 'brx-context-menu') {
        return true
      }

      // Check by structure - Bricks context menu has specific items
      // Must have "Move", "Copy", "Paste", "Delete" all together
      const textContent = node.textContent || ''

      const hasAllContextMenuItems =
        textContent.includes('Move') &&
        textContent.includes('Copy') &&
        textContent.includes('Paste') &&
        textContent.includes('Delete') &&
        textContent.includes('Duplicate')

      if (hasAllContextMenuItems) {
        // Verify it has proper structure (ul with li items)
        const ul = node.tagName === 'UL' ? node : node.querySelector('ul')
        if (ul && ul.querySelectorAll('li').length >= 8) {
          return true
        }
      }

      return false
    } catch (e) {
      return false
    }
  }

  /**
   * Find and process context menu that might already exist
   */
  findAndProcessContextMenu() {
    // Try to find the actual Bricks context menu - be specific to avoid matching other popups
    const selectors = [
      '#bricks-builder-context-menu', // The actual Bricks context menu ID
      '.bricks-context-menu:not(.command-palette)',
      '.brx-context-menu',
      '#bricks-context-menu',
      '#brx-context-menu'
    ]

    for (const selector of selectors) {
      const menu = document.querySelector(selector)
      if (menu) {
        this.handleContextMenuOpen(menu)
        return
      }
    }

    // Fallback: look for any element that looks like a context menu
    const allDivs = document.querySelectorAll('div')
    for (const div of allDivs) {
      if (this.isLikelyContextMenu(div)) {
        this.handleContextMenuOpen(div)
        return
      }
    }
  }

  /**
   * Handle context menu opening
   * Now always injects the menu item - scanning for text elements happens on click
   */
  handleContextMenuOpen(menuElement) {
    // Find existing injected items
    const existingSeparator = menuElement.querySelector('.mat-enhance-separator')
    const existingItem = menuElement.querySelector('.mat-enhance-text-item')

    // Get element ID from right-click or Bricks state
    const admin = getBricksAdmin()
    let elementId = this.lastRightClickedElementId

    // Fallback: try to get element ID from Bricks' showContextMenu state
    if (!elementId && admin?.vueState?.showContextMenu) {
      const showContextMenu = admin.vueState.showContextMenu
      if (typeof showContextMenu === 'string') {
        elementId = showContextMenu
      }
    }

    // If already injected, just return (keep it there)
    if (existingItem) {
      // Store the current element ID for the click handler
      existingItem._targetElementId = elementId
      return
    }

    // Find the menu list (ul element)
    const menuList = menuElement.tagName === 'UL'
      ? menuElement
      : menuElement.querySelector('ul')

    if (!menuList) {
      return
    }

    // Always inject the menu item - we'll scan for text elements on click
    this.injectMenuItem(menuList, elementId)
  }

  /**
   * Inject the "Enhance with AI" menu item
   * @param {HTMLElement} menuList - The UL element of the context menu
   * @param {string} targetElementId - The ID of the right-clicked element
   */
  injectMenuItem(menuList, targetElementId) {
    // Create separator (matching Bricks separator class)
    const separator = document.createElement('li')
    separator.className = 'mat-enhance-separator sep'

    // Create menu item - match Bricks styling exactly
    const menuItem = document.createElement('li')
    menuItem.className = 'mat-enhance-text-item'

    // Create the label span (Bricks uses .label class)
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = 'Enhance with AI'

    // Create icon on the right side (matching Bricks icon placement)
    const icon = document.createElement('span')
    icon.className = 'bricks-svg-wrapper action'
    icon.setAttribute('data-balloon', 'AI Enhancement')
    icon.setAttribute('data-balloon-pos', 'top-right')
    icon.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6;">
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
      </svg>
    `

    menuItem.appendChild(label)
    menuItem.appendChild(icon)

    // Store reference to target element ID (can be updated by handleContextMenuOpen)
    menuItem._targetElementId = targetElementId

    // Click handler - now scans for text elements on click
    menuItem.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()

      // Close the context menu using Bricks' own mechanism
      try {
        const admin = window.ADMINBRXC || getBricksAdmin()
        if (admin && admin.vueState) {
          admin.vueState.showContextMenu = false
        }
      } catch (err) {
        // Silently ignore
      }

      // Fallback: just hide visually without removing from DOM
      const contextMenuEl = document.getElementById('bricks-builder-context-menu')
      if (contextMenuEl) {
        contextMenuEl.style.display = 'none'
      }

      // Scan for text elements in the selection hierarchy
      // getSelectedTextElements() now recursively finds all text elements in selected elements + children
      const textElements = getSelectedTextElements()

      // If no text elements found, show notification
      if (textElements.length === 0) {
        this.showNotification('No text elements found in this selection')
        return
      }

      // Open modal with found text elements
      this.openModal(textElements)
    })

    // Insert separator and item at the end of the menu
    menuList.appendChild(separator)
    menuList.appendChild(menuItem)
  }

  /**
   * Open the enhancement modal
   */
  openModal(elements) {
    // Ensure container exists
    if (!this.container || !this.root) {
      this.createContainer()
    }

    // Convert elements to the format expected by the modal
    // Normalize the text property so modal doesn't need to know about different property names
    this.targetElements = elements.map(el => ({
      id: el.id,
      name: el.name,
      label: getElementDisplayName(el),
      settings: {
        ...el.settings,
        text: getElementText(el) // Normalize to 'text' property for the modal
      }
    }))

    this.isModalOpen = true
    this.render()
  }

  /**
   * Close the modal
   */
  closeModal() {
    this.isModalOpen = false
    this.targetElements = []
    this.render()
  }

  /**
   * Handle applying enhanced text
   */
  handleApply(textsToApply) {
    textsToApply.forEach(({ elementId, newText }) => {
      setElementText(elementId, newText)
    })

    // Show success message if Bricks has a notification system
    this.showNotification(`Enhanced ${textsToApply.length} element(s)`)
  }

  /**
   * Show a notification (uses Bricks' notification if available)
   */
  showNotification(message) {
    // Try to use Bricks' built-in notification
    if (typeof window.ADMINBRXC !== 'undefined' && window.ADMINBRXC.vueGlobalProp) {
      const showMessage = window.ADMINBRXC.vueGlobalProp.$_showMessage
      if (typeof showMessage === 'function') {
        showMessage(message)
        return
      }
    }
  }

  /**
   * Render the React component
   */
  render() {
    if (!this.root) {
      return
    }

    this.root.render(
      <React.StrictMode>
        <TextEnhancementModal
          isOpen={this.isModalOpen}
          onClose={() => this.closeModal()}
          elements={this.targetElements}
          onApply={(texts) => this.handleApply(texts)}
        />
      </React.StrictMode>
    )
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect()
    }

    if (this.root) {
      this.root.unmount()
    }

    if (this.container) {
      this.container.remove()
    }

    this.initialized = false
  }
}

// Create and initialize the enhancer
const enhancer = new BricksTextEnhancer()

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhancer.init())
} else {
  enhancer.init()
}

// Expose for debugging
if (typeof window !== 'undefined') {
  window.MagicAssistantBricksTextEnhancer = enhancer
}

export default enhancer
