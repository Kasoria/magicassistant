<?php

namespace MagicAssistant;

// Import global PHP/WordPress classes
use Exception;
use WP_Error;

if (!defined('ABSPATH')) exit;

class AI_Provider {
    
    private $settings;
    private $mcp_server;
    private $db;
    
    public function __construct() {
        add_action('rest_api_init', array($this, 'register_rest_routes'));
    }
    
    public function set_mcp_server($mcp_server) {
        $this->mcp_server = $mcp_server;
    }
    
    public function set_db($db) {
        $this->db = $db;
        // Load settings from database
        $this->settings = $this->db ? $this->db->get_all_settings() : array();
    }
    
    public function register_rest_routes() {
        // Chat endpoint
        register_rest_route('magicassistant/v1', '/chat', array(
            'methods' => 'POST',
            'callback' => array($this, 'handle_chat'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        // Chat history endpoints
        register_rest_route('magicassistant/v1', '/chat-history', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_chat_history'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/chat-sessions', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_chat_sessions'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/chat-sessions/(?P<session_id>[a-zA-Z0-9_]+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_chat_session'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/chat-sessions/(?P<session_id>[a-zA-Z0-9_]+)/title', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_chat_title'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        // Settings endpoints
        register_rest_route('magicassistant/v1', '/settings', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_settings'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/settings', array(
            'methods' => 'POST',
            'callback' => array($this, 'save_settings'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        // API key deletion endpoint
        register_rest_route('magicassistant/v1', '/delete-api-key', array(
            'methods' => 'POST',
            'callback' => array($this, 'delete_api_key'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        // Analytics endpoint
        register_rest_route('magicassistant/v1', '/analytics', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_analytics'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
    }
    
    public function handle_chat($request) {
        $data = $request->get_json_params();
        $message = $data['message'] ?? '';
        $conversation_history = $data['history'] ?? [];
        $agent_mode = $data['agent_mode'] ?? $this->determine_agent_mode($message);
        $session_id = $data['session_id'] ?? $this->generate_session_id();
        $is_message_edit = $data['is_message_edit'] ?? false;
        $truncate_at_message = $data['truncate_at_message'] ?? null;
        
        if (empty($message)) {
            return new WP_Error('empty_message', 'Message is required', array('status' => 400));
        }
        
        $user_id = get_current_user_id();
        $start_time = microtime(true);
        
        try {
            // Handle message editing - truncate conversation at the specified point
            if ($is_message_edit && $truncate_at_message !== null && $this->db) {
                $this->db->truncate_chat_session($user_id, $session_id, $truncate_at_message);
            }
            
            // Save user message to database immediately
            if ($this->db) {
                $this->db->save_chat_message(
                    $user_id,
                    $session_id,
                    'user',
                    $message
                );
            }
            
            // Get AI provider settings
            $provider = $this->settings['ai_provider'] ?? 'openai';
            $model = $this->get_model_for_provider($provider);
            
            // Get the appropriate API key based on provider
            if ($provider === 'openai') {
                $encrypted_key = $this->settings['openai_api_key'] ?? '';
                $api_key = $this->db ? $this->db->decrypt_api_key($encrypted_key) : '';
            } elseif ($provider === 'anthropic') {
                $encrypted_key = $this->settings['anthropic_api_key'] ?? '';
                $api_key = $this->db ? $this->db->decrypt_api_key($encrypted_key) : '';
            } else {
                $api_key = '';
            }
            
            if (empty($api_key)) {
                throw new Exception('AI API key not configured for ' . $provider . '. Please add your API key in settings.');
            }
            
            if ($agent_mode) {
                // Use agent mode for complex multi-step tasks
                $result = $this->handle_agent_mode($message, $conversation_history, $provider, $api_key);
            } else {
                // Use simple chat mode
                $result = $this->handle_chat_mode($message, $conversation_history, $provider, $api_key);
            }
            
            $response_time = microtime(true) - $start_time;
            
            // Save AI response to database
            if ($this->db) {
                $this->db->save_chat_message(
                    $user_id,
                    $session_id,
                    'assistant',
                    $result['response'],
                    $provider,
                    $model,
                    $result['tokens_used'] ?? null,
                    $response_time,
                    $result['cost'] ?? null
                );
                
                // Log the API request for analytics
                $this->db->log_api_request(
                    $user_id,
                    $provider,
                    $model,
                    $provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages',
                    array('message' => $message), // Request data (simplified)
                    array('response' => $result['response']), // Response data (simplified)
                    200, // Status code (assuming success if we got here)
                    $result['tokens_used'] ?? null,
                    $result['cost'] ?? null,
                    $response_time
                );
            }
            
            return array(
                'success' => true,
                'response' => $result['response'],
                'provider' => $provider,
                'model' => $model,
                'agent_mode' => $agent_mode,
                'reasoning' => $result['reasoning'] ?? null,
                'tool_calls_count' => $result['tool_calls_count'] ?? 0,
                'session_id' => $session_id,
                'response_time' => $response_time,
                'tokens_used' => $result['tokens_used'] ?? null,
                'cost' => $result['cost'] ?? 0
            );
            
        } catch (Exception $e) {
            $error_response_time = microtime(true) - $start_time;
            
            // Save error message to database if we have a session
            if ($this->db && isset($session_id)) {
                $this->db->save_chat_message(
                    $user_id,
                    $session_id,
                    'assistant',
                    'Error: ' . $e->getMessage(),
                    $provider ?? 'unknown',
                    $model ?? null,
                    null,
                    $error_response_time
                );
                
                // Log the API error for analytics
                $this->db->log_api_request(
                    $user_id,
                    $provider ?? 'unknown',
                    $model ?? null,
                    ($provider ?? 'unknown') === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://api.anthropic.com/v1/messages',
                    array('message' => $message), // Request data (simplified)
                    array('error' => $e->getMessage()), // Error response
                    500, // Status code for error
                    null,
                    null,
                    $error_response_time,
                    $e->getMessage()
                );
            }
            
            return new WP_Error('chat_error', $e->getMessage(), array('status' => 500));
        }
    }
    
    private function determine_agent_mode($message) {
        $setting = $this->settings['agent_mode'] ?? 'auto';
        
        switch ($setting) {
            case 'always':
                return true;
            case 'never':
                return false;
            case 'auto':
            default:
                return $this->should_use_agent_mode($message);
        }
    }
    
    private function should_use_agent_mode($message) {
        $message_lower = strtolower($message);
        
        // Check for comprehensive data requests that need multiple fetches
        $comprehensive_triggers = [
            'all.*endpoints?', 'all.*posts?', 'all.*products?', 'all.*orders?', 'all.*users?',
            'show.*all', 'list.*all', 'get.*all', 'fetch.*all', 'retrieve.*all',
            'complete.*list', 'full.*list', 'entire.*list', 'comprehensive.*list',
            'everything', 'every.*endpoint', 'every.*post', 'every.*product'
        ];
        
        foreach ($comprehensive_triggers as $trigger) {
            if (preg_match('/' . $trigger . '/', $message_lower)) {
                return true;
            }
        }
        
        // Check if the message contains multiple tasks or complex requests
        $agent_triggers = [
            'create.*and.*', 'add.*and.*', 'update.*and.*', 'delete.*and.*',
            'first.*then.*', 'after.*do.*', 'next.*', 'also.*',
            'multiple', 'several', 'both', 'all of the following',
            'step by step', 'workflow', 'automation', 'batch',
            'analyze.*create', 'find.*update', 'search.*create',
            'list.*add', 'get.*create', 'show.*update'
        ];
        
        foreach ($agent_triggers as $trigger) {
            if (preg_match('/' . $trigger . '/', $message_lower)) {
                return true;
            }
        }
        
        // Count potential actions in the message
        $action_words = ['create', 'add', 'update', 'delete', 'list', 'get', 'find', 'search', 'show', 'set', 'change', 'modify'];
        $action_count = 0;
        foreach ($action_words as $action) {
            $action_count += substr_count($message_lower, $action);
        }
        
        return $action_count >= 2;
    }
    
    private function handle_chat_mode($message, $conversation_history, $provider, $api_key) {
        // Prepare system message with MCP tools information
        $system_message = $this->build_system_message();
        
        // Build conversation with system message
        $messages = array_merge(
            [['role' => 'system', 'content' => $system_message]],
            $conversation_history,
            [['role' => 'user', 'content' => $message]]
        );
        
        // Call AI provider
        if ($provider === 'openai') {
            $response = $this->call_openai($messages, $api_key);
        } elseif ($provider === 'anthropic') {
            $response = $this->call_anthropic($messages, $api_key);
        } else {
            throw new Exception('Unsupported AI provider: ' . $provider);
        }
        
        // Process any tool calls
        $final_response = $this->process_ai_response($response);
        
        // Extract token usage and cost
        $tokens_used = $this->extract_token_count($response, $provider);
        $cost = $response['cost'] ?? 0;
        
        return array(
            'response' => $final_response,
            'tool_calls_count' => isset($response['tool_calls']) ? count($response['tool_calls']) : 0,
            'tokens_used' => $tokens_used,
            'cost' => $cost
        );
    }
    
    private function handle_agent_mode($message, $conversation_history, $provider, $api_key) {
        $max_iterations = $this->settings['max_agent_iterations'] ?? 5; // Prevent infinite loops
        $iteration = 0;
        $reasoning_chain = [];
        $total_tool_calls = 0;
        $all_tool_results = []; // Store all tool results for final display
        
        // Prepare enhanced system message for agent mode
        $system_message = $this->build_agent_system_message();
        
        // Build initial conversation
        $messages = array_merge(
            [['role' => 'system', 'content' => $system_message]],
            $conversation_history,
            [['role' => 'user', 'content' => $message]]
        );
        
        $final_response = '';
        
        while ($iteration < $max_iterations) {
            $iteration++;
            
            // Call AI provider
            if ($provider === 'openai') {
                $response = $this->call_openai($messages, $api_key);
            } elseif ($provider === 'anthropic') {
                $response = $this->call_anthropic($messages, $api_key);
            } else {
                throw new Exception('Unsupported AI provider: ' . $provider);
            }
            
            $has_tool_calls = isset($response['tool_calls']) && !empty($response['tool_calls']);
            
            if ($has_tool_calls) {
                // Execute tools and continue conversation
                $tool_results = $this->execute_tools($response['tool_calls']);
                $total_tool_calls += count($response['tool_calls']);
                
                // Store tool results for final display
                $all_tool_results = array_merge($all_tool_results, $tool_results);
                
                // Add AI response to conversation (format for provider)
                if ($provider === 'anthropic') {
                    $messages[] = array(
                        'role' => 'assistant',
                        'content' => array(
                            array(
                                'type' => 'text',
                                'text' => $response['content'] ?? ''
                            )
                        )
                    );
                    
                    // Add tool results for Anthropic
                    foreach ($tool_results as $result) {
                        $messages[] = array(
                            'role' => 'user',
                            'content' => array(
                                array(
                                    'type' => 'tool_result',
                                    'tool_use_id' => $result['tool'] . '_' . uniqid(),
                                    'content' => json_encode($result)
                                )
                            )
                        );
                    }
                } else {
                    // OpenAI format
                    $messages[] = array(
                        'role' => 'assistant',
                        'content' => $response['content'] ?? '',
                        'tool_calls' => $response['tool_calls']
                    );
                    
                    // Add tool results to conversation
                    foreach ($tool_results as $result) {
                        $messages[] = array(
                            'role' => 'tool',
                            'tool_call_id' => $result['tool_call_id'], // Required by OpenAI API
                            'content' => json_encode($result)
                        );
                    }
                }
                
                // Add reasoning step
                $reasoning_chain[] = array(
                    'step' => $iteration,
                    'action' => 'tool_execution',
                    'tools_used' => array_column($tool_results, 'tool'),
                    'reasoning' => $response['content'] ?? '',
                    'tool_results' => $tool_results // Store results for reference
                );
                
                // Continue the conversation to let AI process results and potentially make more calls
                $continue_message = "Please continue processing the user's request. If you need to perform additional actions, use the appropriate tools. If you're done, provide a final summary of what you've accomplished INCLUDING the detailed results from the tools you used.";
                $messages[] = array(
                    'role' => 'user',
                    'content' => $continue_message
                );
                
            } else {
                // No more tool calls, this is the final response
                $final_response = $response['content'] ?? '';
                $reasoning_chain[] = array(
                    'step' => $iteration,
                    'action' => 'final_response',
                    'reasoning' => 'Task completed, providing final summary'
                );
                break;
            }
        }
        
        if ($iteration >= $max_iterations) {
            $final_response .= "\n\n⚠️ Agent reached maximum iteration limit. Task may be partially complete.";
        }
        
        // If the final response doesn't contain detailed tool results, add them
        if ($total_tool_calls > 0 && !empty($all_tool_results)) {
            // Check if the final response already contains detailed data
            $has_detailed_results = false;
            foreach ($all_tool_results as $result) {
                if ($result['tool'] === 'list_api_functions' && 
                    strpos($final_response, 'GET /') !== false && 
                    strpos($final_response, 'POST /') !== false) {
                    $has_detailed_results = true;
                    break;
                }
            }
            
            // If AI didn't include detailed results, add them
            if (!$has_detailed_results) {
                $final_response .= "\n\n## Detailed Results\n";
                $final_response .= $this->format_tool_results($all_tool_results);
            }
            
            $final_response = $this->format_agent_response($final_response, $reasoning_chain, $total_tool_calls);
        }
        
        // Calculate total tokens and cost across all iterations
        $total_tokens = 0;
        $total_cost = 0;
        
        // Note: In agent mode, we need to track usage across multiple API calls
        // This is a simplified approach - ideally we'd track each call separately
        
        return array(
            'response' => $final_response,
            'reasoning' => $reasoning_chain,
            'tool_calls_count' => $total_tool_calls,
            'tokens_used' => $total_tokens, // Will be 0 for now in agent mode
            'cost' => $total_cost // Will be 0 for now in agent mode
        );
    }
    
    private function execute_tools($tool_calls) {
        $tool_results = [];
        
        foreach ($tool_calls as $tool_call) {
            $tool_name = $tool_call['function']['name'] ?? $tool_call['name'] ?? '';
            $tool_args = json_decode($tool_call['function']['arguments'] ?? '{}', true) ?: $tool_call['input'] ?? [];
            $tool_call_id = $tool_call['id'] ?? null; // Extract the tool call ID for OpenAI
            
            try {
                $result = $this->execute_mcp_tool($tool_name, $tool_args);
                $tool_results[] = array(
                    'tool' => $tool_name,
                    'tool_call_id' => $tool_call_id, // Preserve the tool call ID
                    'result' => $result,
                    'success' => true
                );
            } catch (Exception $e) {
                $tool_results[] = array(
                    'tool' => $tool_name,
                    'tool_call_id' => $tool_call_id, // Preserve the tool call ID even for errors
                    'error' => $e->getMessage(),
                    'success' => false
                );
            }
        }
        
        return $tool_results;
    }
    
    private function format_agent_response($response, $reasoning_chain, $tool_calls_count) {
        $formatted = $response;
        
        if ($tool_calls_count > 0) {
            $formatted .= "\n\n---\n";
            $formatted .= "🤖 **Agent Summary**: Completed {$tool_calls_count} tool calls across " . count($reasoning_chain) . " reasoning steps.\n";
            
            // Add brief summary of actions taken
            $actions_taken = [];
            foreach ($reasoning_chain as $step) {
                if ($step['action'] === 'tool_execution' && !empty($step['tools_used'])) {
                    $actions_taken = array_merge($actions_taken, $step['tools_used']);
                }
            }
            
            if (!empty($actions_taken)) {
                $unique_actions = array_unique($actions_taken);
                $formatted .= "**Tools used**: " . implode(', ', $unique_actions) . "\n";
            }
        }
        
        return $formatted;
    }
    
    private function build_agent_system_message() {
        $tools_info = '';
        
        if ($this->mcp_server && $this->mcp_server->is_enabled()) {
            // Get all registered tools dynamically
            $registered_tools = $this->mcp_server->get_registered_tools();
            $tool_descriptions = [];
            
            foreach ($registered_tools as $name => $tool) {
                $description = $tool['description'] ?? 'No description available';
                
                // Add special notes for certain tools
                $special_note = '';
                if ($name === 'list_api_functions') {
                    $special_note = ' (use filters to avoid overwhelming responses)';
                }
                
                $tool_descriptions[] = "- {$name}: {$description}{$special_note}";
            }
            
            $tools_list = implode("\n", $tool_descriptions);
            
            $tools_info = "
You have access to WordPress MCP tools to help manage this WordPress site:

Available Tools:
{$tools_list}

IMPORTANT AGENT MODE INSTRUCTIONS:
- You are operating in AGENT MODE for complex multi-step tasks
- You can perform multiple tool calls in sequence to complete complex requests
- After each tool execution, assess if more actions are needed to fully satisfy the user's request
- Break down complex requests into logical steps
- Continue using tools until the user's complete request is fulfilled
- Provide reasoning for each step you take
- When finished, provide a comprehensive summary of all actions taken INCLUDING the detailed results from ALL tool executions

AUTOMATIC DATA FETCHING:
- When you see \"🔄 **FETCH_MORE_SUGGESTED**\" or \"🔄 **FETCH_MORE_AVAILABLE**\" in tool results, you SHOULD automatically fetch the additional data if it's relevant to the user's request
- Use the suggested parameters (offset, per_page, pagination, filters) to get complete data sets
- For large datasets, prioritize the most relevant results first, then fetch additional data as needed
- If user asks for \"all\" items or comprehensive lists, automatically fetch all available data using pagination

CRITICAL: ALWAYS SHOW DETAILED RESULTS
- When you complete your tasks, include ALL the detailed data you retrieved (e.g., the full list of endpoints, posts, products, etc.)
- Don't just summarize that you \"found 35 endpoints\" - actually LIST all 35 endpoints with their methods and paths
- Users need to see the complete data, not just summaries

TOOL SELECTION GUIDANCE:
- For common WordPress tasks, use dedicated tools (wp_get_posts, wp_get_users, wp_create_post, etc.)
- Use run_api_function only when no dedicated tool exists for your specific need
- Use list_api_functions to discover available endpoints when you need to explore capabilities
- Use get_function_details to understand endpoint parameters before using run_api_function

When the user asks you to perform WordPress-related tasks like:
- Creating multiple blog posts
- Setting up complex content structures  
- Performing batch operations
- Multi-step workflows
- Any WordPress management tasks requiring multiple actions

You should use the appropriate MCP tools to complete ALL parts of these tasks systematically.

Always explain what you're doing and why, especially when breaking down complex requests into steps.
";
        }
        
        return "You are MagicAssistant, a helpful AI assistant for WordPress websites operating in AGENT MODE. You can help users manage their WordPress site, create content, and perform complex multi-step operations.

{$tools_info}

In Agent Mode, you should:
1. Analyze complex requests and break them into logical steps
2. Execute multiple tools as needed to complete the full request
3. Continue working until the user's complete request is satisfied
4. Provide clear reasoning for each action you take
5. Summarize all actions taken at the end

Be proactive, thorough, and systematic in completing multi-step tasks.";
    }

    private function build_system_message() {
        $tools_info = '';
        
        if ($this->mcp_server && $this->mcp_server->is_enabled()) {
            // Get all registered tools dynamically
            $registered_tools = $this->mcp_server->get_registered_tools();
            $tool_descriptions = [];
            
            foreach ($registered_tools as $name => $tool) {
                $description = $tool['description'] ?? 'No description available';
                
                // Add special notes for certain tools
                $special_note = '';
                if ($name === 'list_api_functions') {
                    $special_note = ' (use filters to avoid overwhelming responses)';
                }
                
                $tool_descriptions[] = "- {$name}: {$description}{$special_note}";
            }
            
            $tools_list = implode("\n", $tool_descriptions);
            
            $tools_info = "
You have access to WordPress MCP tools to help manage this WordPress site:

Available Tools:
{$tools_list}

IMPORTANT: When using list_api_functions, always use filters to limit results:
- Use 'namespace' parameter (e.g. 'wp/v2' for core endpoints)
- Use 'limit' parameter (default 20, max recommended 50)
- Use 'search' parameter to find specific endpoints
Example: list_api_functions with namespace='wp/v2' and limit=10

TOOL SELECTION GUIDANCE:
- For common WordPress tasks, use dedicated tools (wp_get_posts, wp_get_users, wp_create_post, etc.)
- Use run_api_function only when no dedicated tool exists for your specific need
- Use list_api_functions to discover available endpoints when you need to explore capabilities
- Use get_function_details to understand endpoint parameters before using run_api_function

AUTOMATIC DATA FETCHING - IMPORTANT:
- When you see \"🔄 **FETCH_MORE_SUGGESTED**\" or \"🔄 **FETCH_MORE_AVAILABLE**\" in tool results, you SHOULD automatically fetch the additional data if it's relevant to answering the user's question
- When you see \"🤖 **RECOMMENDED_NEXT_ACTION**\" in tool results, you SHOULD follow the recommended action to fetch more data
- Use the suggested parameters (offset, per_page, pagination, filters) to get complete data sets
- If the user asks for listings like \"show me all endpoints\", \"list all posts\", \"get all products\", you MUST automatically fetch all available data using pagination
- Continue fetching until you have all the data the user needs, or until you've provided a comprehensive answer
- Don't just show the fetch-more message - actually USE the tools to fetch the additional data!

When the user asks you to perform WordPress-related tasks like:
- Creating blog posts
- Finding content
- Getting site information
- Listing users, categories, or tags
- Any WordPress management tasks

You should use the appropriate MCP tools to complete these tasks directly.

Always be helpful and explain what you're doing when using these tools.
";
        }
        
        return "You are MagicAssistant, a helpful AI assistant for WordPress websites. You can help users manage their WordPress site, create content, and provide guidance.

{$tools_info}

Be conversational, helpful, and proactive in suggesting how you can help with WordPress tasks.";
    }
    
    private function call_openai($messages, $api_key) {
        $url = 'https://api.openai.com/v1/chat/completions';
        
        $tools = $this->get_mcp_tools_for_openai();
        
        $payload = array(
            'model' => $this->settings['openai_model'] ?? 'gpt-4.1-mini',
            'messages' => $messages,
            'temperature' => 0.7,
            'max_tokens' => 2000
        );
        
        if (!empty($tools)) {
            $payload['tools'] = $tools;
            $payload['tool_choice'] = 'auto';
        }
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json',
            ),
            'body' => json_encode($payload),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('OpenAI API request failed: ' . $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['error'])) {
            throw new Exception('OpenAI API error: ' . $data['error']['message']);
        }
        
        $message = $data['choices'][0]['message'] ?? null;
        $usage = $data['usage'] ?? null;
        
        // Calculate cost for OpenAI models
        $cost = 0;
        if ($usage) {
            $model = $payload['model'];
            $cost = $this->calculate_openai_cost($model, $usage);
        }
        
        // Return message with usage information
        if ($message) {
            $message['usage'] = $usage;
            $message['cost'] = $cost;
        }
        
        return $message;
    }
    
    private function call_anthropic($messages, $api_key) {
        $url = 'https://api.anthropic.com/v1/messages';
        
        // Convert messages format for Anthropic
        $system_message = '';
        $conversation = [];
        
        foreach ($messages as $message) {
            if ($message['role'] === 'system') {
                $system_message = $message['content'];
            } else {
                $conversation[] = $message;
            }
        }
        
        $tools = $this->get_mcp_tools_for_anthropic();
        
        $payload = array(
            'model' => $this->settings['anthropic_model'] ?? 'claude-sonnet-4-20250514',
            'max_tokens' => 2000,
            'messages' => $conversation
        );
        
        if (!empty($system_message)) {
            $payload['system'] = $system_message;
        }
        
        if (!empty($tools)) {
            $payload['tools'] = $tools;
        }
        
        $response = wp_remote_post($url, array(
            'headers' => array(
                'x-api-key' => $api_key,
                'Content-Type' => 'application/json',
                'anthropic-version' => '2023-06-01'
            ),
            'body' => json_encode($payload),
            'timeout' => 30
        ));
        
        if (is_wp_error($response)) {
            throw new Exception('Anthropic API request failed: ' . $response->get_error_message());
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if (isset($data['error'])) {
            throw new Exception('Anthropic API error: ' . $data['error']['message']);
        }
        
        $usage = $data['usage'] ?? null;
        $cost = 0;
        
        // Calculate cost for Anthropic models
        if ($usage) {
            $model = $payload['model'];
            $cost = $this->calculate_anthropic_cost($model, $usage);
        }
        
        return array(
            'content' => $data['content'][0]['text'] ?? '',
            'tool_calls' => $this->extract_anthropic_tool_calls($data),
            'usage' => $usage,
            'cost' => $cost
        );
    }
    
    private function get_mcp_tools_for_openai() {
        if (!$this->mcp_server || !$this->mcp_server->is_enabled()) {
            return [];
        }

        $registered_tools = $this->mcp_server->get_registered_tools();
        $openai_tools     = [];

        foreach ($registered_tools as $name => $tool) {
            $openai_tools[] = array(
                'type'     => 'function',
                'function' => array(
                    'name'        => $name,
                    'description' => $tool['description'] ?? '',
                    'parameters'  => $tool['inputSchema'] ?? array('type' => 'object'),
                ),
            );
        }

        return $openai_tools;
    }
    
    private function get_mcp_tools_for_anthropic() {
        if (!$this->mcp_server || !$this->mcp_server->is_enabled()) {
            return [];
        }

        $registered_tools = $this->mcp_server->get_registered_tools();
        $anthropic_tools  = [];

        foreach ($registered_tools as $name => $tool) {
            $anthropic_tools[] = array(
                'name'         => $name,
                'description'  => $tool['description'] ?? '',
                'input_schema' => $tool['inputSchema'] ?? array('type' => 'object'),
            );
        }

        return $anthropic_tools;
    }
    
    private function process_ai_response($response) {
        // Check if AI wants to use tools
        if (isset($response['tool_calls']) && !empty($response['tool_calls'])) {
            $tool_results = [];
            $has_fetch_more_recommendations = false;
            
            foreach ($response['tool_calls'] as $tool_call) {
                $tool_name = $tool_call['function']['name'] ?? $tool_call['name'] ?? '';
                $tool_args = json_decode($tool_call['function']['arguments'] ?? '{}', true) ?: $tool_call['input'] ?? [];
                
                try {
                    $result = $this->execute_mcp_tool($tool_name, $tool_args);
                    $tool_results[] = array(
                        'tool' => $tool_name,
                        'result' => $result,
                        'success' => true
                    );
                } catch (Exception $e) {
                    $tool_results[] = array(
                        'tool' => $tool_name,
                        'error' => $e->getMessage(),
                        'success' => false
                    );
                }
            }
            
            // Format response with tool results
            $content = $response['content'] ?? '';
            if (!empty($tool_results)) {
                $formatted_results = $this->format_tool_results($tool_results);
                $content .= "\n\n" . $formatted_results;
                
                // Check if any tool results suggest fetching more data
                if (strpos($formatted_results, '🤖 **RECOMMENDED_NEXT_ACTION**') !== false) {
                    $has_fetch_more_recommendations = true;
                    $content .= "\n\n💡 **Note**: I can fetch the remaining data if you'd like to see everything. Just let me know!";
                }
            }
            
            return $content;
        }
        
        return $response['content'] ?? '';
    }
    
    private function execute_mcp_tool($tool_name, $tool_args) {
        if (!$this->mcp_server) {
            throw new Exception('MCP server not available');
        }

        // Leverage the public helper to execute any registered tool.
        return $this->mcp_server->invoke_tool($tool_name, $tool_args);
    }
    
    /**
     * Format a URL as a proper markdown link with sanitization
     */
    private function format_link($url, $text = null) {
        if (empty($url)) {
            return '';
        }
        
        // Sanitize the URL
        $sanitized_url = esc_url_raw($url);
        if (empty($sanitized_url)) {
            return $text ?: $url; // Return text or original URL if sanitization fails
        }
        
        // Use provided text or extract meaningful text from URL
        if (empty($text)) {
            if (strpos($sanitized_url, 'wp-admin') !== false) {
                if (strpos($sanitized_url, 'post.php') !== false) {
                    $text = 'Edit in WordPress Admin';
                } elseif (strpos($sanitized_url, 'user-edit.php') !== false) {
                    $text = 'Edit User';
                } elseif (strpos($sanitized_url, 'term.php') !== false) {
                    $text = 'Edit Term';
                } else {
                    $text = 'WordPress Admin';
                }
            } elseif (strpos($sanitized_url, get_home_url()) === 0) {
                $text = 'View on Site';
            } else {
                $text = 'Visit Link';
            }
        }
        
        // Escape the text for markdown
        $escaped_text = str_replace(['[', ']', '(', ')'], ['\\[', '\\]', '\\(', '\\)'], $text);
        
        // Return as markdown link
        return "[{$escaped_text}]({$sanitized_url})";
    }
    
    /**
     * Convert HTML links to markdown links and strip other HTML tags
     */
    private function html_to_markdown($html) {
        if (empty($html)) {
            return '';
        }
        
        // Convert <a href="url">text</a> to [text](url)
        $html = preg_replace_callback(
            '/<a\s+href=["\']([^"\']*)["\'][^>]*>(.*?)<\/a>/i',
            function($matches) {
                $url = esc_url_raw($matches[1]);
                $text = strip_tags($matches[2]);
                
                if (empty($url)) {
                    return $text; // Return just text if URL is invalid
                }
                
                // Escape markdown special characters in text
                $escaped_text = str_replace(['[', ']', '(', ')'], ['\\[', '\\]', '\\(', '\\)'], $text);
                
                return "[{$escaped_text}]({$url})";
            },
            $html
        );
        
        // Strip any remaining HTML tags
        $html = strip_tags($html);
        
        return $html;
    }
    
    private function format_tool_results($results) {
        $output = "";

        foreach ($results as $result) {
            if (!$result['success']) {
                $output .= "\n❌ Failed to execute {$result['tool']}: {$result['error']}";
                continue;
            }

            $tool = $result['tool'];
            $data = $result['result'];

            switch ($tool) {
                case 'wp_get_posts':
                    $output .= "\n✅ Successfully executed wp_get_posts - Found {$data['total']} posts";
                    if (!empty($data['posts'])) {
                        $max = 12; // Show more posts initially
                        $output .= "\nPosts:";
                        foreach (array_slice($data['posts'], 0, $max) as $post) {
                            $output .= "\n • {$post['title']} (ID: {$post['id']})";
                        }
                        if ($data['total'] > $max) {
                            $remaining = $data['total'] - $max;
                            $output .= "\n …and {$remaining} more posts";
                            
                            // Add auto-fetch suggestions
                            if ($remaining > 0) {
                                $output .= "\n🔄 **FETCH_MORE_AVAILABLE**: To see all posts, use:";
                                $output .= "\n   • wp_get_posts with per_page=50 or per_page=100";
                                $output .= "\n   • wp_get_posts with page=2, page=3, etc. for pagination";
                                $output .= "\n   • wp_posts_search with specific criteria if looking for particular posts";
                                $output .= "\n\n🤖 **RECOMMENDED_NEXT_ACTION**: If user wants to see all posts, automatically call: wp_get_posts with per_page=50 to fetch more posts.";
                            }
                        }
                    }
                    break;
                case 'wp_create_post':
                    $output .= "\n✅ Successfully executed wp_create_post - Created post **{$data['title']}** (ID: {$data['id']})";
                    if (isset($data['edit_link'])) {
                        $output .= "\n📝 " . $this->format_link($data['edit_link'], 'Edit Post');
                    }
                    break;
                case 'wp_get_site_info':
                    $output .= "\n✅ Successfully executed wp_get_site_info";
                    $output .= "\nSite name: {$data['name']}";
                    $output .= "\nURL: {$data['url']}";
                    break;
                case 'wp_update_post':
                    $output .= "\n✅ Successfully executed wp_update_post - Updated post **{$data['title']}** (ID: {$data['id']})";
                    if (isset($data['edit_link'])) {
                        $output .= "\n📝 " . $this->format_link($data['edit_link'], 'Edit Post');
                    }
                    break;
                case 'wp_posts_search':
                    $output .= "\n✅ Successfully executed wp_posts_search - Found {$data['total']} posts";
                    if (!empty($data['posts'])) {
                        $max = 12; // Show more posts initially
                        $output .= "\nSearch results:";
                        foreach (array_slice($data['posts'], 0, $max) as $post) {
                            $output .= "\n • {$post['title']} (ID: {$post['id']})";
                        }
                        if ($data['total'] > $max) {
                            $remaining = $data['total'] - $max;
                            $output .= "\n …and {$remaining} more posts";
                            
                            // Add auto-fetch suggestions
                            if ($remaining > 0) {
                                $output .= "\n🔄 **FETCH_MORE_AVAILABLE**: To see all search results, use:";
                                $output .= "\n   • wp_posts_search with per_page=50 or per_page=100";
                                $output .= "\n   • wp_posts_search with page=2, page=3, etc. for pagination";
                                $output .= "\n   • Refine search terms to narrow results if too many matches";
                            }
                        }
                    }
                    break;
                case 'wp_get_post':
                    $output .= "\n✅ Successfully executed wp_get_post - Retrieved post **{$data['title']}** (ID: {$data['id']})";
                    if (isset($data['permalink'])) {
                        $output .= "\n🔗 " . $this->format_link($data['permalink'], 'View Post');
                    }
                    break;
                case 'wp_add_post':
                    $output .= "\n✅ Successfully executed wp_add_post - Created post **{$data['title']}** (ID: {$data['id']})";
                    if (isset($data['edit_link'])) {
                        $output .= "\n📝 " . $this->format_link($data['edit_link'], 'Edit Post');
                    }
                    break;
                case 'wp_delete_post':
                    $output .= "\n✅ Successfully executed wp_delete_post - Deleted post (ID: {$data['id']})";
                    break;
                case 'wp_list_categories':
                    $output .= "\n✅ Successfully executed wp_list_categories - Found {$data['total']} categories";
                    if (!empty($data['categories'])) {
                        // Show all categories (no limit for categories as they're usually not that many)
                        $output .= "\nCategories:";
                        foreach ($data['categories'] as $category) {
                            $output .= "\n • {$category['name']} (ID: {$category['id']}, Posts: {$category['count']})";
                        }
                    }
                    break;
                case 'wp_add_category':
                    $output .= "\n✅ Successfully executed wp_add_category - Created category **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wp_update_category':
                    $output .= "\n✅ Successfully executed wp_update_category - Updated category **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wp_delete_category':
                    $output .= "\n✅ Successfully executed wp_delete_category - Deleted category (ID: {$data['id']})";
                    break;
                case 'wp_list_tags':
                    $output .= "\n✅ Successfully executed wp_list_tags - Found {$data['total']} tags";
                    if (!empty($data['tags'])) {
                        // Show all tags (no limit for tags as they're usually not that many)
                        $output .= "\nTags:";
                        foreach ($data['tags'] as $tag) {
                            $output .= "\n • {$tag['name']} (ID: {$tag['id']}, Posts: {$tag['count']})";
                        }
                    }
                    break;
                case 'wp_add_tag':
                    $output .= "\n✅ Successfully executed wp_add_tag - Created tag **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wp_update_tag':
                    $output .= "\n✅ Successfully executed wp_update_tag - Updated tag **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wp_delete_tag':
                    $output .= "\n✅ Successfully executed wp_delete_tag - Deleted tag (ID: {$data['id']})";
                    break;
                case 'list_api_functions':
                    $output .= "\n✅ Successfully executed list_api_functions - Found {$data['total']} API endpoints";
                    if (!empty($data['endpoints'])) {
                        // Check if this is a comprehensive list (likely from agent mode fetching all data)
                        $is_comprehensive = count($data['endpoints']) >= $data['total'] * 0.8; // Show all if we have 80%+ of total
                        
                        if ($is_comprehensive || count($data['endpoints']) <= 25) {
                            // Show all endpoints if comprehensive or small list
                            $output .= "\n\n**Complete API Endpoints List:**";
                            foreach ($data['endpoints'] as $endpoint) {
                                $output .= "\n • {$endpoint['method']} {$endpoint['route']}";
                            }
                        } else {
                            // Show limited list with fetch-more options
                            $max = 15;
                            $output .= "\nAPI endpoints:";
                            foreach (array_slice($data['endpoints'], 0, $max) as $endpoint) {
                                $output .= "\n • {$endpoint['method']} {$endpoint['route']}";
                            }
                            if ($data['total'] > $max) {
                                $remaining = $data['total'] - $max;
                                $output .= "\n …and {$remaining} more endpoints";
                                
                                // Add automatic fetch suggestion for AI
                                if ($remaining > 0) {
                                    $output .= "\n🔄 **FETCH_MORE_SUGGESTED**: To see all endpoints, use list_api_functions with pagination or specific filters:";
                                    $output .= "\n   • For next batch: list_api_functions with offset=" . $max;
                                    $output .= "\n   • For specific namespace: list_api_functions with namespace='wp/v2' or namespace='wc/v3'";
                                    $output .= "\n   • For search: list_api_functions with search='posts' or search='products'";
                                    $output .= "\n\n🤖 **RECOMMENDED_NEXT_ACTION**: If user wants to see all endpoints, automatically call: list_api_functions with offset=" . $max . " to fetch the remaining " . $remaining . " endpoints.";
                                }
                            }
                        }
                    }
                    if (isset($data['note'])) {
                        $output .= "\n" . $data['note'];
                    }
                    break;
                case 'get_function_details':
                    $output .= "\n✅ Successfully executed get_function_details for {$data['method']} {$data['route']}";
                    $output .= "\nDescription: {$data['description']}";
                    if (!empty($data['args'])) {
                        $output .= "\nParameters: " . count($data['args']) . " available";
                        $required_args = array_filter($data['args'], function($arg) { return $arg['required']; });
                        if (!empty($required_args)) {
                            $output .= " (" . count($required_args) . " required)";
                        }
                    }
                    break;
                case 'run_api_function':
                    $status_icon = $data['success'] ? '✅' : '❌';
                    $output .= "\n{$status_icon} Successfully executed run_api_function - {$data['method']} {$data['route']}";
                    $output .= "\nStatus: {$data['status']}";
                    if (isset($data['data']) && is_array($data['data'])) {
                        if (isset($data['data']['id'])) {
                            $output .= "\nResult ID: {$data['data']['id']}";
                        }
                        if (isset($data['data']['title'])) {
                            $output .= "\nTitle: {$data['data']['title']}";
                        }
                        if (isset($data['data']['name'])) {
                            $output .= "\nName: {$data['data']['name']}";
                        }
                    }
                    break;
                case 'wp_get_general_settings':
                    $output .= "\n✅ Successfully executed wp_get_general_settings";
                    $output .= "\nSite Title: {$data['title']}";
                    $output .= "\nSite Description: {$data['description']}";
                    $output .= "\nSite URL: {$data['url']}";
                    $output .= "\nWordPress Version: {$data['wordpress_version']}";
                    $output .= "\nTimezone: {$data['timezone_string']}";
                    $output .= "\nPosts per page: {$data['posts_per_page']}";
                    break;
                case 'wp_update_general_settings':
                    $output .= "\n✅ Successfully executed wp_update_general_settings";
                    $output .= "\n{$data['message']} ({$data['count']} settings updated)";
                    if (!empty($data['updated'])) {
                        $output .= "\nUpdated settings:";
                        foreach ($data['updated'] as $key => $value) {
                            $display_value = is_bool($value) ? ($value ? 'true' : 'false') : $value;
                            $output .= "\n • {$key}: {$display_value}";
                        }
                    }
                    break;
                case 'get_site_info':
                    $output .= "\n✅ Successfully executed get_site_info";
                    $output .= "\nSite: {$data['site_name']} - " . $this->format_link($data['site_url'], 'Visit Site');
                    $output .= "\nWordPress: {$data['wordpress_version']} | PHP: {$data['php_version']}";
                    if (isset($data['plugins'])) {
                        $output .= "\nPlugins: {$data['plugins']['active']}/{$data['plugins']['total']} active";
                    }
                    if (isset($data['themes']['active'])) {
                        $output .= "\nActive Theme: {$data['themes']['active']['name']} v{$data['themes']['active']['version']}";
                    }
                    if (isset($data['users'])) {
                        $output .= "\nUsers: {$data['users']['total']} total";
                    }
                    if (isset($data['content_stats'])) {
                        $posts = $data['content_stats']['posts']['total'];
                        $pages = $data['content_stats']['pages']['total'];
                        $comments = $data['content_stats']['comments']['total'];
                        $output .= "\nContent: {$posts} posts, {$pages} pages, {$comments} comments";
                    }
                    break;
                case 'wp_list_plugins':
                    $output .= "\n✅ Successfully executed wp_list_plugins - Found {$data['total_count']} plugins";
                    $output .= "\nTotal: {$data['total_plugins']} | Active: {$data['active_count']} | Inactive: {$data['inactive_count']}";
                    if ($data['updates_available'] > 0) {
                        $output .= " | Updates Available: {$data['updates_available']}";
                    }
                    
                    if (!empty($data['filtered_by']['status']) && $data['filtered_by']['status'] !== 'all') {
                        $output .= "\nFiltered by status: {$data['filtered_by']['status']}";
                    }
                    if (!empty($data['filtered_by']['search'])) {
                        $output .= "\nFiltered by search: {$data['filtered_by']['search']}";
                    }
                    
                    if (!empty($data['plugins'])) {
                        // Show all plugins (no limit as most sites don't have hundreds of plugins)
                        $output .= "\nPlugin List:";
                        foreach ($data['plugins'] as $plugin) {
                            $status_icon = $plugin['status'] === 'active' ? '🟢' : '🔴';
                            $update_icon = $plugin['update_available'] ? ' 🔄' : '';
                            $output .= "\n {$status_icon} **{$plugin['name']}** v{$plugin['version']}{$update_icon}";
                            $output .= "\n   Author: " . $this->html_to_markdown($plugin['author']) . " | Status: {$plugin['status']}";
                            if ($plugin['update_available']) {
                                $output .= "\n   ⚠️ Update available: v{$plugin['latest_version']}";
                            }
                            if (!empty($plugin['requires_php'])) {
                                $output .= " | PHP: {$plugin['requires_php']}+";
                            }
                            if (!empty($plugin['requires_wp'])) {
                                $output .= " | WP: {$plugin['requires_wp']}+";
                            }
                        }
                    }
                    break;
                case 'wp_get_theme_info':
                    $active_theme = $data['active_theme'];
                    $output .= "\n✅ Successfully executed wp_get_theme_info";
                    $output .= "\n🎨 **Active Theme**: {$active_theme['name']} v{$active_theme['version']}";
                    $output .= "\n   Author: " . $this->html_to_markdown($active_theme['author']);
                    if ($active_theme['update_available']) {
                        $output .= "\n   ⚠️ Update available: v{$active_theme['latest_version']}";
                    }
                    if (!empty($active_theme['requires_php'])) {
                        $output .= "\n   PHP Requirement: {$active_theme['requires_php']}+";
                    }
                    if (!empty($active_theme['requires_wp'])) {
                        $output .= "\n   WordPress Requirement: {$active_theme['requires_wp']}+";
                    }
                    
                    // Show parent theme if it's a child theme
                    if (isset($data['parent_theme'])) {
                        $parent_theme = $data['parent_theme'];
                        $output .= "\n👪 **Parent Theme**: {$parent_theme['name']} v{$parent_theme['version']}";
                        $output .= "\n   Author: " . $this->html_to_markdown($parent_theme['author']);
                    }
                    
                    // Show key theme supports
                    if (isset($data['theme_supports'])) {
                        $supports = $data['theme_supports'];
                        $enabled_features = array();
                        foreach ($supports as $feature => $enabled) {
                            if ($enabled) {
                                $enabled_features[] = str_replace('_', ' ', $feature);
                            }
                        }
                        if (!empty($enabled_features)) {
                            // Show more theme features (increased from 8 to 12)
                            $output .= "\n✨ **Theme Features**: " . implode(', ', array_slice($enabled_features, 0, 12));
                            if (count($enabled_features) > 12) {
                                $output .= " (+" . (count($enabled_features) - 12) . " more)";
                            }
                        }
                    }
                    
                    // Show customizer info
                    if (isset($data['customizer'])) {
                        $customizer = $data['customizer'];
                        if ($customizer['has_custom_logo']) {
                            $output .= "\n🖼️ Custom logo is set";
                        }
                    }
                    break;
                case 'wp_list_themes':
                    $output .= "\n✅ Successfully executed wp_list_themes - Found {$data['total_count']} themes";
                    $output .= "\nTotal: {$data['total_themes']} | Active: {$data['active_count']} | Inactive: {$data['inactive_count']}";
                    if ($data['updates_available'] > 0) {
                        $output .= " | Updates Available: {$data['updates_available']}";
                    }
                    
                    if (!empty($data['filtered_by']['search'])) {
                        $output .= "\nFiltered by search: {$data['filtered_by']['search']}";
                    }
                    
                    if (!empty($data['themes'])) {
                        // Show all themes (no limit as most sites don't have many themes)
                        $output .= "\nTheme List:";
                        foreach ($data['themes'] as $theme) {
                            $status_icon = $theme['is_active'] ? '🟢' : '🔴';
                            $update_icon = $theme['update_available'] ? ' 🔄' : '';
                            $output .= "\n {$status_icon} **{$theme['name']}** v{$theme['version']}{$update_icon}";
                            $output .= "\n   Author: " . $this->html_to_markdown($theme['author']) . " | Status: " . ($theme['is_active'] ? 'active' : 'inactive');
                            if ($theme['update_available']) {
                                $output .= "\n   ⚠️ Update available: v{$theme['latest_version']}";
                            }
                            if (!empty($theme['requires_php'])) {
                                $output .= " | PHP: {$theme['requires_php']}+";
                            }
                            if (!empty($theme['requires_wp'])) {
                                $output .= " | WP: {$theme['requires_wp']}+";
                            }
                            if (!empty($theme['tags']) && is_array($theme['tags'])) {
                                $tags = array_slice($theme['tags'], 0, 4); // Slightly increased from 3 to 4
                                $output .= "\n   Tags: " . implode(', ', $tags);
                                if (count($theme['tags']) > 4) {
                                    $output .= " (+" . (count($theme['tags']) - 4) . " more)";
                                }
                            }
                        }
                    }
                    break;
                case 'wp_users_search':
                    $output .= "\n✅ Successfully executed wp_users_search - Found {$data['total']} users";
                    if (!empty($data['users'])) {
                        $max = 10; // Show more users initially
                        $output .= "\nUsers:";
                        foreach (array_slice($data['users'], 0, $max) as $user) {
                            $roles = !empty($user['roles']) ? implode(', ', $user['roles']) : 'No role';
                            $output .= "\n • {$user['display_name']} ({$user['username']}) - {$roles}";
                        }
                        if ($data['total'] > $max) {
                            $remaining = $data['total'] - $max;
                            $output .= "\n …and {$remaining} more users";
                            
                            // Add auto-fetch suggestions
                            if ($remaining > 0) {
                                $output .= "\n🔄 **FETCH_MORE_AVAILABLE**: To see all users, use:";
                                $output .= "\n   • wp_users_search with per_page=50 or per_page=100";
                                $output .= "\n   • wp_users_search with specific role filters";
                                $output .= "\n   • wp_users_search with page=2, page=3, etc. for pagination";
                            }
                        }
                    }
                    break;
                case 'wp_get_user':
                    $roles = !empty($data['roles']) ? implode(', ', $data['roles']) : 'No role';
                    $output .= "\n✅ Successfully executed wp_get_user - Retrieved user **{$data['display_name']}** ({$data['username']})";
                    $output .= "\nEmail: {$data['email']} | Role: {$roles}";
                    $output .= "\nRegistered: {$data['registered']} | Posts: {$data['post_count']}";
                    break;
                case 'wp_add_user':
                    $roles = !empty($data['roles']) ? implode(', ', $data['roles']) : 'No role';
                    $output .= "\n✅ Successfully executed wp_add_user - Created user **{$data['display_name']}** ({$data['username']})";
                    $output .= "\nEmail: {$data['email']} | Role: {$roles}";
                    if (isset($data['edit_link'])) {
                        $output .= "\n👤 " . $this->format_link($data['edit_link'], 'Edit User');
                    }
                    break;
                case 'wp_update_user':
                    $roles = !empty($data['roles']) ? implode(', ', $data['roles']) : 'No role';
                    $output .= "\n✅ Successfully executed wp_update_user - Updated user **{$data['display_name']}** ({$data['username']})";
                    $output .= "\nEmail: {$data['email']} | Role: {$roles}";
                    if (isset($data['edit_link'])) {
                        $output .= "\n👤 " . $this->format_link($data['edit_link'], 'Edit User');
                    }
                    break;
                case 'wp_delete_user':
                    $output .= "\n✅ Successfully executed wp_delete_user - Deleted user (ID: {$data['id']})";
                    if (isset($data['posts_reassigned']) && $data['posts_reassigned'] > 0) {
                        $output .= "\nReassigned {$data['posts_reassigned']} posts to user ID: {$data['reassigned_to']}";
                    }
                    break;
                case 'wp_get_current_user':
                    $roles = !empty($data['roles']) ? implode(', ', $data['roles']) : 'No role';
                    $output .= "\n✅ Successfully executed wp_get_current_user - Current user: **{$data['display_name']}** ({$data['username']})";
                    $output .= "\nEmail: {$data['email']} | Role: {$roles}";
                    $output .= "\nRegistered: {$data['registered']} | Posts: {$data['post_count']}";
                    break;
                case 'wp_update_current_user':
                    $roles = !empty($data['roles']) ? implode(', ', $data['roles']) : 'No role';
                    $output .= "\n✅ Successfully executed wp_update_current_user - Updated current user: **{$data['display_name']}** ({$data['username']})";
                    $output .= "\nEmail: {$data['email']} | Role: {$roles}";
                    break;
                case 'wp_get_site_settings':
                    $output .= "\n✅ Successfully executed wp_get_site_settings";
                    
                    if (isset($data['category']) && $data['category'] !== 'all') {
                        $output .= " - Retrieved **{$data['category']}** settings";
                        $settings = $data['settings'];
                        
                        // Format specific category settings
                        switch ($data['category']) {
                            case 'general':
                                $output .= "\n⚙️ **General Settings**:";
                                $output .= "\n   Site Title: {$settings['site_title']}";
                                $output .= "\n   Site Tagline: {$settings['site_tagline']}";
                                $output .= "\n   Site URL: " . $this->format_link($settings['site_url'], 'Visit Site');
                                $output .= "\n   Admin Email: {$settings['admin_email']}";
                                $output .= "\n   Timezone: {$settings['timezone']}";
                                $output .= "\n   Language: {$settings['site_language']}";
                                break;
                            case 'reading':
                                $output .= "\n📖 **Reading Settings**:";
                                $output .= "\n   Front Page: " . ($settings['front_page_displays'] === 'posts' ? 'Latest posts' : 'Static page');
                                if ($settings['front_page_displays'] === 'page' && $settings['front_page_id']) {
                                    $output .= " (ID: {$settings['front_page_id']})";
                                }
                                $output .= "\n   Posts per page: {$settings['posts_per_page']}";
                                $output .= "\n   RSS posts: {$settings['posts_per_rss']}";
                                $output .= "\n   Search engines: " . ($settings['blog_public'] ? 'Allowed' : 'Discouraged');
                                break;
                            case 'discussion':
                                $output .= "\n💬 **Discussion Settings**:";
                                $output .= "\n   Default comment status: {$settings['default_comment_status']}";
                                $output .= "\n   Comment moderation: " . ($settings['comment_moderation'] ? 'Enabled' : 'Disabled');
                                $output .= "\n   Comment registration required: " . ($settings['comment_registration'] ? 'Yes' : 'No');
                                $output .= "\n   Comments per page: {$settings['comments_per_page']}";
                                break;
                            case 'media':
                                $output .= "\n🖼️ **Media Settings**:";
                                $output .= "\n   Thumbnail size: {$settings['thumbnail_size_w']} × {$settings['thumbnail_size_h']}";
                                $output .= "\n   Medium size: {$settings['medium_size_w']} × {$settings['medium_size_h']}";
                                $output .= "\n   Large size: {$settings['large_size_w']} × {$settings['large_size_h']}";
                                $output .= "\n   Organize uploads by date: " . ($settings['uploads_use_yearmonth_folders'] ? 'Yes' : 'No');
                                break;
                            case 'permalink':
                                $output .= "\n🔗 **Permalink Settings**:";
                                $output .= "\n   Structure: {$settings['permalink_structure_name']}";
                                if (!empty($settings['permalink_structure'])) {
                                    $output .= " ({$settings['permalink_structure']})";
                                }
                                if ($settings['category_base']) {
                                    $output .= "\n   Category base: {$settings['category_base']}";
                                }
                                if ($settings['tag_base']) {
                                    $output .= "\n   Tag base: {$settings['tag_base']}";
                                }
                                break;
                            case 'privacy':
                                $output .= "\n🔒 **Privacy Settings**:";
                                if ($settings['privacy_policy_page_title']) {
                                    $output .= "\n   Privacy Policy Page: {$settings['privacy_policy_page_title']}";
                                } else {
                                    $output .= "\n   Privacy Policy Page: Not set";
                                }
                                $output .= "\n   Search engines: " . ($settings['blog_public'] ? 'Allowed' : 'Discouraged');
                                break;
                            default:
                                $output .= "\n📋 **Settings**: " . count($settings) . " items configured";
                                break;
                        }
                    } else {
                        // All settings
                        $settings = $data['settings'];
                        $categories = $data['categories'];
                        $output .= " - Retrieved **all** site settings";
                        $output .= "\n📊 **Settings Overview**:";
                        $output .= "\n   Categories: " . implode(', ', $categories);
                        
                        // Show key general settings
                        if (isset($settings['general'])) {
                            $general = $settings['general'];
                            $output .= "\n⚙️ **Site Info**: {$general['site_title']} - " . $this->format_link($general['site_url'], 'Visit Site');
                            $output .= "\n   Admin: {$general['admin_email']} | Language: {$general['site_language']} | Timezone: {$general['timezone']}";
                        }
                        
                        // Show reading settings summary
                        if (isset($settings['reading'])) {
                            $reading = $settings['reading'];
                            $output .= "\n📖 **Reading**: " . ($reading['front_page_displays'] === 'posts' ? 'Latest posts homepage' : 'Static homepage');
                            $output .= " | {$reading['posts_per_page']} posts per page";
                        }
                        
                        // Show permalink structure
                        if (isset($settings['permalink'])) {
                            $permalink = $settings['permalink'];
                            $output .= "\n🔗 **Permalinks**: {$permalink['permalink_structure_name']}";
                        }
                    }
                    break;
                case 'wp_get_general_site_info':
                    $output .= "\n✅ Successfully executed wp_get_general_site_info";
                    
                    if (isset($data['site_name'])) {
                        // Full site info view
                        $output .= " - Retrieved **full** site information";
                        $output .= "\n🌐 **Site Overview**:";
                        $output .= "\n   Name: {$data['site_name']}";
                        $output .= "\n   URL: " . $this->format_link($data['site_url'], 'Visit Site');
                        if (!empty($data['site_description'])) {
                            $output .= "\n   Description: {$data['site_description']}";
                        }
                        $output .= "\n   Admin Email: {$data['site_admin_email']}";
                        $output .= "\n   Language: {$data['language']} | Timezone: {$data['timezone']}";
                        
                        $output .= "\n💻 **System Info**:";
                        $output .= "\n   WordPress: {$data['wordpress_version']} | PHP: {$data['php_version']} | MySQL: {$data['mysql_version']}";
                        if (isset($data['server_info'])) {
                            $server = $data['server_info'];
                            $output .= "\n   Server: {$server['software']} | OS: {$server['os']} ({$server['architecture']})";
                        }
                        $output .= "\n   Memory Limit: {$data['memory_limit']} | Max Execution: {$data['max_execution_time']}s";
                        $output .= "\n   Upload Max: {$data['upload_max_filesize']} | Post Max: {$data['post_max_size']}";
                        if ($data['multisite']) {
                            $output .= "\n   🔗 Multisite: Enabled";
                        }
                        if ($data['debug_mode']) {
                            $output .= "\n   🐛 Debug Mode: Enabled";
                        }
                        
                        if (isset($data['active_theme'])) {
                            $theme = $data['active_theme'];
                            $output .= "\n🎨 **Active Theme**: {$theme->get('Name')} v{$theme->get('Version')}";
                            $output .= "\n   Author: " . $this->html_to_markdown($theme->get('Author'));
                        }
                        
                        if (isset($data['all_plugins']) && isset($data['active_plugins'])) {
                            $total_plugins = count($data['all_plugins']);
                            $active_plugins = count($data['active_plugins']);
                            $output .= "\n🔌 **Plugins**: {$active_plugins}/{$total_plugins} active";
                        }
                        
                        if (isset($data['users_count'])) {
                            $users = $data['users_count'];
                            $output .= "\n👥 **Users**: {$users['total']} total";
                            if (!empty($users['roles'])) {
                                $role_summary = array();
                                foreach ($users['roles'] as $role => $count) {
                                    $role_summary[] = "{$role}: {$count}";
                                }
                                $output .= " (" . implode(', ', array_slice($role_summary, 0, 3)) . ")";
                            }
                        }
                        
                        if (isset($data['content_stats'])) {
                            $content = $data['content_stats'];
                            $output .= "\n📝 **Content**: {$content['posts']['total']} posts, {$content['pages']['total']} pages, {$content['comments']['total']} comments, {$content['media']['total']} media";
                        }
                        
                    } elseif (isset($data['php'])) {
                        // System requirements view
                        $output .= " - Retrieved **system requirements** check";
                        $output .= "\n🔍 **System Requirements Check**:";
                        
                        $php = $data['php'];
                        $php_status = $php['meets_req'] ? '✅' : '❌';
                        $output .= "\n   {$php_status} PHP: {$php['current']} (recommended: {$php['recommended']})";
                        
                        if (isset($data['wordpress'])) {
                            $wp = $data['wordpress'];
                            $wp_status = version_compare($wp['current'], $wp['latest'], '>=') ? '✅' : '⚠️';
                            $output .= "\n   {$wp_status} WordPress: {$wp['current']} (latest: {$wp['latest']})";
                        }
                        
                        $memory = $data['memory'];
                        $memory_status = $memory['meets_req'] ? '✅' : '❌';
                        $output .= "\n   {$memory_status} Memory: {$memory['current']} (recommended: {$memory['recommended']})";
                        
                        $exec_time = $data['execution_time'];
                        $exec_status = $exec_time['meets_req'] ? '✅' : '❌';
                        $output .= "\n   {$exec_status} Max Execution Time: {$exec_time['current']}s (recommended: {$exec_time['recommended']}s)";
                        
                        $upload = $data['upload_size'];
                        $upload_status = $upload['meets_req'] ? '✅' : '❌';
                        $output .= "\n   {$upload_status} Upload Size: {$upload['current']} (recommended: {$upload['recommended']})";
                        
                    } else {
                        // Overview view
                        $output .= " - Retrieved **site overview**";
                        $output .= "\n📊 **Site Overview**:";
                        $output .= "\n   Site: {$data['site_name']} - " . $this->format_link($data['site_url'], 'Visit Site');
                        $output .= "\n   WordPress: {$data['wordpress_version']} | PHP: {$data['php_version']}";
                        
                        if (isset($data['active_theme'])) {
                            $theme = $data['active_theme'];
                            $output .= "\n   Theme: {$theme['name']} v{$theme['version']}";
                        }
                        
                        if (isset($data['plugins_count'])) {
                            $plugins = $data['plugins_count'];
                            $output .= "\n   Plugins: {$plugins['active']}/{$plugins['total']} active";
                        }
                        
                        $output .= "\n   Users: {$data['users_count']}";
                        
                        if (isset($data['content_summary'])) {
                            $content = $data['content_summary'];
                            $output .= "\n   Content: {$content['posts']} posts, {$content['pages']} pages, {$content['comments']} comments";
                        }
                    }
                    break;
                case 'wp_get_detailed_theme_info':
                    $output .= "\n✅ Successfully executed wp_get_detailed_theme_info";
                    
                    if (isset($data['active_theme'])) {
                        $active_theme = $data['active_theme'];
                        $output .= "\n🎨 **Active Theme Details**:";
                        $output .= "\n   Name: **{$active_theme['name']}** v{$active_theme['version']}";
                        $output .= "\n   Author: " . $this->html_to_markdown($active_theme['author']);
                        if (!empty($active_theme['description'])) {
                            $description = strlen($active_theme['description']) > 100 ? 
                                substr($active_theme['description'], 0, 100) . '...' : 
                                $active_theme['description'];
                            $output .= "\n   Description: {$description}";
                        }
                        if ($active_theme['theme_uri']) {
                            $output .= "\n   🎨 " . $this->format_link($active_theme['theme_uri'], 'Theme Homepage');
                        }
                        if ($active_theme['requires_php']) {
                            $output .= "\n   Requires PHP: {$active_theme['requires_php']}+";
                        }
                        if ($active_theme['requires_wp']) {
                            $output .= "\n   Requires WordPress: {$active_theme['requires_wp']}+";
                        }
                        if ($active_theme['update_available']) {
                            $output .= "\n   ⚠️ Update available: v{$active_theme['latest_version']}";
                        }
                        if (!empty($active_theme['tags']) && is_array($active_theme['tags'])) {
                            $tags = array_slice($active_theme['tags'], 0, 6); // Show more tags
                            $output .= "\n   Tags: " . implode(', ', $tags);
                            if (count($active_theme['tags']) > 6) {
                                $output .= " (+" . (count($active_theme['tags']) - 6) . " more)";
                            }
                        }
                    }
                    
                    // Show parent theme if exists
                    if (isset($data['parent_theme'])) {
                        $parent_theme = $data['parent_theme'];
                        $output .= "\n👪 **Parent Theme**: {$parent_theme['name']} v{$parent_theme['version']}";
                        $output .= "\n   Author: " . $this->html_to_markdown($parent_theme['author']);
                    }
                    
                    // Show theme supports
                    if (isset($data['theme_supports'])) {
                        $supports = $data['theme_supports'];
                        $enabled_features = array();
                        foreach ($supports as $feature => $enabled) {
                            if ($enabled) {
                                $enabled_features[] = str_replace('_', ' ', $feature);
                            }
                        }
                        if (!empty($enabled_features)) {
                            // Show all theme features (no limit for theme supports)
                            $output .= "\n✨ **Theme Features**: " . implode(', ', $enabled_features);
                        }
                    }
                    
                    // Show customizer info
                    if (isset($data['customizer'])) {
                        $customizer = $data['customizer'];
                        $customizer_info = array();
                        if ($customizer['has_custom_logo']) {
                            $customizer_info[] = 'Custom logo set';
                        }
                        if ($customizer['site_icon_id']) {
                            $customizer_info[] = 'Site icon set';
                        }
                        if (!empty($customizer_info)) {
                            $output .= "\n🖼️ **Customizer**: " . implode(', ', $customizer_info);
                        }
                    }
                    break;
                case 'wp_get_detailed_user_info':
                    $output .= "\n✅ Successfully executed wp_get_detailed_user_info";
                    
                    if (isset($data['total_users'])) {
                        // Full user info or statistics view
                        if (isset($data['users'])) {
                            // Full view
                            $output .= " - Retrieved **full** user information";
                            $output .= "\n👥 **User Overview**: {$data['total_users']} total users";
                            
                            if (!empty($data['role_counts'])) {
                                $role_summary = array();
                                foreach ($data['role_counts'] as $role => $count) {
                                    $role_summary[] = "{$role}: {$count}";
                                }
                                // Show all roles (no limit for role distribution)
                                $output .= "\n   Role Distribution: " . implode(', ', $role_summary);
                            }
                            
                            if (isset($data['current_user_id'])) {
                                $output .= "\n   Current User ID: {$data['current_user_id']}";
                            }
                            
                            // Show sample users
                            if (!empty($data['users'])) {
                                $sample_users = array_slice($data['users'], 0, 5); // Increased from 3 to 5
                                $output .= "\n📋 **Sample Users**:";
                                foreach ($sample_users as $user) {
                                    $output .= "\n   • {$user['display_name']} ({$user['username']}) - {$user['primary_role']} | Posts: {$user['post_count']}";
                                }
                                if (count($data['users']) > 5) {
                                    $remaining = count($data['users']) - 5;
                                    $output .= "\n   ...and {$remaining} more users";
                                }
                            }
                            
                        } else {
                            // Statistics view
                            $output .= " - Retrieved **user statistics**";
                            $output .= "\n📊 **User Statistics**:";
                            $output .= "\n   Total Users: {$data['total_users']}";
                            $output .= "\n   Active Users: {$data['active_users']}";
                            $output .= "\n   Inactive Users: {$data['inactive_users']}";
                            $output .= "\n   Recent Registrations (30 days): {$data['recent_registrations']}";
                            
                            if (!empty($data['role_distribution'])) {
                                $output .= "\n📋 **Role Distribution**:";
                                foreach ($data['role_distribution'] as $role => $count) {
                                    $output .= "\n   • {$role}: {$count}";
                                }
                            }
                        }
                        
                    } elseif (isset($data['role_stats'])) {
                        // Role statistics view (efficient version)
                        $output .= " - Retrieved **role statistics**";
                        $output .= "\n📊 **Role Statistics**:";
                        
                        $role_stats = $data['role_stats'];
                        $total_users = 0;
                        foreach ($role_stats as $role_slug => $role_info) {
                            $total_users += $role_info['count'];
                            $output .= "\n   **{$role_info['name']}**: {$role_info['count']} users";
                        }
                        $output .= "\n   **Total Users**: {$total_users}";
                        
                    } elseif (isset($data['administrator'])) {
                        // Role capabilities view
                        $output .= " - Retrieved **role capabilities**";
                        $output .= "\n🔐 **Role Capabilities**:";
                        
                        foreach ($data as $role_key => $role_info) {
                            $output .= "\n   **{$role_info['name']}**: {$role_info['capability_count']} capabilities";
                            $permissions = array();
                            if ($role_info['can_manage_options']) $permissions[] = 'manage options';
                            if ($role_info['can_edit_users']) $permissions[] = 'edit users';
                            if ($role_info['can_publish_posts']) $permissions[] = 'publish posts';
                            if ($role_info['can_edit_posts']) $permissions[] = 'edit posts';
                            
                            if (!empty($permissions)) {
                                $output .= " (" . implode(', ', $permissions) . ")";
                            }
                        }
                        
                    } else {
                        // Single user view
                        $output .= " - Retrieved **single user** information";
                        $output .= "\n👤 **User Details**:";
                        $output .= "\n   Name: **{$data['display_name']}** ({$data['username']})";
                        $output .= "\n   Email: {$data['email']}";
                        $output .= "\n   Role: {$data['primary_role']}";
                        $output .= "\n   Registered: {$data['registered']}";
                        $output .= "\n   Total Posts: {$data['total_posts']}";
                        
                        if (!empty($data['post_counts'])) {
                            $post_types = array();
                            foreach ($data['post_counts'] as $type => $count) {
                                if ($count > 0) {
                                    $post_types[] = "{$type}: {$count}";
                                }
                            }
                            if (!empty($post_types)) {
                                $output .= "\n   Post Breakdown: " . implode(', ', $post_types);
                            }
                        }
                        
                        if ($data['user_url']) {
                            $output .= "\n   🌐 " . $this->format_link($data['user_url'], 'Website');
                        }
                        if ($data['description']) {
                            $description = strlen($data['description']) > 100 ? 
                                substr($data['description'], 0, 100) . '...' : 
                                $data['description'];
                            $output .= "\n   Bio: {$description}";
                        }
                    }
                    break;
                case 'wc_orders_search':
                    $output .= "\n✅ Successfully executed wc_orders_search - Found {$data['total']} orders";
                    if (!empty($data['orders'])) {
                        $max = 15; // Show more orders initially
                        $output .= "\nOrders:";
                        foreach (array_slice($data['orders'], 0, $max) as $order) {
                            $output .= "\n • Order #{$order['number']} - {$order['status']} - {$order['currency']}{$order['total']} ({$order['customer_name']})";
                        }
                        if ($data['total'] > $max) {
                            $remaining = $data['total'] - $max;
                            $output .= "\n …and {$remaining} more orders";
                            
                            // Add auto-fetch suggestions
                            if ($remaining > 0) {
                                $output .= "\n🔄 **FETCH_MORE_AVAILABLE**: To see all orders, use:";
                                $output .= "\n   • wc_orders_search with per_page=50 or per_page=100";
                                $output .= "\n   • wc_orders_search with status filters (completed, processing, etc.)";
                                $output .= "\n   • wc_orders_search with date range filters for specific periods";
                                $output .= "\n   • wc_orders_search with page=2, page=3, etc. for pagination";
                            }
                        }
                    }
                    break;
                case 'wc_reports_sales':
                    $output .= "\n✅ Successfully executed wc_reports_sales - Sales report for {$data['period']}";
                    $output .= "\nTotal Sales: {$data['total_sales']} | Net Sales: {$data['net_sales']}";
                    $output .= "\nOrders: {$data['total_orders']} | Items: {$data['total_items']}";
                    $output .= "\nAverage Order: {$data['average_sales']}";
                    $output .= "\nPeriod: {$data['date_min']} to {$data['date_max']}";
                    break;
                case 'wc_reports_orders_totals':
                    $output .= "\n✅ Successfully executed wc_reports_orders_totals";
                    if (is_array($data)) {
                        $output .= "\nOrder status breakdown:";
                        foreach ($data as $status) {
                            $output .= "\n • {$status['name']}: {$status['total']}";
                        }
                    }
                    break;
                case 'wc_reports_customers_totals':
                    $output .= "\n✅ Successfully executed wc_reports_customers_totals";
                    $output .= "\nTotal Customers: {$data['total']} | Paying Customers: {$data['paying_customers']}";
                    break;
                case 'wc_reports_products_totals':
                    $output .= "\n✅ Successfully executed wc_reports_products_totals";
                    if (is_array($data)) {
                        foreach ($data as $product_type) {
                            $output .= "\n{$product_type['name']}: {$product_type['total']}";
                        }
                    }
                    break;
                case 'wc_reports_coupons_totals':
                    $output .= "\n✅ Successfully executed wc_reports_coupons_totals";
                    $output .= "\nTotal Coupons: {$data['total']}";
                    if (isset($data['totals'])) {
                        $output .= " (Published: {$data['totals']['publish']}, Draft: {$data['totals']['draft']})";
                    }
                    break;
                case 'wc_reports_reviews_totals':
                    $output .= "\n✅ Successfully executed wc_reports_reviews_totals";
                    $output .= "\nTotal Reviews: {$data['total']}";
                    if (isset($data['totals'])) {
                        $output .= " (Approved: {$data['totals']['approved']}, Pending: {$data['totals']['moderated']})";
                    }
                    break;
                case 'wc_products_search':
                    $output .= "\n✅ Successfully executed wc_products_search - Found {$data['total']} products";
                    if (!empty($data['products'])) {
                        $max = 15; // Show more products initially
                        $output .= "\nProducts:";
                        foreach (array_slice($data['products'], 0, $max) as $product) {
                            $price = !empty($product['price']) ? '$' . $product['price'] : 'No price';
                            $stock = $product['stock_status'] ?? 'Unknown';
                            $output .= "\n • {$product['name']} (ID: {$product['id']}) - {$price} - {$stock}";
                        }
                        if ($data['total'] > $max) {
                            $remaining = $data['total'] - $max;
                            $output .= "\n …and {$remaining} more products";
                            
                            // Add auto-fetch suggestions
                            if ($remaining > 0) {
                                $output .= "\n🔄 **FETCH_MORE_AVAILABLE**: To see all products, use:";
                                $output .= "\n   • wc_products_search with per_page=50 or per_page=100";
                                $output .= "\n   • wc_products_search with category filters to narrow results";
                                $output .= "\n   • wc_products_search with stock_status or price filters";
                                $output .= "\n   • wc_products_search with page=2, page=3, etc. for pagination";
                            }
                        }
                    }
                    break;
                case 'wc_get_product':
                    $price = !empty($data['price']) ? '$' . $data['price'] : 'No price';
                    $output .= "\n✅ Successfully executed wc_get_product - Retrieved product **{$data['name']}** (ID: {$data['id']})";
                    $output .= "\nPrice: {$price} | Stock: {$data['stock_status']} | Type: {$data['type']}";
                    if (isset($data['permalink'])) {
                        $output .= "\n🛍️ " . $this->format_link($data['permalink'], 'View Product');
                    }
                    break;
                case 'wc_add_product':
                    $price = !empty($data['price']) ? '$' . $data['price'] : 'No price';
                    $output .= "\n✅ Successfully executed wc_add_product - Created product **{$data['name']}** (ID: {$data['id']})";
                    $output .= "\nPrice: {$price} | Stock: {$data['stock_status']} | Type: {$data['type']}";
                    if (isset($data['edit_link'])) {
                        $output .= "\n🛍️ " . $this->format_link($data['edit_link'], 'Edit Product');
                    }
                    break;
                case 'wc_update_product':
                    $price = !empty($data['price']) ? '$' . $data['price'] : 'No price';
                    $output .= "\n✅ Successfully executed wc_update_product - Updated product **{$data['name']}** (ID: {$data['id']})";
                    $output .= "\nPrice: {$price} | Stock: {$data['stock_status']} | Type: {$data['type']}";
                    if (isset($data['edit_link'])) {
                        $output .= "\n🛍️ " . $this->format_link($data['edit_link'], 'Edit Product');
                    }
                    break;
                case 'wc_delete_product':
                    $output .= "\n✅ Successfully executed wc_delete_product - Deleted product (ID: {$data['id']})";
                    if (isset($data['force']) && $data['force']) {
                        $output .= " (permanently deleted)";
                    }
                    break;
                case 'wc_list_product_categories':
                    $output .= "\n✅ Successfully executed wc_list_product_categories - Found {$data['total']} categories";
                    if (!empty($data['categories'])) {
                        // Show all product categories (no limit as most stores don't have many categories)
                        $output .= "\nCategories:";
                        foreach ($data['categories'] as $category) {
                            $output .= "\n • {$category['name']} (ID: {$category['id']}, Products: {$category['count']})";
                        }
                    }
                    break;
                case 'wc_add_product_category':
                    $output .= "\n✅ Successfully executed wc_add_product_category - Created category **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wc_update_product_category':
                    $output .= "\n✅ Successfully executed wc_update_product_category - Updated category **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wc_delete_product_category':
                    $output .= "\n✅ Successfully executed wc_delete_product_category - Deleted category (ID: {$data['id']})";
                    break;
                case 'wc_list_product_tags':
                    $output .= "\n✅ Successfully executed wc_list_product_tags - Found {$data['total']} tags";
                    if (!empty($data['tags'])) {
                        // Show all product tags (no limit as most stores don't have many tags)
                        $output .= "\nTags:";
                        foreach ($data['tags'] as $tag) {
                            $output .= "\n • {$tag['name']} (ID: {$tag['id']}, Products: {$tag['count']})";
                        }
                    }
                    break;
                case 'wc_add_product_tag':
                    $output .= "\n✅ Successfully executed wc_add_product_tag - Created tag **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wc_update_product_tag':
                    $output .= "\n✅ Successfully executed wc_update_product_tag - Updated tag **{$data['name']}** (ID: {$data['id']})";
                    break;
                case 'wc_delete_product_tag':
                    $output .= "\n✅ Successfully executed wc_delete_product_tag - Deleted tag (ID: {$data['id']})";
                    break;
                default:
                    $output .= "\n✅ Successfully executed {$tool}";
                    $output .= "\n" . json_encode($data, JSON_PRETTY_PRINT);
                    break;
            }
        }

        return $output;
    }
    
    private function extract_anthropic_tool_calls($data) {
        $tool_calls = [];
        
        if (isset($data['content'])) {
            foreach ($data['content'] as $content_block) {
                if ($content_block['type'] === 'tool_use') {
                    $tool_calls[] = array(
                        'name' => $content_block['name'],
                        'input' => $content_block['input']
                    );
                }
            }
        }
        
        return $tool_calls;
    }
    
    public function get_settings($request) {
        // Refresh settings from database
        if ($this->db) {
            $this->settings = $this->db->get_all_settings();
        }
        
        return array(
            'ai_provider' => $this->settings['ai_provider'] ?? 'openai',
            'mcp_enabled' => $this->settings['mcp_enabled'] ?? false,
            'openai_model' => $this->settings['openai_model'] ?? 'gpt-4.1-mini',
            'anthropic_model' => $this->settings['anthropic_model'] ?? 'claude-sonnet-4-20250514',
            'has_api_key' => $this->db ? ($this->db->has_api_key('openai_api_key') || $this->db->has_api_key('anthropic_api_key')) : false,
            'openai_api_key' => $this->db ? $this->db->has_api_key('openai_api_key') : false,
            'anthropic_api_key' => $this->db ? $this->db->has_api_key('anthropic_api_key') : false,
            'enable_create_tools' => $this->settings['enable_create_tools'] ?? true,
            'enable_update_tools' => $this->settings['enable_update_tools'] ?? true,
            'enable_delete_tools' => $this->settings['enable_delete_tools'] ?? false,
            'agent_mode' => $this->settings['agent_mode'] ?? 'auto',
            'max_agent_iterations' => $this->settings['max_agent_iterations'] ?? 5
        );
    }
    
    public function save_settings($request) {
        $data = $request->get_json_params();
        
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        // Save individual settings to database
        if (isset($data['ai_provider'])) {
            $this->db->save_setting('ai_provider', sanitize_text_field($data['ai_provider']));
        }
        
        if (isset($data['openai_api_key']) && !empty($data['openai_api_key'])) {
            $api_key = sanitize_text_field($data['openai_api_key']);
            $this->db->save_setting('openai_api_key', $api_key);
        }
        
        if (isset($data['anthropic_api_key']) && !empty($data['anthropic_api_key'])) {
            $api_key = sanitize_text_field($data['anthropic_api_key']);
            $this->db->save_setting('anthropic_api_key', $api_key);
        }
        
        if (isset($data['mcp_enabled'])) {
            $this->db->save_setting('mcp_enabled', (bool) $data['mcp_enabled']);
        }
        
        if (isset($data['openai_model'])) {
            $this->db->save_setting('openai_model', sanitize_text_field($data['openai_model']));
        }
        
        if (isset($data['anthropic_model'])) {
            $this->db->save_setting('anthropic_model', sanitize_text_field($data['anthropic_model']));
        }
        
        if (isset($data['enable_create_tools'])) {
            $this->db->save_setting('enable_create_tools', (bool) $data['enable_create_tools']);
        }
        
        if (isset($data['enable_update_tools'])) {
            $this->db->save_setting('enable_update_tools', (bool) $data['enable_update_tools']);
        }
        
        if (isset($data['enable_delete_tools'])) {
            $this->db->save_setting('enable_delete_tools', (bool) $data['enable_delete_tools']);
        }
        
        if (isset($data['agent_mode'])) {
            $valid_modes = ['auto', 'always', 'never'];
            $mode = sanitize_text_field($data['agent_mode']);
            if (in_array($mode, $valid_modes)) {
                $this->db->save_setting('agent_mode', $mode);
            }
        }
        
        if (isset($data['max_agent_iterations'])) {
            $iterations = intval($data['max_agent_iterations']);
            if ($iterations >= 1 && $iterations <= 10) {
                $this->db->save_setting('max_agent_iterations', $iterations);
            }
        }
        
        // Refresh settings from database
        $this->settings = $this->db->get_all_settings();
        
        return array('success' => true);
    }
    
    public function check_permissions() {
        return current_user_can('manage_options');
    }
    
    /**
     * Delete API key endpoint
     */
    public function delete_api_key($request) {
        $data = $request->get_json_params();
        $provider = $data['provider'] ?? '';
        
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        if (empty($provider)) {
            return new WP_Error('invalid_provider', 'Provider is required', array('status' => 400));
        }
        
        $key_name = $provider . '_api_key';
        
        if (!in_array($key_name, ['openai_api_key', 'anthropic_api_key'])) {
            return new WP_Error('invalid_provider', 'Invalid provider', array('status' => 400));
        }
        
        // Delete the API key from database
        $this->db->delete_api_key($key_name);
        
        // Refresh settings from database
        $this->settings = $this->db->get_all_settings();
        
        return array(
            'success' => true,
            'message' => ucfirst($provider) . ' API key deleted successfully'
        );
    }
    
    /**
     * Get chat history for current user
     */
    public function get_chat_history($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $user_id = get_current_user_id();
        $session_id = $request->get_param('session_id');
        $limit = intval($request->get_param('limit')) ?: 50;
        
        $history = $this->db->get_chat_history($user_id, $session_id, $limit);
        
        return array(
            'success' => true,
            'history' => $history
        );
    }
    
    /**
     * Get chat sessions (unique session IDs with metadata)
     */
    public function get_chat_sessions($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $user_id = get_current_user_id();
        $limit = intval($request->get_param('limit')) ?: 20;
        
        // Get sessions using the optimized method
        $sessions = $this->db->get_chat_history($user_id, null, $limit);
        
        // Format sessions for frontend
        $formatted_sessions = array();
        foreach ($sessions as $session) {
            $formatted_sessions[] = array(
                'id' => $session['session_id'],
                'title' => $session['title'] ?: 'Chat Session',
                'message_count' => intval($session['message_count']),
                'total_tokens' => intval($session['total_tokens']),
                'providers_used' => $session['providers_used'],
                'models_used' => $session['models_used'],
                'first_message_time' => $session['created_at'],
                'last_message_time' => $session['updated_at']
            );
        }
        
        return array(
            'success' => true,
            'sessions' => $formatted_sessions
        );
    }
    
    /**
     * Delete a chat session and all its messages
     */
    public function delete_chat_session($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $session_id = $request->get_param('session_id');
        $user_id = get_current_user_id();
        
        if (empty($session_id)) {
            return new WP_Error('missing_session', 'Session ID is required', array('status' => 400));
        }
        
        // Delete the session using the optimized method
        $deleted = $this->db->delete_chat_session($user_id, $session_id);
        
        if ($deleted === false) {
            return new WP_Error('delete_failed', 'Failed to delete chat session', array('status' => 500));
        }
        
        return array(
            'success' => true,
            'message' => 'Chat session deleted successfully'
        );
    }
    
    /**
     * Update chat session title
     */
    public function update_chat_title($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $session_id = $request->get_param('session_id');
        $data = $request->get_json_params();
        $title = $data['title'] ?? '';
        $user_id = get_current_user_id();
        
        if (empty($session_id)) {
            return new WP_Error('missing_session', 'Session ID is required', array('status' => 400));
        }
        
        if (empty($title)) {
            return new WP_Error('missing_title', 'Title is required', array('status' => 400));
        }
        
        $title = sanitize_text_field($title);
        
        // Update the session title in the database
        global $wpdb;
        $updated = $wpdb->update(
            $wpdb->prefix . 'mat_chat_history',
            array('title' => $title),
            array(
                'session_id' => $session_id,
                'user_id' => $user_id
            ),
            array('%s'),
            array('%s', '%d')
        );
        
        if ($updated === false) {
            return new WP_Error('update_failed', 'Failed to update chat title', array('status' => 500));
        }
        
        return array(
            'success' => true,
            'title' => $title,
            'message' => 'Chat title updated successfully'
        );
    }

    /**
     * Generate a unique session ID
     */
    private function generate_session_id() {
        return 'session_' . uniqid() . '_' . time();
    }
    
    /**
     * Get the model name for a given provider
     */
    private function get_model_for_provider($provider) {
        switch ($provider) {
            case 'openai':
                return $this->settings['openai_model'] ?? 'gpt-4.1-mini';
            case 'anthropic':
                return $this->settings['anthropic_model'] ?? 'claude-sonnet-4-20250514';
            default:
                return 'unknown';
        }
    }
    
    /**
     * Calculate cost for OpenAI models based on token usage
     */
    private function calculate_openai_cost($model, $usage) {
        if (!$usage || !isset($usage['prompt_tokens']) || !isset($usage['completion_tokens'])) {
            return 0;
        }
        
        $prompt_tokens = $usage['prompt_tokens'];
        $completion_tokens = $usage['completion_tokens'];
        
        // OpenAI pricing (as of 2024 - prices per 1M tokens)
        $pricing = array(
            'gpt-4' => array('input' => 30.00, 'output' => 60.00),
            'gpt-4-turbo' => array('input' => 10.00, 'output' => 30.00),
            'gpt-4-turbo-preview' => array('input' => 10.00, 'output' => 30.00),
            'gpt-4.1-mini' => array('input' => 0.15, 'output' => 0.60),
            'gpt-4o-mini' => array('input' => 0.15, 'output' => 0.60),
            'gpt-4o' => array('input' => 5.00, 'output' => 15.00),
            'gpt-3.5-turbo' => array('input' => 0.50, 'output' => 1.50),
            'gpt-3.5-turbo-16k' => array('input' => 3.00, 'output' => 4.00)
        );
        
        // Default to gpt-4.1-mini pricing if model not found
        $model_pricing = $pricing[$model] ?? $pricing['gpt-4.1-mini'];
        
        // Calculate cost (convert from per 1M tokens to per token)
        $input_cost = ($prompt_tokens / 1000000) * $model_pricing['input'];
        $output_cost = ($completion_tokens / 1000000) * $model_pricing['output'];
        
        return $input_cost + $output_cost;
    }
    
    /**
     * Calculate cost for Anthropic models based on token usage
     */
    private function calculate_anthropic_cost($model, $usage) {
        if (!$usage || !isset($usage['input_tokens']) || !isset($usage['output_tokens'])) {
            return 0;
        }
        
        $input_tokens = $usage['input_tokens'];
        $output_tokens = $usage['output_tokens'];
        
        // Anthropic pricing (as of 2024 - prices per 1M tokens)
        $pricing = array(
            'claude-3-opus-20240229' => array('input' => 15.00, 'output' => 75.00),
            'claude-3-sonnet-20240229' => array('input' => 3.00, 'output' => 15.00),
            'claude-3-haiku-20240307' => array('input' => 0.25, 'output' => 1.25),
            'claude-sonnet-4-20250514' => array('input' => 3.00, 'output' => 15.00), // Assuming similar to sonnet-3
            'claude-3.5-sonnet-20241022' => array('input' => 3.00, 'output' => 15.00),
            'claude-3.5-haiku-20241022' => array('input' => 1.00, 'output' => 5.00)
        );
        
        // Default to claude-sonnet-4 pricing if model not found
        $model_pricing = $pricing[$model] ?? $pricing['claude-sonnet-4-20250514'];
        
        // Calculate cost (convert from per 1M tokens to per token)
        $input_cost = ($input_tokens / 1000000) * $model_pricing['input'];
        $output_cost = ($output_tokens / 1000000) * $model_pricing['output'];
        
        return $input_cost + $output_cost;
    }
    
    /**
     * Extract total token count from API response
     */
    private function extract_token_count($response, $provider) {
        if (!isset($response['usage'])) {
            return null;
        }
        
        $usage = $response['usage'];
        
        if ($provider === 'openai') {
            return $usage['total_tokens'] ?? null;
        } elseif ($provider === 'anthropic') {
            // Anthropic doesn't provide total_tokens, so we calculate it
            $input_tokens = $usage['input_tokens'] ?? 0;
            $output_tokens = $usage['output_tokens'] ?? 0;
            return $input_tokens + $output_tokens;
        }
        
        return null;
    }
    
    /**
     * Get analytics data
     */
    public function get_analytics($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $user_id = get_current_user_id();
        $days = intval($request->get_param('days')) ?: 30;
        
        // Get API usage statistics
        $api_stats = $this->db->get_api_stats($user_id, $days);
        
        // Get chat session statistics
        $chat_sessions = $this->db->get_chat_history($user_id, null, 20);
        
        // Calculate chat statistics
        $total_sessions = count($chat_sessions);
        $total_messages = 0;
        $active_sessions = 0;
        $cutoff_date = date('Y-m-d H:i:s', strtotime("-7 days"));
        
        foreach ($chat_sessions as $session) {
            $total_messages += intval($session['message_count']);
            if ($session['updated_at'] >= $cutoff_date) {
                $active_sessions++;
            }
        }
        
        $chat_stats = array(
            'total_sessions' => $total_sessions,
            'total_messages' => $total_messages,
            'active_sessions' => $active_sessions
        );
        
        // Get recent sessions with cost data
        $recent_sessions = array_slice($chat_sessions, 0, 10);
        
        return array(
            'success' => true,
            'api_stats' => array(
                'total_requests' => intval($api_stats['total_requests'] ?? 0),
                'total_tokens' => intval($api_stats['total_tokens'] ?? 0),
                'total_cost' => floatval($api_stats['total_cost'] ?? 0),
                'avg_response_time' => floatval($api_stats['avg_response_time'] ?? 0),
                'error_count' => intval($api_stats['error_count'] ?? 0)
            ),
            'chat_stats' => $chat_stats,
            'recent_sessions' => $recent_sessions,
            'time_range' => $days
        );
    }
}
