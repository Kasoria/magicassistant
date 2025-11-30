/**
 * Bricks Text Utilities
 *
 * Provides utilities for detecting, reading, and writing text content
 * in Bricks Builder text-capable elements.
 */

import { isBricksBuilder } from './bricksInserter.js';

/**
 * Text-capable element types in Bricks
 * Maps element name to the settings property that contains the text
 */
const TEXT_ELEMENT_CONFIG = {
  'heading': 'text',
  'text-basic': 'text',
  'text': 'text',
  'text-rich': 'text',
  'button': 'text',
  'text-link': 'text',
  'dropdown': 'text',
  'icon-box': 'content',
  'alert': 'content'
};

const TEXT_ELEMENT_TYPES = Object.keys(TEXT_ELEMENT_CONFIG);

/**
 * Get the Bricks builder admin object
 * Reuses cached ADMINBRXC or creates from Vue app
 * @returns {Object|null}
 */
export const getBricksAdmin = () => {
  if (typeof window.ADMINBRXC !== 'undefined' && window.ADMINBRXC.vueState) {
    return window.ADMINBRXC;
  }

  try {
    const brxBody = document.querySelector('.brx-body');
    if (!brxBody || !brxBody.__vue_app__) {
      return null;
    }

    const vueApp = brxBody.__vue_app__;
    const globalProps = vueApp.config.globalProperties;
    const vueState = globalProps.$_state;

    if (!vueState || !globalProps) {
      return null;
    }

    const adminBrxc = {
      vueState: vueState,
      vueGlobalProp: globalProps,
      helpers: {
        getElementObject: function(id) {
          const getElementObject = globalProps.$_getElementObject;
          const getDynamicElementById = globalProps.$_getDynamicElementById;

          if (typeof getElementObject === 'function') {
            return getElementObject(id);
          } else if (typeof getDynamicElementById === 'function') {
            const obj = getDynamicElementById(id);
            if (obj && obj.hasOwnProperty('cid')) {
              return globalProps.$_getComponentElementById(obj.cid);
            }
            return obj;
          }
          return null;
        },
        saveChanges: function(type) {
          if (typeof globalProps.$_saveData === 'function') {
            globalProps.$_saveData();
          } else if (vueState.unsavedChanges) {
            if (!vueState.unsavedChanges.includes(type)) {
              vueState.unsavedChanges.push(type);
            }
          }
        }
      }
    };

    window.ADMINBRXC = adminBrxc;
    return adminBrxc;
  } catch (error) {
    console.error('Error accessing Bricks Vue app:', error);
    return null;
  }
};

/**
 * Check if an element is a text-capable element
 * @param {Object} element - Bricks element object
 * @returns {boolean}
 */
export const isTextElement = (element) => {
  if (!element || !element.name) return false;
  return TEXT_ELEMENT_TYPES.includes(element.name);
};

/**
 * Recursively find all text elements within an element and its children
 * @param {string} elementId - The element ID to start searching from
 * @returns {Array} Array of text element objects found
 */
export const findTextElementsInHierarchy = (elementId) => {
  const admin = getBricksAdmin();
  if (!admin?.helpers?.getElementObject) return [];

  const textElements = [];
  const visited = new Set(); // Prevent circular references

  const traverse = (id) => {
    if (!id || visited.has(id)) return;
    visited.add(id);

    const element = admin.helpers.getElementObject(id);
    if (!element) return;

    // Check if this element is a text element
    if (isTextElement(element)) {
      textElements.push(element);
    }

    // Recursively process children
    if (element.children && Array.isArray(element.children)) {
      element.children.forEach(childId => traverse(childId));
    }
  };

  traverse(elementId);
  return textElements;
};

/**
 * Get the text property name for an element type
 * @param {string} elementName - Element type name
 * @returns {string} Property name ('text' or 'content')
 */
export const getTextPropertyName = (elementName) => {
  return TEXT_ELEMENT_CONFIG[elementName] || 'text';
};

/**
 * Get text content from an element
 * @param {Object} element - Bricks element object
 * @returns {string} Text content or empty string
 */
export const getElementText = (element) => {
  if (!element || !element.settings) return '';
  const propName = getTextPropertyName(element.name);
  return element.settings[propName] || '';
};

/**
 * Get the currently active element if it's a text element
 * @returns {Object|null}
 */
export const getActiveTextElement = () => {
  if (!isBricksBuilder()) return null;

  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) return null;

  const activeElement = admin.vueState.activeElement;
  if (!activeElement || !isTextElement(activeElement)) return null;

  return activeElement;
};

/**
 * Get the element that triggered the context menu
 * Uses vueState.showContextMenu which contains the element ID when menu is open
 * @returns {Object|null} The element object or null
 */
export const getContextMenuTargetElement = () => {
  if (!isBricksBuilder()) return null;

  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) return null;

  const contextMenuTarget = admin.vueState.showContextMenu;

  // showContextMenu can be false, true, or an element ID string
  if (!contextMenuTarget || typeof contextMenuTarget !== 'string') {
    return null;
  }

  // Get the element object by ID
  if (admin.helpers?.getElementObject) {
    return admin.helpers.getElementObject(contextMenuTarget);
  }

  return null;
};

/**
 * Check if the context menu was opened on a text element
 * @returns {boolean}
 */
export const isContextMenuOnTextElement = () => {
  const targetElement = getContextMenuTargetElement();
  return targetElement ? isTextElement(targetElement) : false;
};

/**
 * Get all currently selected text elements
 * Handles both single selection and multi-selection
 * Now recursively scans selected elements and their children for text elements
 * @returns {Array} Array of text elements
 */
export const getSelectedTextElements = () => {
  if (!isBricksBuilder()) return [];

  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) return [];

  const textElements = [];
  const addedIds = new Set(); // Prevent duplicates

  /**
   * Helper to process an element - finds all text elements within it (including itself)
   */
  const processElement = (elementId) => {
    if (!elementId) return;

    // Use recursive finder to get all text elements in hierarchy
    const foundTextElements = findTextElementsInHierarchy(elementId);
    foundTextElements.forEach(el => {
      if (!addedIds.has(el.id)) {
        textElements.push(el);
        addedIds.add(el.id);
      }
    });
  };

  /**
   * Helper to get element ID from an item (could be string ID or element object)
   */
  const getElementId = (item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'object' && item !== null) return item.id;
    return null;
  };

  // Check for multi-selection first (Bricks uses selectedElements array)
  if (admin.vueState.selectedElements && Array.isArray(admin.vueState.selectedElements) && admin.vueState.selectedElements.length > 0) {
    admin.vueState.selectedElements.forEach(item => {
      processElement(getElementId(item));
    });
  }

  // Also check multiSelectedElements (alternative property name)
  if (admin.vueState.multiSelectedElements && Array.isArray(admin.vueState.multiSelectedElements) && admin.vueState.multiSelectedElements.length > 0) {
    admin.vueState.multiSelectedElements.forEach(item => {
      processElement(getElementId(item));
    });
  }

  // If no multi-selection, check for single active element
  if (textElements.length === 0 && admin.vueState.activeElement) {
    processElement(admin.vueState.activeElement.id);
  }

  return textElements;
};

/**
 * Update text content of an element
 * @param {string} elementId - Element ID
 * @param {string} newText - New text content
 * @returns {boolean} Success status
 */
export const setElementText = (elementId, newText) => {
  const DEBUG = true; // Enable debug logging
  const log = (...args) => DEBUG && console.log('[MAT setElementText]', ...args);

  if (!isBricksBuilder()) return false;

  const admin = getBricksAdmin();
  if (!admin || !admin.helpers) return false;

  const element = admin.helpers.getElementObject(elementId);
  if (!element || !isTextElement(element)) return false;

  // Get the correct property name for this element type
  const propName = getTextPropertyName(element.name);

  log('Updating element:', {
    id: elementId,
    name: element.name,
    propName,
    oldValue: element.settings?.[propName]?.substring?.(0, 50) || element.settings?.[propName],
    newValuePreview: newText?.substring?.(0, 50) || newText
  });

  // Ensure settings object exists
  if (!element.settings) {
    element.settings = {};
  }

  // Update the text property using Object.assign to ensure Vue reactivity is triggered
  Object.assign(element.settings, { [propName]: newText });

  log('After update, element.settings[propName]:', element.settings[propName]?.substring?.(0, 50));

  // Mark content as changed to trigger save
  if (admin.vueState.unsavedChanges) {
    if (!admin.vueState.unsavedChanges.includes('content')) {
      admin.vueState.unsavedChanges.push('content');
    }
  }

  // Use Bricks' internal methods to trigger canvas re-render
  if (admin.vueGlobalProp) {
    // Method 1: Use $_rerenderElementId to queue element for re-render
    if (typeof admin.vueGlobalProp.$_rerenderElementId === 'function') {
      log('Calling $_rerenderElementId');
      try {
        admin.vueGlobalProp.$_rerenderElementId(elementId);
      } catch (e) {
        log('$_rerenderElementId error:', e);
      }
    }

    // Method 2: Signal that a non-CSS setting changed (triggers canvas update)
    if (typeof admin.vueGlobalProp.$_nonCssSettingChanged === 'function') {
      log('Calling $_nonCssSettingChanged');
      try {
        admin.vueGlobalProp.$_nonCssSettingChanged(elementId, propName);
      } catch (e) {
        log('$_nonCssSettingChanged error:', e);
      }
    }

    // Method 3: Re-render the settings panel controls
    if (typeof admin.vueGlobalProp.$_rerenderControls === 'function') {
      log('Calling $_rerenderControls');
      try {
        admin.vueGlobalProp.$_rerenderControls();
      } catch (e) {
        log('$_rerenderControls error:', e);
      }
    }

    // Method 4: Update active element panel if this is the active element
    if (typeof admin.vueGlobalProp.$_updateActiveElement === 'function') {
      log('Calling $_updateActiveElement');
      try {
        admin.vueGlobalProp.$_updateActiveElement();
      } catch (e) {
        log('$_updateActiveElement error:', e);
      }
    }

    // Method 5: Force render active instance (settings panel)
    if (typeof admin.vueGlobalProp.$_forceRenderActiveInstance === 'function') {
      log('Calling $_forceRenderActiveInstance');
      try {
        admin.vueGlobalProp.$_forceRenderActiveInstance();
      } catch (e) {
        log('$_forceRenderActiveInstance error:', e);
      }
    }

    // Method 6: Use $_postMessage to communicate with iframe canvas
    if (typeof admin.vueGlobalProp.$_postMessage === 'function') {
      log('Calling $_postMessage for element update');
      try {
        // Bricks uses postMessage to sync between admin panel and iframe
        admin.vueGlobalProp.$_postMessage('updateElement', { id: elementId });
      } catch (e) {
        log('$_postMessage error:', e);
      }
    }

    // Method 7: Force render as fallback
    if (typeof admin.vueGlobalProp.$_forceRender === 'function') {
      log('Calling $_forceRender');
      try {
        admin.vueGlobalProp.$_forceRender();
      } catch (e) {
        log('$_forceRender error:', e);
      }
    }
  }

  // Also try to trigger re-render from the iframe side
  const iframe = document.querySelector('iframe#bricks-builder-iframe');
  if (iframe?.contentWindow) {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeBrxBody = iframeDoc?.querySelector('.brx-body');

    if (iframeBrxBody?.__vue_app__) {
      const iframeGlobalProps = iframeBrxBody.__vue_app__.config?.globalProperties;

      if (iframeGlobalProps) {
        // Try $_rerenderElementId on iframe
        if (typeof iframeGlobalProps.$_rerenderElementId === 'function') {
          log('Calling iframe $_rerenderElementId');
          try {
            iframeGlobalProps.$_rerenderElementId(elementId);
          } catch (e) {
            log('iframe $_rerenderElementId error:', e);
          }
        }

        // Try $_nonCssSettingChanged on iframe
        if (typeof iframeGlobalProps.$_nonCssSettingChanged === 'function') {
          log('Calling iframe $_nonCssSettingChanged');
          try {
            iframeGlobalProps.$_nonCssSettingChanged(elementId, propName);
          } catch (e) {
            log('iframe $_nonCssSettingChanged error:', e);
          }
        }

        // Try $_forceRender on iframe
        if (typeof iframeGlobalProps.$_forceRender === 'function') {
          log('Calling iframe $_forceRender');
          try {
            iframeGlobalProps.$_forceRender();
          } catch (e) {
            log('iframe $_forceRender error:', e);
          }
        }
      }
    }
  }

  return true;
};

/**
 * Get a human-readable display name for an element
 * @param {Object} element - Bricks element object
 * @returns {string} Display name
 */
export const getElementDisplayName = (element) => {
  if (!element) return 'Unknown';

  // Use label if available
  if (element.label) return element.label;

  // Format element name nicely
  const nameMap = {
    'heading': 'Heading',
    'text-basic': 'Text',
    'text': 'Text',
    'text-rich': 'Rich Text',
    'button': 'Button',
    'text-link': 'Text Link',
    'dropdown': 'Dropdown',
    'icon-box': 'Icon Box',
    'alert': 'Alert'
  };

  return nameMap[element.name] || element.name || 'Element';
};

/**
 * Strip HTML tags from text (for AI processing)
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
export const stripHtmlTags = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/**
 * Check if text contains Bricks dynamic data tags
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export const containsDynamicTags = (text) => {
  if (!text) return false;
  return /\{[^}]+\}/.test(text);
};

/**
 * Get word count from text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export const getWordCount = (text) => {
  if (!text) return 0;
  const plainText = stripHtmlTags(text);
  return plainText.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Export text element types for external use
export { TEXT_ELEMENT_TYPES, TEXT_ELEMENT_CONFIG };

// Expose to window for debugging and external access
if (typeof window !== 'undefined') {
  window.MagicAssistantBricksText = {
    isTextElement,
    findTextElementsInHierarchy,
    getElementText,
    getTextPropertyName,
    getActiveTextElement,
    getContextMenuTargetElement,
    isContextMenuOnTextElement,
    getSelectedTextElements,
    setElementText,
    getElementDisplayName,
    stripHtmlTags,
    containsDynamicTags,
    getWordCount,
    TEXT_ELEMENT_TYPES,
    TEXT_ELEMENT_CONFIG
  };
}

export default {
  isTextElement,
  findTextElementsInHierarchy,
  getElementText,
  getTextPropertyName,
  getActiveTextElement,
  getContextMenuTargetElement,
  isContextMenuOnTextElement,
  getSelectedTextElements,
  setElementText,
  getElementDisplayName,
  stripHtmlTags,
  containsDynamicTags,
  getWordCount,
  getBricksAdmin,
  TEXT_ELEMENT_TYPES,
  TEXT_ELEMENT_CONFIG
};
