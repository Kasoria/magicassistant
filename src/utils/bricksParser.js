/**
 * Bricks HTML Parser Utility
 * 
 * Converts HTML structures to Bricks-compatible element arrays.
 * Based on Advanced Themer's HTML importer logic.
 */

/**
 * Generate a unique ID for Bricks elements
 * @returns {string} Unique ID
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 6);
};

/**
 * Wrap text nodes in span elements
 * @param {Element} node - DOM node to process
 */
const wrapTextNodesInSpan = (node) => {
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
      // Wrap text node in a <span>
      const span = document.createElement('span');
      span.textContent = child.textContent.trim();
      node.replaceChild(span, child);
    }
  });
};

/**
 * Map HTML tag to Bricks element type
 * @param {Element} parsedElement - DOM element
 * @param {string} tag - HTML tag name
 * @returns {string} Bricks element name
 */
const elementTagbyHTMLTag = (parsedElement, tag) => {
  if (tag.startsWith("b-")) {
    return tag.replace("b-", "");
  }
  
  // Define the complete mapping that includes all possible elements
  const completeMapping = {
    'section': ['section'],
    'div': ['div', 'a', 'article', 'nav', 'ol', 'ul', 'li', 'aside'],
    'text-basic': ['p', 'span', 'figcaption', 'address'],
    'heading': ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    'image': ['img', 'picture'],
    'video': ['video'],
    'button': ['button'],
    'code': ['style', 'script']
  };

  // The specific keys for elements with text content and no children
  const textOnlyKeys = ['text-basic', 'heading', 'button', 'code'];

  // Check if the element has text content and no children
  if (parsedElement.textContent && typeof parsedElement.textContent === "string" && 
      parsedElement.textContent.length > 0 && parsedElement.children.length === 0) {
    for (const key of textOnlyKeys) {
      if (completeMapping[key].includes(tag)) {
        return key; // Return the corresponding key
      }
    }
    return 'text-basic';
  }

  // If the element has children or no text, check the full mapping
  for (const key in completeMapping) {
    if (completeMapping[key].includes(tag)) {
      return key;
    }
  }

  return 'div';
};

/**
 * Set element ID from parsed HTML
 * @param {Element} parsedElement - DOM element
 * @param {Object} obj - Bricks element object
 * @param {Object} states - Parser states/options
 * @returns {Object} Modified element object
 */
const setIdFromParsedHTML = (parsedElement, obj, states) => {
  const id = parsedElement.id;

  // Excluded
  if (states.excludeIds !== '' && states.excludeIds.replaceAll(' ', '').split(',')
      .some(item => id.trim().toLowerCase().includes(item.trim().toLowerCase()))) {
    return obj;
  }
  
  if (!id && obj.settings.hasOwnProperty('_cssId')) {
    delete obj.settings._cssId;
  } else if (id && id !== `brxe-${obj.id}`) {
    obj.settings._cssId = id;
  }
  return obj;
};

/**
 * Extract base BEM class from element or children
 * @param {Element} parsedElement - DOM element
 * @returns {string|null} Base BEM class name
 */
const extractBaseBEMClass = (parsedElement) => {
  // Check element's own classes first
  const classes = parsedElement.className;
  if (classes && typeof classes === "string") {
    const classesArr = classes.split(' ').filter(c => c.trim());
    
    // Look for classes without BEM modifiers (no __ or --)
    const baseClass = classesArr.find(c => !c.includes('__') && !c.includes('--'));
    if (baseClass) {
      return baseClass;
    }
    
    // If all classes have modifiers, extract base from first class
    const firstClass = classesArr[0];
    if (firstClass) {
      // Extract base from BEM element class (e.g., "cta__button" -> "cta")
      if (firstClass.includes('__')) {
        return firstClass.split('__')[0];
      }
      // Extract base from BEM modifier class (e.g., "button--primary" -> "button")
      if (firstClass.includes('--')) {
        return firstClass.split('--')[0];
      }
    }
  }
  
  // Check children for BEM patterns to infer parent class
  const children = Array.from(parsedElement.children);
  for (const child of children) {
    const childClasses = child.className;
    if (childClasses && typeof childClasses === "string") {
      const childClassesArr = childClasses.split(' ').filter(c => c.trim());
      for (const childClass of childClassesArr) {
        // If child has BEM element class (e.g., "cta__button"), extract base
        if (childClass.includes('__')) {
          return childClass.split('__')[0];
        }
      }
    }
  }
  
  return null;
};

/**
 * Set classes from parsed HTML
 * @param {Element} parsedElement - DOM element
 * @param {Object} obj - Bricks element object
 * @param {Object} states - Parser states/options
 * @param {Array} globalClasses - Existing global classes array
 * @returns {Object} Modified element object with updated globalClasses
 */
const setClassesFromParsedHTML = (parsedElement, obj, states, globalClasses = []) => {
  const classes = parsedElement.className;
  let classesArr = [];
  
  if (classes && typeof classes === "string") {
    classesArr = classes.split(' ').filter(c => c.trim());
  }
  
  // BEM consistency check: ensure parent has base class
  if (states.bemClasses && classesArr.length > 0) {
    const hasChildren = parsedElement.children && parsedElement.children.length > 0;
    const hasBaseClass = classesArr.some(c => !c.includes('__') && !c.includes('--'));
    
    // If element has children and no base class, try to add it
    if (hasChildren && !hasBaseClass) {
      const baseClass = extractBaseBEMClass(parsedElement);
      if (baseClass && !classesArr.includes(baseClass)) {
        console.log(`🔧 BEM Fix: Adding base class "${baseClass}" to parent element`);
        classesArr.unshift(baseClass); // Add at beginning
      }
    }
  }
  
  if (classesArr.length > 0) {
    const globalClassIds = [];
    const cssClasses = [];
    
    classesArr.forEach(tempCls => {
      if (!tempCls.trim()) return;
      
      // Excluded
      if (states.excludeClasses !== '' && states.excludeClasses.replaceAll(' ', '').split(',')
          .some(item => tempCls.trim().toLowerCase().includes(item.trim().toLowerCase()))) {
        return;
      }
      
      const existingGlobalClass = globalClasses.find(el => el && el.name === tempCls);
      if (existingGlobalClass) {
        globalClassIds.push(existingGlobalClass.id);
      } else {
        if (states.createGlobalClasses) {
          const newId = generateId();
          globalClasses.push({
            id: newId,
            name: tempCls,
            settings: {},
          });
          globalClassIds.push(newId);
        } else {
          cssClasses.push(tempCls);
        }
      }
    });
    
    if (globalClassIds.length > 0) {
      obj.settings._cssGlobalClasses = globalClassIds;
    } else {
      delete obj.settings._cssGlobalClasses;
    }
    
    if (cssClasses.length > 0) {
      obj.settings._cssClasses = cssClasses.join(' ');
    } else {
      delete obj.settings._cssClasses;
    }
  } else {
    delete obj.settings._cssGlobalClasses;
    delete obj.settings._cssClasses;
  }

  return obj;
};

/**
 * Set text content from parsed HTML
 * @param {Element} parsedElement - DOM element
 * @param {Object} obj - Bricks element object
 * @param {Object} objConfig - Element configuration
 * @returns {Object} Modified element object
 */
const setTextFromParsedHTML = (parsedElement, obj, objConfig) => {
  const tagName = parsedElement.tagName.toLowerCase();
  
  // Exceptions for style and script tags
  if (tagName === "style") {
    const innerText = parsedElement.innerHTML.trim();
    if (innerText) {
      obj.settings.cssCode = innerText;
      obj.settings.noRoot = true;
    }
    return obj;
  }
  if (tagName === "script") {
    const innerText = parsedElement.innerHTML.trim();
    if (innerText) {
      obj.settings.javascriptCode = innerText;
      obj.settings.noRoot = true;
    }
    return obj;
  }

  // Check if element has child elements (not just text nodes)
  const hasChildElements = parsedElement.children && parsedElement.children.length > 0;
  
  // For container elements with children, don't set text property
  // The children will be parsed as separate Bricks elements
  if (hasChildElements) {
    delete obj.settings.text;
    return obj;
  }
  
  // For leaf elements (no child elements), extract text content
  const innerText = parsedElement.innerHTML.trim();
  
  if (!innerText && objConfig.controls && objConfig.controls.hasOwnProperty('text')) {
    delete obj.settings.text;
  } else if (objConfig.controls && objConfig.controls.hasOwnProperty('text') && 
             innerText && typeof innerText === "string" && innerText.length > 0) {
    obj.settings.text = innerText;
  }

  return obj;
};

/**
 * Capitalize string helper
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
const capitalizeString = (str) => {
  return str.toLowerCase().split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

/**
 * Get filename from URL
 * @param {string} url - URL string
 * @returns {string} Filename
 */
const getFilenameFromUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    return path.split('/').pop();
  } catch (e) {
    return 'placeholder-image-png';
  }
};

/**
 * Get URL with validation
 * @param {string} url - URL string
 * @returns {string} Valid URL or placeholder
 */
const getFilenameURLFromUrl = (url) => {
  try {
    new URL(url);
    return url;
  } catch (e) {
    return 'https://placehold.co/600x400';
  }
};

/**
 * Set attributes from parsed HTML
 * @param {Element} parsedElement - DOM element
 * @param {Object} obj - Bricks element object
 * @param {Object} states - Parser states/options
 * @returns {Object} Modified element object
 */
const setAttributesFromParsedHTML = (parsedElement, obj, states) => {
  const attributes = [];

  for (const attr of parsedElement.attributes) {
    const attrName = attr.name.toLowerCase();
    const attrValue = attr.value.trim();

    // Exclude unwanted attributes
    if (attrName === "id" || attrName === "class" || 
        states.excludeAttributes.replaceAll(' ', '').split(',')
          .some(item => item.trim().toLowerCase() === attrName)) {
      continue;
    }

    // Handle src (image)
    if (attrName === "src") {
      obj.settings.image = {
        url: getFilenameURLFromUrl(attrValue),
        external: true,
        filename: getFilenameFromUrl(attrValue)
      };
    }

    // Bricks Label
    else if (attrName === "data-bricks-label") {
      obj.label = capitalizeString(attrValue);
    }

    // Handle href (link)
    else if (attrName === "href") {
      obj.settings.link = "url";
      obj.settings.url = obj.settings.url || {};
      obj.settings.url.url = attrValue;
      obj.settings.url.type = "external";
    }

    // Handle rel
    else if (attrName === "rel") {
      obj.settings.url = obj.settings.url || {};
      obj.settings.url.rel = attrValue;
    }

    // Handle title
    else if (attrName === "title") {
      obj.settings.url = obj.settings.url || {};
      obj.settings.url.title = attrValue;
    }

    // Handle aria-label
    else if (attrName === "aria-label") {
      obj.settings.url = obj.settings.url || {};
      obj.settings.url.ariaLabel = attrValue;
    }

    // Handle target (newTab)
    else if (attrName === "target" && attrValue === "_blank") {
      obj.settings.url = obj.settings.url || {};
      obj.settings.url.newTab = true;
    }

    // Handle alt (image alt text)
    else if (attrName === "alt") {
      obj.settings.altText = attrValue;
    }

    // Handle loading
    else if (attrName === "loading") {
      obj.settings.loading = attrValue;
    }

    // Handle other attributes
    else {
      const attrObj = {
        id: generateId(),
        name: attrName,
        value: attrValue
      };
      attributes.push(attrObj);
    }
  }

  // Set _attributes if any custom attributes were found, or clean it if empty
  if (attributes.length > 0) {
    obj.settings._attributes = attributes;
  } else if (obj.settings.hasOwnProperty('_attributes')) {
    delete obj.settings._attributes;
  }

  return obj;
};

/**
 * Get element configuration (stub - will be provided by Bricks)
 * @param {string} elementName - Bricks element name
 * @returns {Object} Element configuration
 */
const getElementConfig = (elementName) => {
  // This will be replaced with actual Bricks element config
  // For now, return a default structure
  return {
    tag: elementName === 'text-basic' ? 'p' : 
         elementName === 'heading' ? 'h2' : 
         elementName === 'image' ? 'img' :
         elementName === 'button' ? 'button' : 'div',
    controls: {
      text: elementName === 'text-basic' || elementName === 'heading' || elementName === 'button'
    }
  };
};

/**
 * Check if element is nestable
 * @param {Object} elementObj - Bricks element object
 * @returns {boolean} True if nestable
 */
const isNestable = (elementObj) => {
  // Most elements are nestable except certain types
  const nonNestableTypes = ['image', 'video', 'text-basic', 'heading'];
  return !nonNestableTypes.includes(elementObj.name);
};

/**
 * Parse HTML string into Bricks element object array
 * @param {string} rootId - Root element ID
 * @param {string} parentId - Parent element ID
 * @param {Object} cmValues - Object with html, css, js properties
 * @param {Object} states - Parser configuration/states
 * @param {Array} globalClasses - Global classes array (will be mutated)
 * @returns {Array} Array of Bricks element objects
 */
export const parseHtmlStringToObjectArray = (rootId, parentId, cmValues, states, globalClasses = []) => {
  // Parse the HTML string into a DOM structure
  const parser = new DOMParser();
  const doc = parser.parseFromString(cmValues.html, 'text/html');
  
  // Wrap text nodes without tags into span tags
  doc.body.querySelectorAll('*').forEach(el => {
    const childNodes = Array.from(el.childNodes);
    const hasText = childNodes.some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    const hasElements = childNodes.some(n => n.nodeType === Node.ELEMENT_NODE);
    
    // Only wrap text nodes if this element contains both text and element nodes
    if (hasText && hasElements) {
      wrapTextNodesInSpan(el);
    }
  });

  // This will store the final array of objects
  const elementsArray = [];
  const rootChildren = [];  // To store top-level child IDs
  
  /**
   * Set default tag for element
   */
  const setDefaultTag = (elementObj, tag, hasCustomTag) => {
    if (hasCustomTag) {
      elementObj.settings.tag = 'custom';
      elementObj.settings.customTag = tag;
    } else {
      elementObj.settings.tag = tag;
    }
  };
  
  /**
   * Recursively walk through the DOM and generate objects
   */
  const traverseElement = (element, parentId = rootId) => {
    // Generate a unique ID for the current element
    const id = generateId();
    const tagName = element.tagName.toLowerCase();
    const bricksName = elementTagbyHTMLTag(element, tagName);
    const elementConfig = getElementConfig(bricksName);
    
    // Create the object for the current element
    let elementObj = {
      id: id,
      name: bricksName,
      parent: parentId,
      children: [],
      settings: {},
    };

    const elementIsNestable = isNestable(elementObj);
    
    if (elementConfig.tag !== tagName) {
      if (tagName === "img" || tagName.startsWith('b-')) {
        // silence
      } else {
        let isOption = false;
        if (elementConfig.controls && elementConfig.controls.hasOwnProperty('tag') && 
            !elementConfig.controls.tag.hasOwnProperty('customTag')) {
          // can't change the tag
        }
        if (elementConfig.controls && elementConfig.controls.hasOwnProperty('tag') && 
            elementConfig.controls.tag.hasOwnProperty('options')) {
          for (const key in elementConfig.controls.tag.options) {
            if (key == tagName) isOption = true;
          }
        }
        
        if (isOption) {
          elementObj.settings.tag = tagName;
        } else {
          setDefaultTag(elementObj, tagName, 
            elementConfig.controls && elementConfig.controls.hasOwnProperty('customTag'));
        }
      }
    }
    
    // id
    if (states.includesIds) {
      elementObj = setIdFromParsedHTML(element, elementObj, states);
    }
    
    // Classes
    if (states.includesClasses) {
      elementObj = setClassesFromParsedHTML(element, elementObj, states, globalClasses);
    }
    
    // Text
    if (states.includesTexts) {
      elementObj = setTextFromParsedHTML(element, elementObj, elementConfig);
    }
    
    // Attributes
    if (states.includesAttributes) {
      elementObj = setAttributesFromParsedHTML(element, elementObj, states);
    }
    
    // If the element has children, process them recursively
    const children = [...element.children];
    if (children.length > 0 && elementIsNestable) {
      children.forEach((child) => {
        const childObj = traverseElement(child, id);
        elementObj.children.push(childObj.id); // Add child id to parent's "children" array
      });
    }
    
    // Add the current element object to the final array
    elementsArray.push(elementObj);
    
    return elementObj; // Return the current object
  };
  
  // Traverse the top-level elements in the parsed document body
  [...doc.body.children].forEach((element) => {
    const topLevelElement = traverseElement(element);
    rootChildren.push(topLevelElement.id); // Store top-level children IDs
  });

  if (cmValues.css || cmValues.js) {
    const codeId = generateId();
    const codeObj = {
      id: codeId,
      name: 'code',
      label: 'CSS/JS Code',
      parent: rootId,
      children: [], // Set the correct top-level children here
      settings: {},
    };
    if (cmValues.css) {
      codeObj.settings.cssCode = cmValues.css; // CSS will be beautified on backend
    }
    if (cmValues.js) {
      codeObj.settings.javascriptCode = cmValues.js;
    }
    elementsArray.splice(0, 0, codeObj);
    rootChildren.splice(0, 0, codeId);
  }
  
  const parentObj = {
    id: rootId,
    name: 'div',
    label: 'AI Generated Structure',
    parent: parentId,
    children: rootChildren, // Set the correct top-level children here
    settings: {},
  };
  
  // Add the root element with its updated children array
  elementsArray.push(parentObj);
  return elementsArray;
};

/**
 * Default parser states/configuration
 */
export const getDefaultParserStates = () => ({
  includesIds: true,
  excludeIds: '',
  includesClasses: true,
  excludeClasses: '',
  createGlobalClasses: true,
  bemClasses: true,
  includesTexts: true,
  includesAttributes: true,
  excludeAttributes: '',
  elementsLabels: true,
});

export default {
  parseHtmlStringToObjectArray,
  getDefaultParserStates,
  generateId
};

