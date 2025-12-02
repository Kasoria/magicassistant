/**
 * Bricks Image Utilities
 *
 * Provides utilities for detecting, reading, and writing image content
 * in Bricks Builder image-capable elements.
 */

import { isBricksBuilder } from './bricksInserter.js';

/**
 * Image-capable element types in Bricks
 * Maps element name to the settings property that contains the image
 */
const IMAGE_ELEMENT_CONFIG = {
  'image': 'image',
  'video': 'image', // Video poster image
};

const IMAGE_ELEMENT_TYPES = Object.keys(IMAGE_ELEMENT_CONFIG);

/**
 * Placeholder image URL patterns to detect
 */
const PLACEHOLDER_PATTERNS = [
  'placehold.co',
  'placeholder.com',
  'placeholdit.imgix.net',
  'via.placeholder.com',
  'picsum.photos',
  'loremflickr.com',
  'dummyimage.com',
  'fakeimg.pl',
  'placekitten.com',
  'placebear.com',
  'placecage.com',
  'fillmurray.com',
  'lorempixel.com',
  'unsplash.it', // Old placeholder service
  'source.unsplash.com/random' // Random unsplash placeholder
];

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
 * Check if an element is an image-capable element
 * @param {Object} element - Bricks element object
 * @returns {boolean}
 */
export const isImageElement = (element) => {
  if (!element || !element.name) return false;
  return IMAGE_ELEMENT_TYPES.includes(element.name);
};

/**
 * Check if a URL is a placeholder image
 * @param {string} url - Image URL to check
 * @returns {boolean}
 */
export const isPlaceholderImage = (url) => {
  if (!url || typeof url !== 'string') return false;

  const lowerUrl = url.toLowerCase();
  return PLACEHOLDER_PATTERNS.some(pattern => lowerUrl.includes(pattern));
};

/**
 * Recursively find all image elements within an element and its children
 * @param {string} elementId - The element ID to start searching from
 * @returns {Array} Array of image element objects found
 */
export const findImageElementsInHierarchy = (elementId) => {
  const admin = getBricksAdmin();
  if (!admin?.helpers?.getElementObject) return [];

  const imageElements = [];
  const visited = new Set(); // Prevent circular references

  const traverse = (id) => {
    if (!id || visited.has(id)) return;
    visited.add(id);

    const element = admin.helpers.getElementObject(id);
    if (!element) return;

    // Check if this element is an image element
    if (isImageElement(element)) {
      imageElements.push(element);
    }

    // Recursively process children
    if (element.children && Array.isArray(element.children)) {
      element.children.forEach(childId => traverse(childId));
    }
  };

  traverse(elementId);
  return imageElements;
};

/**
 * Get the image property name for an element type
 * @param {string} elementName - Element type name
 * @returns {string} Property name ('image')
 */
export const getImagePropertyName = (elementName) => {
  return IMAGE_ELEMENT_CONFIG[elementName] || 'image';
};

/**
 * Get image data from an element
 * @param {Object} element - Bricks element object
 * @returns {Object|null} Image data object { url, external, filename } or null
 */
export const getElementImage = (element) => {
  if (!element || !element.settings) return null;
  const propName = getImagePropertyName(element.name);
  return element.settings[propName] || null;
};

/**
 * Get image URL from an element
 * @param {Object} element - Bricks element object
 * @returns {string} Image URL or empty string
 */
export const getElementImageUrl = (element) => {
  const imageData = getElementImage(element);
  if (!imageData) return '';
  return imageData.url || '';
};

/**
 * Get alt text from an element
 * @param {Object} element - Bricks element object
 * @returns {string} Alt text or empty string
 */
export const getElementImageAlt = (element) => {
  if (!element || !element.settings) return '';
  return element.settings.altText || element.settings._alt || '';
};

/**
 * Get filename from image URL
 * @param {string} url - Image URL
 * @returns {string} Filename
 */
export const getFilenameFromUrl = (url) => {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || 'image';
  } catch (e) {
    // Fallback for relative URLs
    return url.split('/').pop() || 'image';
  }
};

/**
 * Get the currently active element if it's an image element
 * @returns {Object|null}
 */
export const getActiveImageElement = () => {
  if (!isBricksBuilder()) return null;

  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) return null;

  const activeElement = admin.vueState.activeElement;
  if (!activeElement || !isImageElement(activeElement)) return null;

  return activeElement;
};

/**
 * Get all currently selected image elements
 * Handles both single selection and multi-selection
 * Recursively scans selected elements and their children for image elements
 * @returns {Array} Array of image elements
 */
export const getSelectedImageElements = () => {
  if (!isBricksBuilder()) return [];

  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) return [];

  const imageElements = [];
  const addedIds = new Set(); // Prevent duplicates

  /**
   * Helper to process an element - finds all image elements within it (including itself)
   */
  const processElement = (elementId) => {
    if (!elementId) return;

    // Use recursive finder to get all image elements in hierarchy
    const foundImageElements = findImageElementsInHierarchy(elementId);
    foundImageElements.forEach(el => {
      if (!addedIds.has(el.id)) {
        imageElements.push(el);
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
  if (imageElements.length === 0 && admin.vueState.activeElement) {
    processElement(admin.vueState.activeElement.id);
  }

  return imageElements;
};

/**
 * Update image data of an element
 * @param {string} elementId - Element ID
 * @param {Object} imageData - New image data { url, filename, external, altText }
 * @returns {boolean} Success status
 */
export const setElementImage = (elementId, imageData) => {
  if (!isBricksBuilder()) return false;

  const admin = getBricksAdmin();
  if (!admin || !admin.helpers) return false;

  const element = admin.helpers.getElementObject(elementId);
  if (!element || !isImageElement(element)) return false;

  // Get the correct property name for this element type
  const propName = getImagePropertyName(element.name);

  // Ensure settings object exists
  if (!element.settings) {
    element.settings = {};
  }

  // Build the image object for Bricks
  // If imageData has an attachment ID, use media library format (not external)
  // Otherwise, use external URL format
  const newImageData = {};

  if (imageData.id) {
    // Media library image - use attachment ID
    newImageData.id = imageData.id;
    newImageData.url = imageData.url;
    newImageData.filename = imageData.filename || getFilenameFromUrl(imageData.url);
  } else if (imageData.url) {
    // External image URL
    newImageData.url = imageData.url;
    newImageData.external = true;
    newImageData.filename = imageData.filename || getFilenameFromUrl(imageData.url);
  } else {
    return false;
  }

  // Update the image property using Object.assign to ensure Vue reactivity is triggered
  Object.assign(element.settings, { [propName]: newImageData });

  // Update alt text if provided
  if (imageData.altText !== undefined) {
    Object.assign(element.settings, { altText: imageData.altText });
  }

  // Mark content as changed to trigger save
  if (admin.vueState.unsavedChanges) {
    if (!admin.vueState.unsavedChanges.includes('content')) {
      admin.vueState.unsavedChanges.push('content');
    }
  }

  // Use Bricks' internal methods to trigger canvas re-render
  if (admin.vueGlobalProp) {
    // Set the element as active to ensure canvas refresh
    // This is necessary when the element being updated isn't the currently selected one
    if (typeof admin.vueGlobalProp.$_setActiveElement === 'function') {
      try {
        admin.vueGlobalProp.$_setActiveElement(elementId);
      } catch (e) {}
    }

    // Use $_rerenderElementId to queue element for re-render
    if (typeof admin.vueGlobalProp.$_rerenderElementId === 'function') {
      try {
        admin.vueGlobalProp.$_rerenderElementId(elementId);
      } catch (e) {}
    }

    // Signal that a non-CSS setting changed (triggers canvas update)
    if (typeof admin.vueGlobalProp.$_nonCssSettingChanged === 'function') {
      try {
        admin.vueGlobalProp.$_nonCssSettingChanged(elementId, propName);
      } catch (e) {}
    }

    // Re-render the settings panel controls
    if (typeof admin.vueGlobalProp.$_rerenderControls === 'function') {
      try {
        admin.vueGlobalProp.$_rerenderControls();
      } catch (e) {}
    }

    // Force render as fallback
    if (typeof admin.vueGlobalProp.$_forceRender === 'function') {
      try {
        admin.vueGlobalProp.$_forceRender();
      } catch (e) {}
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
        // Set active element in iframe context too
        if (typeof iframeGlobalProps.$_setActiveElement === 'function') {
          try {
            iframeGlobalProps.$_setActiveElement(elementId);
          } catch (e) {}
        }

        if (typeof iframeGlobalProps.$_rerenderElementId === 'function') {
          try {
            iframeGlobalProps.$_rerenderElementId(elementId);
          } catch (e) {}
        }

        if (typeof iframeGlobalProps.$_forceRender === 'function') {
          try {
            iframeGlobalProps.$_forceRender();
          } catch (e) {}
        }
      }
    }

    // Direct DOM update: Force the iframe canvas to show the new image
    // This bypasses Vue reactivity issues by directly updating the img src
    if (iframeDoc && newImageData.url) {
      // Try multiple selectors to find the image element in the iframe
      const selectors = [
        `.brxe-${elementId}`,
        `[data-id="${elementId}"]`,
        `#brxe-${elementId}`
      ];

      let imgWrapper = null;
      for (const selector of selectors) {
        imgWrapper = iframeDoc.querySelector(selector);
        if (imgWrapper) break;
      }

      if (imgWrapper) {
        const imgTag = imgWrapper.tagName === 'IMG' ? imgWrapper : imgWrapper.querySelector('img');
        if (imgTag) {
          imgTag.src = newImageData.url;
          if (imgTag.srcset) {
            imgTag.srcset = '';
          }
          if (newImageData.altText) {
            imgTag.alt = newImageData.altText;
          }
        }
      }
    }
  }

  return true;
};

/**
 * Get a human-readable display name for an image element
 * @param {Object} element - Bricks element object
 * @returns {string} Display name
 */
export const getElementDisplayName = (element) => {
  if (!element) return 'Unknown';

  // Use label if available
  if (element.label) return element.label;

  // Use alt text as label if available
  const altText = getElementImageAlt(element);
  if (altText) return altText;

  // Format element name nicely
  const nameMap = {
    'image': 'Image',
    'video': 'Video'
  };

  return nameMap[element.name] || element.name || 'Element';
};

/**
 * Get context hints for image search from element and surrounding elements
 * @param {Object} element - The image element
 * @returns {Object} Context hints { altText, filename, label, surroundingText }
 */
export const getImageContextHints = (element) => {
  const hints = {
    altText: '',
    filename: '',
    label: '',
    surroundingText: []
  };

  if (!element) return hints;

  // Get alt text
  hints.altText = getElementImageAlt(element);

  // Get filename
  const imageData = getElementImage(element);
  if (imageData?.filename) {
    // Clean up filename - remove extension and replace dashes/underscores with spaces
    let cleanFilename = imageData.filename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[-_]/g, ' ')    // Replace dashes/underscores with spaces
      .replace(/\d+/g, '')      // Remove numbers
      .trim();
    hints.filename = cleanFilename;
  }

  // Get label
  if (element.label) {
    hints.label = element.label;
  }

  // Try to get surrounding text elements for context
  const admin = getBricksAdmin();
  if (admin?.helpers?.getElementObject && element.parent) {
    const parent = admin.helpers.getElementObject(element.parent);
    if (parent?.children) {
      parent.children.forEach(siblingId => {
        if (siblingId === element.id) return;
        const sibling = admin.helpers.getElementObject(siblingId);
        if (sibling?.settings?.text && typeof sibling.settings.text === 'string') {
          // Strip HTML and get first 100 chars
          const text = sibling.settings.text.replace(/<[^>]*>/g, '').substring(0, 100).trim();
          if (text) {
            hints.surroundingText.push(text);
          }
        }
      });
    }
  }

  return hints;
};

// Export element types for external use
export { IMAGE_ELEMENT_TYPES, IMAGE_ELEMENT_CONFIG, PLACEHOLDER_PATTERNS };

// Expose to window for debugging and external access
if (typeof window !== 'undefined') {
  window.MagicAssistantBricksImage = {
    isImageElement,
    isPlaceholderImage,
    findImageElementsInHierarchy,
    getElementImage,
    getElementImageUrl,
    getElementImageAlt,
    getImagePropertyName,
    getActiveImageElement,
    getSelectedImageElements,
    setElementImage,
    getElementDisplayName,
    getImageContextHints,
    getFilenameFromUrl,
    IMAGE_ELEMENT_TYPES,
    IMAGE_ELEMENT_CONFIG,
    PLACEHOLDER_PATTERNS
  };
}

export default {
  isImageElement,
  isPlaceholderImage,
  findImageElementsInHierarchy,
  getElementImage,
  getElementImageUrl,
  getElementImageAlt,
  getImagePropertyName,
  getActiveImageElement,
  getSelectedImageElements,
  setElementImage,
  getElementDisplayName,
  getImageContextHints,
  getFilenameFromUrl,
  getBricksAdmin,
  IMAGE_ELEMENT_TYPES,
  IMAGE_ELEMENT_CONFIG,
  PLACEHOLDER_PATTERNS
};
