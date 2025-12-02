# Bricks Builder Vue State Integration

This document explains how to interact with Bricks Builder's Vue.js state system for plugin development.

## Overview

Bricks Builder uses Vue 3 for its reactive state management. The builder exposes its state through the global `ADMINBRXC` object (in the admin/builder frame) and `FRAMEBRXC` (in the iframe canvas).

## Accessing the Vue State

### Method 1: Via Global ADMINBRXC Object
```javascript
if (typeof window.ADMINBRXC !== 'undefined' && window.ADMINBRXC.vueState) {
  const state = window.ADMINBRXC.vueState;
  // Access state properties
}
```

### Method 2: Via Vue App Instance
```javascript
const brxBody = document.querySelector('.brx-body');
if (brxBody && brxBody.__vue_app__) {
  const vueApp = brxBody.__vue_app__;
  const globalProps = vueApp.config.globalProperties;
  const vueState = globalProps.$_state;
}
```

## Key State Properties

### Element Selection

| Property | Type | Description |
|----------|------|-------------|
| `activeElement` | Object/Proxy | The currently focused element (single selection) |
| `selectedElements` | Array | Array of element objects when multi-selecting (Ctrl/Cmd+click) |
| `activePanel` | String | Currently active panel ("element", "structure", etc.) |

### Element Structure

Each element object contains:
```javascript
{
  id: "abc123",           // Unique element ID
  name: "heading",        // Element type (heading, text-basic, button, etc.)
  parent: "xyz789",       // Parent element ID
  children: [],           // Child element IDs
  label: "My Heading",    // User-defined label (optional)
  settings: {
    text: "Hello World",  // Element-specific settings
    tag: "h1",
    _cssGlobalClasses: ["class-id"]
  }
}
```

### UI State

| Property | Type | Description |
|----------|------|-------------|
| `showContextMenu` | String/Boolean | Element ID if menu is open, false otherwise |
| `breakpointActive` | String | Current breakpoint ("desktop", "tablet", "mobile_landscape", "mobile_portrait") |
| `activeClass` | Object | Currently active global CSS class |
| `unsavedChanges` | Array | Types of unsaved changes ("content", "globalClasses", etc.) |

### Global Data

| Property | Type | Description |
|----------|------|-------------|
| `globalClasses` | Array | All global CSS classes |
| `breakpoints` | Array | Defined breakpoints |
| `colorPalette` | Object | Theme colors |

## Helper Functions

Access helper functions via `vueGlobalProp`:

```javascript
const helpers = window.ADMINBRXC.vueGlobalProp;

// Get element object by ID
const element = helpers.$_getElementObject(elementId);

// Show notification message
helpers.$_showMessage("Success!");

// Save data
helpers.$_saveData();

// Get dynamic element
helpers.$_getDynamicElementById(id);

// Get component element
helpers.$_getComponentElementById(cid);
```

## Text-Capable Element Types

Elements that support text content and their settings property:

| Element | Property | Description |
|---------|----------|-------------|
| `heading` | `text` | Heading elements (h1-h6) |
| `text-basic` | `text` | Basic text/paragraph |
| `text` | `text` | Text element |
| `text-rich` | `text` | Rich text editor |
| `button` | `text` | Button elements |
| `text-link` | `text` | Text link elements |
| `dropdown` | `text` | Dropdown trigger text |
| `icon-box` | `content` | Icon box content (HTML) |
| `alert` | `content` | Alert message content (HTML) |

**Note:** Most elements use `settings.text`, but some use `settings.content` for their text.

## Example: Getting Selected Text Elements

```javascript
function getSelectedTextElements() {
  const admin = window.ADMINBRXC;
  if (!admin?.vueState) return [];

  const textTypes = ['heading', 'text-basic', 'text', 'text-rich', 'button'];
  const textElements = [];

  // Check multi-selection first
  if (admin.vueState.selectedElements?.length > 0) {
    admin.vueState.selectedElements.forEach(item => {
      // Item can be element object or ID depending on context
      const element = typeof item === 'string'
        ? admin.helpers?.getElementObject(item)
        : item;

      if (element && textTypes.includes(element.name)) {
        textElements.push(element);
      }
    });
  }

  // Fallback to single active element
  if (textElements.length === 0 && admin.vueState.activeElement) {
    const active = admin.vueState.activeElement;
    if (textTypes.includes(active.name)) {
      textElements.push(active);
    }
  }

  return textElements;
}
```

## Example: Updating Element Text

```javascript
// Map of element types to their text property
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

function setElementText(elementId, newText) {
  const admin = window.ADMINBRXC;
  if (!admin?.helpers) return false;

  const element = admin.helpers.getElementObject(elementId);
  if (!element?.settings) return false;

  // Get the correct property name for this element type
  const propName = TEXT_ELEMENT_CONFIG[element.name] || 'text';

  // Update text using Object.assign for reliable Vue reactivity
  Object.assign(element.settings, { [propName]: newText });

  // Mark as unsaved
  if (!admin.vueState.unsavedChanges.includes('content')) {
    admin.vueState.unsavedChanges.push('content');
  }

  return true;
}
```

## Example: Closing Context Menu

```javascript
function closeContextMenu() {
  const admin = window.ADMINBRXC;
  if (admin?.vueState) {
    admin.vueState.showContextMenu = false;
  }
}
```

## Important Notes

1. **Vue Reactivity**: State objects are Vue Proxies. Changes trigger reactivity automatically.

2. **Don't Remove DOM Elements**: Other plugins may observe the DOM. Instead of removing elements like the context menu, set state properties to hide them.

3. **Wait for Initialization**: Check that `.brx-body.__vue_app__` exists before accessing state.

4. **Element Objects vs IDs**: `selectedElements` contains full element objects, not just IDs.

5. **Unsaved Changes**: Always push to `unsavedChanges` array when modifying content to enable the save button.

## Useful State Keys (Full List)

Common state properties you might need:
- `activeElement` - Current element
- `selectedElements` - Multi-selected elements
- `activePanel` - Current panel
- `showContextMenu` - Context menu state
- `globalClasses` - CSS classes
- `breakpoints` - Responsive breakpoints
- `breakpointActive` - Current breakpoint
- `unsavedChanges` - Pending changes
- `colorPalette` - Theme colors
- `templateType` - Template type (page, section, header, etc.)
