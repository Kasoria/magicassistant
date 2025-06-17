# MagicAssistant Bricks Integration

This document outlines the Bricks pagebuilder integration for MagicAssistant, allowing the AI to create native Bricks elements instead of raw HTML content.

## Overview

The Bricks integration enables MagicAssistant to:
- Detect when users are working in Bricks builder mode
- Provide native Bricks element tools to the AI
- Create structured Bricks elements (headings, text, buttons, containers, etc.)
- Save elements directly to Bricks page data
- Integrate seamlessly with the floating chat interface

## Architecture

### Core Components

1. **Pagebuilder_Integration.php** - Main manager class
   - Detects active pagebuilders
   - Loads appropriate integration classes
   - Manages MCP server integration

2. **Bricks_Integration.php** - Bricks-specific integration
   - Registers Bricks element tools
   - Handles element creation and data management
   - Provides Bricks context detection

3. **bricks-integration.js** - Frontend JavaScript
   - Provides UI enhancements in Bricks builder
   - Handles element addition notifications
   - Manages pagebuilder context for chat interface

## Available Bricks Tools

The integration provides the following MCP tools for AI use:

### bricks_add_heading
Creates a native Bricks heading element.
```json
{
  "text": "Your heading text",
  "tag": "h1|h2|h3|h4|h5|h6",
  "parent_id": "optional_parent_element_id",
  "position": -1
}
```

### bricks_add_text
Creates a native Bricks text/paragraph element.
```json
{
  "content": "Your text content (HTML allowed)",
  "parent_id": "optional_parent_element_id", 
  "position": -1
}
```

### bricks_add_image
Creates a native Bricks image element.
```json
{
  "image_id": 123,
  "image_url": "https://example.com/image.jpg",
  "alt_text": "Image description",
  "size": "thumbnail|medium|large|full",
  "parent_id": "optional_parent_element_id",
  "position": -1
}
```

### bricks_add_button
Creates a native Bricks button element.
```json
{
  "text": "Button text",
  "link": "https://example.com",
  "style": "primary|secondary|outline|text",
  "size": "small|medium|large",
  "parent_id": "optional_parent_element_id",
  "position": -1
}
```

### bricks_add_container
Creates a native Bricks container/section element.
```json
{
  "tag": "div|section|article|header|footer|main",
  "direction": "column|row",
  "justify": "flex-start|center|flex-end|space-between|space-around",
  "align": "flex-start|center|flex-end|stretch",
  "gap": "0px|10px|20px|30px|40px",
  "padding": "0px|10px|20px|30px|40px",
  "margin": "0px|10px|20px|30px|40px",
  "background_color": "#ffffff",
  "parent_id": "optional_parent_element_id",
  "position": -1
}
```

### bricks_add_list
Creates a native Bricks list element.
```json
{
  "items": ["Item 1", "Item 2", "Item 3"],
  "list_type": "ul|ol",
  "parent_id": "optional_parent_element_id",
  "position": -1
}
```

## Detection Logic

The integration detects Bricks in the following scenarios:

1. **Builder Mode**: When `bricks_is_builder()` returns true
2. **Builder Calls**: When `bricks_is_builder_call()` returns true  
3. **Bricks Context**: When editing a page/post that uses Bricks editor mode

## Data Management

### Bricks Constants Used
- `BRICKS_DB_PAGE_CONTENT` (`_bricks_page_content_2`) - Stores element data
- `BRICKS_DB_EDITOR_MODE` (`_bricks_editor_mode`) - Stores editor mode setting

### Element Structure
Each Bricks element created has the following structure:
```php
array(
    'id' => 'magicai_' . uniqid(),
    'name' => 'element_type',
    'settings' => array(
        // Element-specific settings
    ),
    'parent' => 'parent_element_id_or_0',
    'children' => array()
)
```

## Installation & Setup

1. Ensure the MagicAssistant plugin is installed and activated
2. Activate the Bricks theme
3. The integration will automatically detect and initialize when Bricks is active

## Testing

### Manual Testing
Add `?test_bricks_integration=1` to any page URL while logged in as admin to run integration tests.

### Test Features
- Environment validation
- Tool registration verification
- Constants availability check
- Current page Bricks data inspection
- Live tool testing with "Test Add Heading" button

## Usage Examples

### In AI Chat
When working in Bricks builder mode, you can ask the AI:

- "Add a heading that says 'Welcome to our site'"
- "Create a button that links to our contact page"  
- "Add a text paragraph explaining our services"
- "Create a container with two columns"

The AI will automatically use the appropriate Bricks tools instead of generating HTML.

### Programmatic Usage
```php
// Get MCP server instance
$mcp_server = MATMCP();

// Call a Bricks tool directly
$result = $mcp_server->invoke_tool('bricks_add_heading', array(
    'text' => 'Dynamic Heading',
    'tag' => 'h2'
));
```

## Integration with Chat Interface

The integration automatically:
- Sets pagebuilder context in chat interface (`window.magicAssistantData.pagebuilder = 'bricks'`)
- Shows visual indicators when active in Bricks builder
- Provides notifications when elements are added
- Enables pagebuilder-specific chat features

## Troubleshooting

### Common Issues

1. **Tools not registered**: Verify Bricks theme is active and constants are defined
2. **Elements not appearing**: Check if post is set to use Bricks editor mode
3. **Permission errors**: Ensure user has appropriate capabilities
4. **JavaScript errors**: Check browser console and verify jQuery is loaded

### Debug Information
Enable WordPress debug mode (`WP_DEBUG = true`) to access the test interface and debug information.

## Future Enhancements

Planned improvements include:
- Support for more Bricks elements (galleries, forms, etc.)
- Advanced styling options
- Template and loop integration
- Real-time preview updates
- Drag-and-drop positioning

## API Reference

### Class Methods

#### Pagebuilder_Integration
- `detect_bricks()` - Detects if Bricks is active
- `get_active_integration()` - Returns active integration instance
- `has_active_integration()` - Checks if any pagebuilder is active

#### Bricks_Integration  
- `add_heading_element($args)` - Creates heading element
- `add_text_element($args)` - Creates text element
- `add_button_element($args)` - Creates button element
- `add_container_element($args)` - Creates container element
- `add_image_element($args)` - Creates image element
- `add_list_element($args)` - Creates list element

### JavaScript Functions

#### Global Functions
- `window.magicAssistantBricks.refreshPanel()` - Refreshes Bricks panel
- `window.magicAssistantBricks.getContext()` - Gets current Bricks context
- `window.magicAssistantBricks.addElement(data)` - Handles element additions

### WordPress Hooks

#### Actions Used
- `init` - Initializes pagebuilder detection
- `wp_enqueue_scripts` - Enqueues integration scripts
- `wp_footer` - Adds footer scripts

#### Filters Available
- `magic_assistant_bricks_element_data` - Modify element data before saving
- `magic_assistant_bricks_detect_context` - Customize detection logic

## Support

For issues or questions regarding the Bricks integration:
1. Check the test interface for diagnostic information
2. Review WordPress debug logs
3. Verify Bricks theme compatibility
4. Check MCP server status and tool registration 