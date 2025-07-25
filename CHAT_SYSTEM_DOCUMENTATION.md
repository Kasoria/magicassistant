# MagicAssistant Chat System Documentation

## Overview

The MagicAssistant plugin implements a comprehensive AI-powered chat system that provides WordPress-aware assistance through both an admin interface and a floating chat widget. The system uses MagicProxy as an intermediary service to connect to AI providers (OpenAI Responses API/Anthropic Messages API) and leverages the Model Context Protocol (MCP) to provide WordPress-specific context and tools.

**Note:** The system has been migrated from OpenAI's Chat Completions API to the new OpenAI Responses API to provide enhanced capabilities including stateful conversations, tool orchestration, and reasoning support for o-series models.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   MagicProxy    │    │   AI Provider   │
│   (React)       │◄──►│   (PHP)         │◄──►│   Service       │◄──►│   (OpenAI/      │
│                 │    │                 │    │                 │    │   Anthropic)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Components

### 1. Frontend Components

#### ChatInterface.jsx (`src/components/ChatInterface.jsx`)
- **Primary chat interface** handling all user interactions
- Manages conversation state, message history, and session management
- Handles real-time messaging, editing, sharing capabilities
- Integrates with WordPress admin and provides floating widget functionality

**Key Features:**
- Message sending/editing/deletion
- Conversation history management
- Session persistence and switching
- **File upload and attachment support**
- **Custom file creation on-the-fly**
- **Custom system message configuration**
- Image lightbox and media handling
- Conversation sharing (public URLs)
- Context-aware messaging based on current page

#### FloatingChat.jsx (`src/components/FloatingChat.jsx`)
- **Site-wide floating chat widget**
- Customizable appearance and positioning
- Drawer-based interface containing full ChatInterface
- Responsive design with admin-configurable settings

### 2. Backend Core Components

#### AI_Provider.php (`includes/AI_Provider.php`)
- **Central chat processing engine**
- Handles REST API endpoints for chat operations
- Manages AI provider communication through MagicProxy
- Processes context gathering and tool execution

**Key Methods:**
- `handle_chat()` - Main chat processing endpoint at `/magicassistant/v1/chat` (AI_Provider.php:336)
- `handle_chat_mode()` - Core chat logic and AI interaction (AI_Provider.php:605)
- `call_openai()` - OpenAI API integration via MagicProxy (AI_Provider.php:1019)
- `call_anthropic()` - Anthropic API integration via MagicProxy (AI_Provider.php:1076)

#### MCP_Server.php (`includes/MCP_Server.php`)
- **Model Context Protocol implementation**
- Provides WordPress-specific tools and context to AI models
- Manages tool discovery and execution
- Handles WordPress site data integration

#### DB.php (`includes/DB.php`)
- **Database operations for chat functionality**
- Conversation persistence and retrieval
- Session management and user data handling

**Key Methods:**
- `save_chat_message()` - Stores chat messages
- `get_chat_history()` - Retrieves conversation history  
- `get_chat_session()` - Manages chat sessions
- `delete_chat_session()` - Session cleanup
- `truncate_chat_session()` - Message editing support

## Chat Flow & Data Processing

### 1. Message Flow

```
User Input → ChatInterface → REST API → AI_Provider → MagicProxy → AI Provider → Response Processing → Database Storage → Frontend Update
```

### 2. Context Gathering Process

The system gathers context from multiple sources to provide informed AI responses:

#### WordPress Site Context
**GeneralSiteInfo.php** (`includes/Utils/GeneralSiteInfo.php`)
- Site title, description, URL
- WordPress version, theme, and plugin information
- System configuration details

**SiteSettings.php** (`includes/Utils/SiteSettings.php`)  
- Admin settings and preferences
- Reading/writing settings
- Discussion and media settings

**UserInfo.php** (`includes/Utils/UserInfo.php`)
- Current user information and capabilities
- User preferences and roles

#### Page-Specific Context
When chat is used on specific pages, additional context is gathered:

```javascript
// Frontend context gathering (ChatInterface.jsx:398-407)
const context_message = this->build_page_context_message($page_url, $page_context);
```

**Page Context Includes:**
- Current page URL and type
- Post/Page content and metadata  
- Custom fields and taxonomies
- User permissions for current context

#### MCP Tools Context
**MCP_Server.php** provides AI models with WordPress-specific tools:
- Content creation and editing
- User management
- Plugin/theme information
- Database queries
- Media management
- SEO analysis (via DataForSEO integration)

### 3. Data Sent to MagicProxy

#### OpenAI Responses API Request Format (AI_Provider.php:1163-1179)
```php
$request_data = array(
    'action'   => 'openai_responses',
    'data'     => array(
        'model'      => $this->settings['openai_model'] ?? 'gpt-4o',
        'input'      => $input_content, // Converted message input
        'tools'      => $this->get_mcp_tools_for_openai(), // WordPress-specific tools
        'store'      => false, // Zero data retention
        'reasoning'  => $this->get_reasoning_config(), // For o-series models
        'instructions' => $system_message, // System instructions
    ),
    'site_url'  => home_url(),
    'timestamp' => time(),
);
```

#### Anthropic Request Format (AI_Provider.php:1087-1095)
```php
$request_data = array(
    'action'   => 'anthropic',
    'data'     => array(
        'model'      => $this->settings['anthropic_model'] ?? 'claude-sonnet-4-20240229',
        'messages'   => $conversation, // User/assistant messages only
        'system'     => $system_message, // Separated system instructions
    ),
    'site_url'  => home_url(),
    'timestamp' => time(),
);
```

#### Authentication & Headers
```php
// License-based authentication (AI_Provider.php:1034)
$headers = array_merge(
    array('Content-Type' => 'application/json'), 
    $this->get_license_headers()
);

// Optional user API key (AI_Provider.php:1036-1038)
if (!empty($api_key)) {
    $headers['X-User-Api-Key'] = $api_key;
}
```

### 4. MagicProxy Endpoints

**OpenAI Responses API Proxy:** `https://proxy.magicplugins.io/api/proxy/openai` (AI_Provider.php:19)
**Anthropic Proxy:** `https://proxy.magicplugins.io/api/proxy/anthropic` (AI_Provider.php:20)

**MagicProxy Services:**
- OpenAI Responses API integration and authentication
- Anthropic Messages API support
- Usage tracking and billing
- Rate limiting and quota management
- Response caching and optimization
- Additional services (Unsplash, PageSpeed, DataForSEO)

## Message Processing Pipeline

### 1. User Message Processing (AI_Provider.php:336-429)

```php
public function handle_chat($request) {
    // Extract request parameters
    $message = $data['message'];
    $conversation_history = $data['history'] ?? [];
    $session_id = $data['session_id'] ?? $this->generate_session_id();
    $page_context = $data['page_context'] ?? null;
    
    // Save user message to database
    $this->db->save_chat_message($user_id, $session_id, 'user', $message);
    
    // Build enhanced context with page information
    if (!empty($page_url) || !empty($page_context)) {
        $context_message = $this->build_page_context_message($page_url, $page_context);
        array_unshift($conversation_history, [
            'role' => 'system',
            'content' => $context_message
        ]);
    }
    
    // Process through AI provider
    return $this->handle_chat_mode($message, $conversation_history, $provider, $api_key);
}
```

### 2. AI Processing & Tool Execution (AI_Provider.php:605-774)

```php
private function handle_chat_mode($message, $conversation_history, $provider, $api_key) {
    // Limit conversation history to save tokens
    $history_limit = $this->settings['conversation_history_limit'] ?? 20;
    
    // Build system message with MCP tools
    $system_message = $this->build_system_message();
    
    // Prepare complete message array
    $messages = array_merge(
        [['role' => 'system', 'content' => $system_message]],
        $conversation_history,
        [['role' => 'user', 'content' => $message]]
    );
    
    // Initial AI call using Responses API for OpenAI
    $response = ($provider === 'openai') 
        ? $this->call_openai($messages, $api_key) // Uses Responses API
        : $this->call_anthropic($messages, $api_key);
    
    // Execute tools if requested
    if (isset($response['tool_calls'])) {
        $tool_results = $this->execute_tools($response['tool_calls']);
        
        // Add tool results to conversation and get final response
        // [Tool execution and final AI call logic]
    }
    
    return $this->prepare_final_response($response, $session_id);
}
```

### 3. Tool Execution Integration

When AI models request tool usage, the system:

1. **Validates tool calls** against registered MCP tools
2. **Executes WordPress operations** (content creation, data retrieval, etc.)
3. **Returns structured results** to the AI model for processing
4. **Generates final response** incorporating tool results

## Session Management

### 1. Session Creation & Persistence
- Each conversation gets a unique session ID
- Sessions persist across page reloads and browser sessions
- Database storage enables conversation history and resumption

### 2. Session Operations
- **Create:** Auto-generated on first message
- **Load:** Retrieve full conversation history
- **Update:** Save new messages and session metadata
- **Delete:** Remove session and all associated messages
- **Share:** Generate public URLs for conversation sharing

## Context Enhancement Features

### 1. Page-Aware Context
- Automatically detects current WordPress page/post
- Includes content, metadata, and user permissions
- Provides relevant context for page-specific assistance

### 2. WordPress Integration Context
- Site configuration and settings
- Installed plugins and themes
- User roles and capabilities
- Content structure and taxonomies

### 3. MCP Tool Integration
- WordPress-specific functions available to AI
- Real-time data access and manipulation
- Seamless integration with WordPress APIs

## Security & Authentication

### 1. WordPress Authentication
- Leverages WordPress nonce verification
- Respects user capabilities and permissions
- Session-based user identification

### 2. API Key Management
- Encrypted storage of user-provided API keys
- Fallback to MagicProxy managed credentials
- Usage tracking and quota management

### 3. Data Privacy
- Local database storage for conversations
- Optional conversation sharing with expiration
- User-controlled data retention

## Performance Optimizations

### 1. Token Management
- Conversation history limiting to reduce costs
- Message deduplication to avoid redundancy
- Context-aware system message generation

### 2. Caching & Efficiency
- MCP tool discovery caching
- Response streaming for real-time updates
- Efficient database queries for history retrieval

### 3. Resource Management
- Configurable response length limits
- Timeout handling for API requests
- Progressive loading for large conversations

## Error Handling & Resilience

### 1. API Error Management
- Graceful fallback for service failures
- User-friendly error messages
- Automatic retry mechanisms where appropriate

### 2. Data Validation
- Input sanitization and validation
- SQL injection prevention
- XSS protection for user content

### 3. Service Availability
- MagicProxy redundancy and failover
- Local fallback capabilities
- Graceful degradation of advanced features

## Integration Points

### 1. WordPress Admin Integration
- Native admin interface integration
- Settings management through WordPress admin
- User preference synchronization

### 2. Frontend Widget Integration
- Site-wide floating chat availability
- Customizable appearance and behavior
- Responsive design for all devices

### 3. Third-Party Service Integration
- **Unsplash:** Image search and selection
- **DataForSEO:** SEO analysis and recommendations  
- **PageSpeed Insights:** Performance analysis
- **WordPress APIs:** Full site management capabilities

## Enhanced Chat Features (Latest Update)

### 1. File Upload & Attachment System

The chat system now supports comprehensive file handling capabilities:

#### Supported File Types
- **Text Files:** .txt, .md, .log
- **Code Files:** .js, .css, .html, .php, .py
- **Data Files:** .json, .xml, .csv

#### Upload Methods
1. **File Upload Button:** Click the 📎 button in the chat input area
2. **Drag & Drop:** Drop files directly onto the chat input area
3. **Custom File Creation:** Use the + button to create files on-the-fly

#### Frontend Implementation (ChatInterface.jsx:58-65)
```javascript
// File upload and attachment states
const [attachedFiles, setAttachedFiles] = useState([])
const [isFileModalOpen, setIsFileModalOpen] = useState(false)
const [customFileContent, setCustomFileContent] = useState('')
const [customFileName, setCustomFileName] = useState('')
const [customFileType, setCustomFileType] = useState('txt')
const [isDragOver, setIsDragOver] = useState(false)
const fileInputRef = useRef(null)
```

#### Backend Processing (AI_Provider.php:346-347)
```php
$attached_files = $data['attached_files'] ?? [];
$custom_system_message = $data['custom_system_message'] ?? null;
```

File contents are automatically embedded into the user message for AI context processing.

### 2. Custom System Messages

Users can now override the default AI system prompt with custom instructions:

#### Features
- **Custom System Prompt:** Replace default AI instructions
- **Persistent Storage:** Settings saved in localStorage
- **Easy Management:** Enable/disable toggle in settings modal

#### Implementation Details
- **Frontend Storage:** `localStorage.setItem('magicassistant_custom_system_message', customSystemMessage)`
- **Backend Processing:** Custom messages override default system prompts in both chat and agent modes
- **Settings Interface:** Comprehensive settings modal with custom system message configuration

#### Backend Integration (AI_Provider.php:1015-1019)
```php
private function build_system_message($custom_system_message = null) {
    // If custom system message is provided, use it instead of the default
    if (!empty($custom_system_message)) {
        return $custom_system_message;
    }
    // ... default system message logic
}
```

### 3. Enhanced Settings Modal

The new settings modal provides comprehensive chat configuration:

#### Sections
1. **Custom System Message Configuration**
   - Enable/disable custom system messages
   - Textarea for custom prompt input
   - Save/clear functionality

2. **File Upload Information**
   - Supported file types documentation
   - Upload methods explanation
   - Usage tips and best practices

3. **Available Features Overview**
   - Feature explanations and capabilities
   - Usage guidelines for different modes

### 4. Message Enhancement

Messages now support file attachment display and enhanced formatting:

#### File Attachment Display
- Visual file indicators with type and size
- Custom file badges for user-created files
- Easy removal functionality

#### Message Content Processing
File contents are automatically formatted and included in messages:
```javascript
// Prepare message content with file attachments
let messageContent = inputMessage || ''
if (attachedFiles.length > 0) {
  const filesList = attachedFiles.map(file => {
    if (file.content) {
      return `**File: ${file.name}** (${file.type})\n\`\`\`\n${file.content}\n\`\`\``
    } else {
      return `**File: ${file.name}** (${file.type}, ${(file.size / 1024).toFixed(1)}KB) - Binary file attached`
    }
  }).join('\n\n')
  
  messageContent = messageContent ? `${messageContent}\n\n${filesList}` : filesList
}
```

### 5. API Request Enhancement

The chat API now supports the new parameters:

#### Enhanced Request Structure (AI_Provider.php:385-395)
```php
body: JSON.stringify({
  message: messageContent,
  history: messages.filter(msg => msg.role !== 'system').map(msg => ({
    role: msg.role,
    content: msg.content
  })),
  agent_mode: forceAgentMode,
  session_id: currentSessionId,
  page_url: pageContext.url,
  page_context: pageContext,
  attached_files: attachedFiles.length > 0 ? attachedFiles.map(f => ({
    name: f.name,
    type: f.type,
    size: f.size,
    content: f.content
  })) : undefined,
  custom_system_message: enableCustomSystem && customSystemMessage ? customSystemMessage : undefined
})
```

### 6. User Experience Improvements

#### Drag & Drop Interface
- Visual feedback when dragging files over input area
- Ring highlight effect during drag operations
- Smooth file attachment workflow

#### Custom File Creation Modal
- Intuitive file creation interface
- Multiple file type support
- Syntax highlighting for code content
- Real-time validation

#### Settings Persistence
- Custom system messages persist across sessions
- File preferences maintained
- User-friendly toggle controls
- **File Persistence Toggle:** Option to keep files attached throughout entire chat sessions

#### File Persistence Feature
- **Toggle Setting:** Enable/disable in chat settings modal
- **Default:** Off (files clear after each message)
- **When Enabled:** Files remain attached to all subsequent messages
- **Visual Indicator:** Shows "Files will persist throughout chat" when enabled
- **Manual Clear:** Option to manually clear persistent files

This documentation provides a comprehensive understanding of how the enhanced MagicAssistant chat system operates, from user interaction through AI processing to response delivery, with detailed context gathering, file attachment support, and WordPress integration throughout the entire pipeline.