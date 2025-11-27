/**
 * Bricks Builder Inserter
 * 
 * Handles insertion of parsed Bricks structures into the Bricks builder canvas.
 * This integrates with Bricks' internal Vue state management.
 */

/**
 * Check if we're in Bricks builder context
 * @returns {boolean}
 */
export const isBricksBuilder = () => {
  return typeof window.bricksData !== 'undefined' && 
         typeof window.wp !== 'undefined' &&
         window.location.href.includes('bricks=run');
};

/**
 * Get the Bricks builder admin object
 * Creates it from Vue app if needed (Bricks exposes via DOM)
 * @returns {Object|null}
 */
const getBricksAdmin = () => {
  // Check if we already have ADMINBRXC (created by us or Advanced Themer)
  if (typeof window.ADMINBRXC !== 'undefined' && window.ADMINBRXC.vueState) {
    return window.ADMINBRXC;
  }
  
  // Create it from Bricks Vue app (exposed via DOM element)
  try {
    const brxBody = document.querySelector('.brx-body');
    if (!brxBody || !brxBody.__vue_app__) {
      console.warn('Bricks Vue app not found on .brx-body element');
      return null;
    }
    
    const vueApp = brxBody.__vue_app__;
    const globalProps = vueApp.config.globalProperties;
    const vueState = globalProps.$_state;
    
    if (!vueState || !globalProps) {
      console.warn('Bricks Vue state or global properties not found');
      return null;
    }
    
    // Create ADMINBRXC-like object for compatibility
    const adminBrxc = {
      vueState: vueState,
      vueGlobalProp: globalProps,
      helpers: {
        getElementObject: function(id, forceStructure = false) {
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
          // Trigger Bricks save if function exists
          if (typeof globalProps.$_saveData === 'function') {
            globalProps.$_saveData();
          } else if (vueState.unsavedChanges) {
            // Mark as changed
            if (!vueState.unsavedChanges.includes(type)) {
              vueState.unsavedChanges.push(type);
            }
          }
        },
        isComponentActive: function() {
          return vueState.hasOwnProperty('activeComponent') && 
                 vueState.activeComponent && 
                 vueState.activeComponent.hasOwnProperty('id');
        },
        isElementOnRoot: function(parentId) {
          return parentId === 0 || parentId === '0';
        }
      },
      globalSettings: {}
    };
    
    // Cache it for future use
    window.ADMINBRXC = adminBrxc;
    
    return adminBrxc;
  } catch (error) {
    console.error('Error accessing Bricks Vue app:', error);
    return null;
  }
};

/**
 * Get current content type (header, content, footer)
 * @returns {string}
 */
const getCurrentContentType = () => {
  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) {
    return 'pageContent'; // Default
  }
  
  const templateType = admin.vueState.templateType;
  
  // Handle different template types
  if (templateType === "section" || templateType === "archive" || 
      templateType === "error" || templateType === "popup" || 
      templateType === "search" || !admin.vueState.hasOwnProperty(templateType)) {
    return 'pageContent';
  }
  
  return templateType;
};

/**
 * Get content array for current context
 * @returns {Array}
 */
const getContentArray = () => {
  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) {
    console.error('Bricks builder state not found');
    return [];
  }
  
  // Check if we're editing a component
  if (admin.helpers && admin.helpers.isComponentActive && admin.helpers.isComponentActive()) {
    return admin.vueState.activeComponent.elements || [];
  }
  
  const contentType = getCurrentContentType();
  return admin.vueState[contentType] || [];
};

/**
 * Get currently active element
 * @returns {Object|null}
 */
const getActiveElement = () => {
  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) {
    return null;
  }
  
  return admin.vueState.activeElement || null;
};

/**
 * Determine if active element is nestable (can have children)
 * @param {Object} element
 * @returns {boolean}
 */
const isElementNestable = (element) => {
  const admin = getBricksAdmin();
  if (!admin || !admin.vueGlobalProp) {
    // Default nestable check
    const nonNestableTypes = ['image', 'video', 'text-basic', 'heading', 'code'];
    return !nonNestableTypes.includes(element.name);
  }
  
  // Use Bricks' built-in nestable check if available
  if (typeof admin.vueGlobalProp.$_isNestable === 'function') {
    return admin.vueGlobalProp.$_isNestable(element);
  }
  
  return true;
};

/**
 * Check if element is on root level
 * @param {string|number} parentId
 * @returns {boolean}
 */
const isElementOnRoot = (parentId) => {
  const admin = getBricksAdmin();
  if (!admin || !admin.helpers) {
    return parentId === 0 || parentId === '0';
  }
  
  if (typeof admin.helpers.isElementOnRoot === 'function') {
    return admin.helpers.isElementOnRoot(parentId);
  }
  
  // Check if it's root or component root
  return parentId === 0 || 
         (admin.helpers.isComponentActive && 
          admin.helpers.isComponentActive() && 
          admin.helpers.isComponentRoot && 
          admin.helpers.isComponentRoot(parentId));
};

/**
 * Determine insertion point in content array
 * @param {Object} activeElement
 * @param {Array} content
 * @returns {number}
 */
const getInsertionIndex = (activeElement, content) => {
  if (!activeElement) {
    return content.length; // Append to end
  }
  
  const admin = getBricksAdmin();
  
  // Check if active element is on root
  const isOnRoot = isElementOnRoot(activeElement.parent);
  const elementIsNestable = isElementNestable(activeElement);
  
  // If element is nestable and not on root, insert inside it
  if (elementIsNestable && !isOnRoot) {
    // Will be handled by setting parent to active element ID
    return content.length;
  }
  
  // Find active element index and insert after it
  const activeIndex = content.findIndex(el => el.id === activeElement.id);
  if (activeIndex !== -1) {
    return activeIndex + 1;
  }
  
  return content.length;
};

/**
 * Update Bricks global classes and return ID mapping
 * @param {Array} newClasses - Classes to add
 * @param {Array} elements - Elements array to update with correct IDs
 * @returns {Object} Mapping of old IDs to existing/new IDs
 */
const updateGlobalClasses = (newClasses, elements) => {
  const admin = getBricksAdmin();
  if (!admin || !admin.vueState) {
    console.error('Cannot update global classes: Bricks state not found');
    return {};
  }
  
  const existingClasses = admin.vueState.globalClasses || [];
  const idMapping = {}; // old ID -> existing/new ID
  
  // Add new classes that don't exist, build ID mapping
  newClasses.forEach(newClass => {
    const exists = existingClasses.find(ec => ec.name === newClass.name);
    if (exists) {
      // Class already exists - map new ID to existing ID
      idMapping[newClass.id] = exists.id;
    } else {
      // New class - add it and map to itself
      existingClasses.push(newClass);
      idMapping[newClass.id] = newClass.id;
    }
  });
  
  // Update all elements to use correct class IDs
  elements.forEach(element => {
    if (element.settings && element.settings._cssGlobalClasses) {
      element.settings._cssGlobalClasses = element.settings._cssGlobalClasses.map(oldId => {
        const newId = idMapping[oldId];
        return newId || oldId;
      });
    }
  });
  
  // Trigger save if available
  if (admin.helpers && typeof admin.helpers.saveChanges === 'function') {
    admin.helpers.saveChanges('globalClasses');
  }
  
  return idMapping;
};

/**
 * Generate unique IDs for all elements and update all references
 * This ensures each insertion creates unique element IDs, just like Bricks paste functionality
 * @param {Array} elements - Array of Bricks element objects
 * @returns {Array} Elements with new unique IDs and updated references
 */
const regenerateElementIds = (elements) => {
  if (!elements || !Array.isArray(elements) || elements.length === 0) {
    return elements;
  }
  
  // Create ID mapping: old ID -> new ID
  const idMapping = {};
  
  // First pass: generate new IDs for all elements
  elements.forEach(element => {
    if (element && element.id) {
      const newId = Math.random().toString(36).substr(2, 6);
      idMapping[element.id] = newId;
      element.id = newId;
    }
  });
  
  // Second pass: update all parent and children references
  elements.forEach(element => {
    // Update parent reference
    if (element.parent && idMapping[element.parent]) {
      element.parent = idMapping[element.parent];
    } else if (element.parent === 0 || element.parent === '0') {
      // Keep root parent as is
      element.parent = 0;
    }
    
    // Update children array
    if (element.children && Array.isArray(element.children)) {
      element.children = element.children.map(childId => {
        return idMapping[childId] || childId;
      }).filter(id => id); // Remove any undefined/null mappings
    }
  });
  
  return elements;
};

/**
 * Detect if structure is from parsed HTML (has root wrapper) vs pre-built component
 * @param {Array} elements
 * @returns {boolean}
 */
const isParsedHtmlStructure = (elements) => {
  // Parsed HTML structures typically have:
  // - A root wrapper element at the end (last element)
  // - The root wrapper has a label like "AI Generated Structure"
  // - All other elements reference this root in their parent/children
  if (elements.length === 0) return false;
  
  const lastElement = elements[elements.length - 1];
  const firstElement = elements[0];
  
  // Check if last element is a root wrapper (has label like "AI Generated Structure" or all other elements as children)
  const isRootWrapper = lastElement && (
    (lastElement.label && lastElement.label.includes('AI Generated')) ||
    (lastElement.id && elements.filter(e => e.parent === lastElement.id).length > elements.length / 2) ||
    (elements.length > 1 && firstElement.parent === lastElement.id)
  );
  
  return isRootWrapper;
};

/**
 * Update parent-child relationships
 * @param {Array} elements
 * @param {string} parentId
 * @param {Object} activeElement
 */
const updateParentChildRelationships = (elements, parentId, activeElement) => {
  const admin = getBricksAdmin();
  if (!admin) return;
  
  // Get the root element (last in array)
  const rootElement = elements[elements.length - 1];
  
  // Determine actual parent
  let actualParent = parentId;
  
  if (activeElement) {
    const elementIsNestable = isElementNestable(activeElement);
    const isOnRoot = isElementOnRoot(activeElement.parent);
    
    if (elementIsNestable && !isOnRoot) {
      // Insert as child of active element
      actualParent = activeElement.id;
      
      // Add root element ID to active element's children
      if (admin.helpers && typeof admin.helpers.getElementObject === 'function') {
        const parentObj = admin.helpers.getElementObject(actualParent);
        if (parentObj && parentObj.children) {
          parentObj.children.push(rootElement.id);
        }
      }
    } else {
      // Insert as sibling - use active element's parent
      actualParent = activeElement.parent;
    }
  }
  
  // Update root element's parent
  rootElement.parent = actualParent;
};

/**
 * Open/select an element in the builder
 * @param {string} elementId
 */
const openElement = (elementId) => {
  const admin = getBricksAdmin();
  if (!admin) return;
  
  // Use Bricks' Vue method to set active element
  if (admin.vueGlobalProp && typeof admin.vueGlobalProp.$_setActiveElement === 'function') {
    admin.vueGlobalProp.$_setActiveElement(elementId);
  } else if (admin.vueState) {
    // Fallback: set as active element directly
    const element = admin.helpers?.getElementObject(elementId);
    if (element) {
      admin.vueState.activeElement = element;
      admin.vueState.activeId = elementId;
      admin.vueState.activePanel = 'element';
    }
  }
};

/**
 * Save changes to database
 */
const saveChanges = () => {
  const admin = getBricksAdmin();
  if (!admin) return;
  
  if (admin.helpers && typeof admin.helpers.saveChanges === 'function') {
    admin.helpers.saveChanges('content');
  } else if (admin.vueState) {
    // Trigger Vue reactivity
    admin.vueState.unsavedChanges = admin.vueState.unsavedChanges || [];
    if (!admin.vueState.unsavedChanges.includes('content')) {
      admin.vueState.unsavedChanges.push('content');
    }
  }
};

/**
 * Show success message in Bricks builder
 * @param {string} message
 */
const showMessage = (message) => {
  const admin = getBricksAdmin();
  if (!admin) {
    console.log(message);
    return;
  }
  
  if (admin.vueGlobalProp && typeof admin.vueGlobalProp.$_showMessage === 'function') {
    admin.vueGlobalProp.$_showMessage(message);
  } else {
    console.log('📢', message);
  }
};

/**
 * Insert parsed Bricks structure into builder
 * @param {Array} parsedElements - Array of Bricks element objects
 * @param {Array} globalClasses - Array of global class objects
 * @returns {boolean} Success status
 */
export const insertBricksStructure = (parsedElements, globalClasses = []) => {
  // Check if we're in Bricks builder
  if (!isBricksBuilder()) {
    console.error('❌ Not in Bricks builder context');
    showMessage('Error: Not in Bricks builder');
    return false;
  }
  
  const admin = getBricksAdmin();
  if (!admin) {
    console.error('❌ Bricks builder API not found');
    showMessage('Error: Bricks builder API not accessible');
    return false;
  }
  
  try {
    // 0. Regenerate all element IDs to ensure uniqueness (like Bricks paste functionality)
    const clonedElements = JSON.parse(JSON.stringify(parsedElements)); // Deep clone
    const elementsWithNewIds = regenerateElementIds(clonedElements);
    
    // 1. Add global classes and update element IDs to match existing classes
    if (globalClasses && globalClasses.length > 0) {
      updateGlobalClasses(globalClasses, elementsWithNewIds);
    }
    
    // 2. Get current content
    const content = getContentArray();
    const activeElement = getActiveElement();
    
    // 3. Detect if this is a pre-built component (has correct parent-child relationships already)
    // Pre-built components: first element typically has parent: 0, all elements have valid parent refs
    // Parsed HTML: has a root wrapper element (last in array) that needs parent update
    const isPrebuiltComponent = parsedElements.length > 0 && 
                                parsedElements[0] && 
                                (parsedElements[0].parent === 0 || parsedElements[0].parent === '0') &&
                                !isParsedHtmlStructure(parsedElements);
    
    // Only update parent-child relationships for parsed HTML structures
    // Pre-built components already have correct relationships (but IDs are now regenerated)
    if (!isPrebuiltComponent) {
      updateParentChildRelationships(elementsWithNewIds, 0, activeElement);
    } else {
      
      // For pre-built components, we still need to handle insertion context
      // Update only the first element's parent if we're inserting into a specific element
      if (activeElement) {
        const elementIsNestable = isElementNestable(activeElement);
        const isOnRoot = isElementOnRoot(activeElement.parent);
        
        if (elementIsNestable && !isOnRoot) {
          // Insert as child of active element - update first element only
          const firstElement = elementsWithNewIds[0];
          if (firstElement) {
            firstElement.parent = activeElement.id;
            // Add first element ID to active element's children
            if (admin.helpers && typeof admin.helpers.getElementObject === 'function') {
              const parentObj = admin.helpers.getElementObject(activeElement.id);
              if (parentObj && parentObj.children && !parentObj.children.includes(firstElement.id)) {
                parentObj.children.push(firstElement.id);
              }
            }
          }
        } else {
          // Insert as sibling - use active element's parent
          const firstElement = elementsWithNewIds[0];
          if (firstElement) {
            firstElement.parent = activeElement.parent;
          }
        }
      }
    }
    
    // 4. Determine insertion point
    const insertionIndex = getInsertionIndex(activeElement, content);
    
    // 5. Insert elements into content array
    if (admin.helpers && admin.helpers.isComponentActive && admin.helpers.isComponentActive()) {
      // Insert into component
      admin.vueState.activeComponent.elements.splice(insertionIndex, 0, ...elementsWithNewIds);
    } else {
      // Insert into page content
      const contentType = getCurrentContentType();
      admin.vueState[contentType].splice(insertionIndex, 0, ...elementsWithNewIds);
    }
    
    // 6. Open the root/first element
    // For pre-built components, the first element is typically the root
    // For parsed HTML, the last element is the root wrapper
    const rootElement = isPrebuiltComponent ? elementsWithNewIds[0] : elementsWithNewIds[elementsWithNewIds.length - 1];
    if (rootElement) {
      setTimeout(() => {
        openElement(rootElement.id);
      }, 100);
    }
    
    // 7. Save changes
    saveChanges();
    
    // 8. Show success message
    const message = `Structure imported! ${parsedElements.length} elements, ${globalClasses.length} classes`;
    showMessage(message);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error inserting structure:', error);
    showMessage('Error: Failed to insert structure');
    return false;
  }
};

/**
 * Get Bricks builder information for debugging
 * @returns {Object}
 */
export const getBricksInfo = () => {
  const admin = getBricksAdmin();
  
  return {
    isBricksBuilder: isBricksBuilder(),
    hasAdmin: !!admin,
    hasVueState: !!(admin && admin.vueState),
    hasHelpers: !!(admin && admin.helpers),
    contentType: admin ? getCurrentContentType() : null,
    contentLength: admin ? getContentArray().length : 0,
    activeElement: admin ? getActiveElement() : null,
    globalClasses: admin && admin.vueState ? (admin.vueState.globalClasses || []).length : 0
  };
};

// Expose functions to window for direct access
if (typeof window !== 'undefined') {
  window.MagicAssistantBricks = {
    insertBricksStructure,
    isBricksBuilder,
    getBricksInfo
  };
}

export default {
  insertBricksStructure,
  isBricksBuilder,
  getBricksInfo
};

