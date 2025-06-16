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
        
        // Shared conversations endpoints
        register_rest_route('magicassistant/v1', '/shared-conversations', array(
            'methods' => 'POST',
            'callback' => array($this, 'create_shared_conversation'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/shared-conversations', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_user_shared_conversations'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/shared-conversations/(?P<share_id>[a-zA-Z0-9]+)', array(
            'methods' => 'DELETE',
            'callback' => array($this, 'delete_shared_conversation'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/shared-conversations/(?P<share_id>[a-zA-Z0-9]+)', array(
            'methods' => 'PUT',
            'callback' => array($this, 'update_shared_conversation'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        // Public endpoint for viewing shared conversations (no auth required)
        register_rest_route('magicassistant/v1', '/public/shared/(?P<share_id>[a-zA-Z0-9]+)', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_public_shared_conversation'),
            'permission_callback' => '__return_true',
        ));
        
        // LAST SESSION ENDPOINTS
        register_rest_route('magicassistant/v1', '/last-session', array(
            'methods' => 'GET',
            'callback' => array($this, 'get_last_session'),
            'permission_callback' => array($this, 'check_permissions'),
        ));
        
        register_rest_route('magicassistant/v1', '/last-session', array(
            'methods' => 'POST',
            'callback' => array($this, 'set_last_session'),
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
                
                // Persist the mode for this session so the frontend can reopen in the same state
                if (method_exists($this->db, 'set_chat_session_mode')) {
                    $this->db->set_chat_session_mode($user_id, $session_id, $agent_mode);
                }
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
                'cost' => $result['cost'] ?? 0,
                'debug_tool_data' => $result['debug_tool_data'] ?? null
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
        $setting = $this->settings['agent_mode'] ?? 'always';
        
        switch ($setting) {
            case 'always':
                return true;
            case 'never':
            default:
                return false;
        }
    }
    
    // This method is no longer needed since we removed auto detection
    // but keeping it for backwards compatibility in case it's referenced elsewhere
    private function should_use_agent_mode($message) {
        return false; // Always return false since auto mode is removed
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
        
        $tool_calls_count = 0;
        $total_tokens = 0;
        $total_cost = 0;
        
        // Initial AI call
        if ($provider === 'openai') {
            $response = $this->call_openai($messages, $api_key);
        } elseif ($provider === 'anthropic') {
            $response = $this->call_anthropic($messages, $api_key);
        } else {
            throw new Exception('Unsupported AI provider: ' . $provider);
        }
        
        // Update usage tracking
        $total_tokens += $this->extract_token_count($response, $provider) ?? 0;
        $total_cost += $response['cost'] ?? 0;
        
        // Check if AI wants to use tools
        $has_tool_calls = isset($response['tool_calls']) && !empty($response['tool_calls']);
        
        if ($has_tool_calls) {
            // Execute tools
            $tool_results = $this->execute_tools($response['tool_calls']);
            $tool_calls_count = count($response['tool_calls']);
            
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
                                'tool_use_id' => $result['tool_call_id'], // Use the actual tool call ID
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
            
            // Call AI again to get final response with the tool data
            $final_response = null;
            if ($provider === 'openai') {
                $final_response = $this->call_openai($messages, $api_key);
            } elseif ($provider === 'anthropic') {
                $final_response = $this->call_anthropic($messages, $api_key);
            } else {
                throw new Exception('Unsupported AI provider: ' . $provider);
            }
            
            // Update usage tracking for the second call
            $total_tokens += $this->extract_token_count($final_response, $provider) ?? 0;
            $total_cost += $final_response['cost'] ?? 0;
            
            return array(
                'response' => $final_response['content'] ?? '',
                'tool_calls_count' => $tool_calls_count,
                'tokens_used' => $total_tokens,
                'cost' => $total_cost,
                'debug_tool_data' => $this->format_debug_tool_results($tool_results) // For future debugging feature
            );
        }
        
        // No tool calls, return direct response
        return array(
            'response' => $response['content'] ?? '',
            'tool_calls_count' => 0,
            'tokens_used' => $total_tokens,
            'cost' => $total_cost
        );
    }
    
    private function handle_agent_mode($message, $conversation_history, $provider, $api_key) {
        $max_iterations = $this->settings['max_agent_iterations'] ?? 10; // Prevent infinite loops
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
        
        // Track total tokens & cost across all AI calls in agent mode
        $total_tokens = 0;
        $total_cost   = 0;
        
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
            
            // Accumulate tokens & cost from this AI call before deciding next step
            $total_tokens += $this->extract_token_count($response, $provider) ?? 0;
            $total_cost   += $response['cost'] ?? 0;
            
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
                                    'tool_use_id' => $result['tool_call_id'], // Use the actual tool call ID
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
                
                // Tokens & cost for this call were already added above
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
        
        // Format the agent response with summary
        if ($total_tool_calls > 0) {
            $final_response = $this->format_agent_response($final_response, $reasoning_chain, $total_tool_calls);
        }
        
        // After loop ends, $total_tokens & $total_cost already include all calls
        
        return array(
            'response' => $final_response,
            'reasoning' => $reasoning_chain,
            'tool_calls_count' => $total_tool_calls,
            'tokens_used' => $total_tokens,
            'cost' => $total_cost,
            'debug_tool_data' => !empty($all_tool_results) ? $this->format_debug_tool_results($all_tool_results) : null // For future debugging feature
        );
    }
    
    private function execute_tools($tool_calls) {
        $tool_results = [];
        
        foreach ($tool_calls as $tool_call) {
            // Handle both OpenAI and Anthropic formats
            $tool_name = $tool_call['function']['name'] ?? $tool_call['name'] ?? '';
            $tool_args = json_decode($tool_call['function']['arguments'] ?? '{}', true) ?: $tool_call['input'] ?? [];
            $tool_call_id = $tool_call['id'] ?? null; // Tool call ID (works for both OpenAI and Anthropic)
            
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
- IMPORTANT: Only continue if you need MORE data or need to perform MORE actions
- STOP when you have gathered sufficient information to answer the user's question completely
- When finished, provide a comprehensive summary of all actions taken INCLUDING the detailed results from ALL tool executions

AUTOMATIC DATA FETCHING:
- When you see \"🔄 **FETCH_MORE_SUGGESTED**\" or \"🔄 **FETCH_MORE_AVAILABLE**\" in tool results, you SHOULD automatically fetch the additional data if it's relevant to the user's request
- Use the suggested parameters (offset, per_page, pagination, filters) to get complete data sets
- For large datasets, prioritize the most relevant results first, then fetch additional data as needed
- If user asks for \"all\" items or comprehensive lists, automatically fetch all available data using pagination

RESPONSE FORMATTING - IMPORTANT:
- Present information naturally and conversationally based on the user's request
- For detailed analysis requests, provide comprehensive data and insights
- For quick questions, provide concise but complete answers
- Always include the actual data (names, numbers, lists) not just counts
- Adapt your response style to match the user's intent (brief overview vs detailed analysis)
- Present data in a logical, easy-to-read format that makes sense for the context

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
3. STOP when you have enough data to provide a comprehensive answer
4. Only make additional tool calls if you need more specific information
5. Present information naturally based on what the user is asking for
6. Provide insights and analysis, not just raw data

RESPONSE APPROACH:
- For analysis requests: Craft detailed, insightful responses that interpret the data
- For management tasks: Explain what you did and the results clearly
- For information requests: Present data in an organized, conversational way
- Always adapt your response style to match the user's needs and intent

Be proactive and thorough, but focus on creating natural, helpful responses rather than technical data dumps.";
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

RESPONSE STYLE - IMPORTANT:
- Interpret the user's request and respond accordingly:
  * For analysis requests: Provide detailed insights, comparisons, and comprehensive data
  * For quick questions: Give direct, concise answers with key details
  * For \"list\" or \"show\" requests: Present data in an organized, readable format
- Use natural language and conversational tone
- Present tool results as part of your natural response, not as separate technical outputs
- Focus on what the user actually wants to know, not just what the tools returned
- Provide context and insights, not just raw data dumps

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

IMPORTANT: Respond naturally and conversationally. When you use tools to gather information:
- Present the results as part of your natural response, not as separate technical outputs
- Adapt your response style to the user's request (detailed analysis vs. quick answers)
- Focus on providing insights and useful information, not just raw data
- Use a helpful, friendly tone that matches the user's intent

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
        // Optional debug logging of raw API response
        if (!empty($this->settings['debug_log_raw_responses'])) {
            error_log('[MagicAssistant] OpenAI raw response: ' . $body);
        }
        
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
        // Optional debug logging of raw API response
        if (!empty($this->settings['debug_log_raw_responses'])) {
            error_log('[MagicAssistant] Anthropic raw response: ' . $body);
        }
        
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
        // This method is now only used for legacy purposes
        // Chat mode now feeds tool results back to AI for proper responses
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
    
    /**
     * Format tool results for debugging purposes
     * This creates a clean JSON representation for the "Show Raw Data" feature
     */
    private function format_debug_tool_results($results) {
        $debug_data = array();
        
        foreach ($results as $result) {
            $debug_data[] = array(
                'tool' => $result['tool'],
                'success' => $result['success'],
                'result' => $result['success'] ? $result['result'] : null,
                'error' => !$result['success'] ? $result['error'] : null,
                'execution_time' => $result['execution_time'] ?? null
            );
        }
        
        return $debug_data;
    }
    
    private function extract_anthropic_tool_calls($data) {
        $tool_calls = [];
        
        if (isset($data['content'])) {
            foreach ($data['content'] as $content_block) {
                if ($content_block['type'] === 'tool_use') {
                    $tool_calls[] = array(
                        'id' => $content_block['id'],  // Preserve the tool use ID
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
            'complete_data_removal' => isset($this->settings['complete_data_removal']) ? (bool) $this->settings['complete_data_removal'] : false,
            'ai_provider' => $this->settings['ai_provider'] ?? 'openai',
            'mcp_enabled' => isset($this->settings['mcp_enabled']) ? (bool) $this->settings['mcp_enabled'] : false,
            'openai_model' => $this->settings['openai_model'] ?? 'gpt-4.1-mini',
            'anthropic_model' => $this->settings['anthropic_model'] ?? 'claude-sonnet-4-20250514',
            'has_api_key' => $this->db ? ($this->db->has_api_key('openai_api_key') || $this->db->has_api_key('anthropic_api_key')) : false,
            'openai_api_key' => $this->db ? $this->db->has_api_key('openai_api_key') : false,
            'anthropic_api_key' => $this->db ? $this->db->has_api_key('anthropic_api_key') : false,
            'enable_create_tools' => isset($this->settings['enable_create_tools']) ? (bool) $this->settings['enable_create_tools'] : true,
            'enable_update_tools' => isset($this->settings['enable_update_tools']) ? (bool) $this->settings['enable_update_tools'] : true,
            'enable_delete_tools' => isset($this->settings['enable_delete_tools']) ? (bool) $this->settings['enable_delete_tools'] : false,
            'agent_mode' => $this->settings['agent_mode'] ?? 'always',
            'max_agent_iterations' => $this->settings['max_agent_iterations'] ?? 10,
            'debug_log_raw_responses' => isset($this->settings['debug_log_raw_responses']) ? (bool) $this->settings['debug_log_raw_responses'] : false
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
        
        if (isset($data['complete_data_removal'])) {
            $this->db->save_setting('complete_data_removal', (bool) $data['complete_data_removal']);
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
            $valid_modes = ['always', 'never'];
            $mode = sanitize_text_field($data['agent_mode']);
            if (in_array($mode, $valid_modes)) {
                $this->db->save_setting('agent_mode', $mode);
            }
        }
        
        if (isset($data['max_agent_iterations'])) {
            $iterations = intval($data['max_agent_iterations']);
            if ($iterations >= 5 && $iterations <= 25) {
                $this->db->save_setting('max_agent_iterations', $iterations);
            }
        }
        
        // Debug raw API response logging toggle
        if (isset($data['debug_log_raw_responses'])) {
            $this->db->save_setting('debug_log_raw_responses', (bool) $data['debug_log_raw_responses']);
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
                'agent_mode' => isset($session['agent_mode']) ? (bool)$session['agent_mode'] : false,
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
        
        // OpenAI pricing (updated June 2025 - prices per 1M tokens)
        $pricing = array(
            // GPT-4 series
            'gpt-4.1'        => array('input' => 2.00,  'output' => 8.00),
            'gpt-4.1-mini'   => array('input' => 0.40,  'output' => 1.60),
            'gpt-4.1-nano'   => array('input' => 0.10,  'output' => 0.40),
            // GPT-4o series
            'gpt-4o'         => array('input' => 5.00,  'output' => 15.00),
            'gpt-4o-mini'    => array('input' => 0.15,  'output' => 0.60),
            // o-series (reasoning models)
            'o3'             => array('input' => 2.00, 'output' => 8.00),
            'o3-mini'        => array('input' => 1.10,  'output' => 4.40),
            'o4-mini'        => array('input' => 1.10,  'output' => 4.40)
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
            'claude-sonnet-4-20250514' => array('input' => 3.00, 'output' => 15.00),
            'claude-opus-4-20250514' => array('input' => 15.00, 'output' => 75.00),
            'claude-3-7-sonnet-20250219' => array('input' => 3.00, 'output' => 15.00),
            'claude-3-5-sonnet-20241022' => array('input' => 3, 'output' => 15.00),
            'claude-3-5-haiku-20241022' => array('input' => 0.80, 'output' => 4.00)
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
    
    /**
     * Create a shared conversation
     */
    public function create_shared_conversation($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $data = $request->get_json_params();
        $user_id = get_current_user_id();
        
        $title = sanitize_text_field($data['title'] ?? '');
        $session_id = sanitize_text_field($data['session_id'] ?? '');
        $formatted_content = $data['formatted_content'] ?? '';
        $expires_in_days = intval($data['expires_in_days'] ?? 0);
        
        if (empty($title) || empty($formatted_content)) {
            return new WP_Error('missing_data', 'Title and content are required', array('status' => 400));
        }
        
        // Generate HTML content with styling
        $html_content = $this->generate_html_content($title, $formatted_content);
        
        // Calculate expiration date if specified
        $expires_at = null;
        if ($expires_in_days > 0) {
            $expires_at = date('Y-m-d H:i:s', strtotime("+{$expires_in_days} days"));
        }
        
        $share_id = $this->db->create_shared_conversation(
            $user_id,
            $session_id,
            $title,
            $formatted_content,
            $html_content,
            $expires_at
        );
        
        if ($share_id) {
            return array(
                'success' => true,
                'share_id' => $share_id,
                'share_url' => home_url("/magicassistant/shared/{$share_id}"),
                'message' => 'Conversation shared successfully'
            );
        } else {
            return new WP_Error('creation_failed', 'Failed to create shared conversation', array('status' => 500));
        }
    }
    
    /**
     * Get user's shared conversations
     */
    public function get_user_shared_conversations($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $user_id = get_current_user_id();
        $limit = intval($request->get_param('limit')) ?: 50;
        
        $conversations = $this->db->get_user_shared_conversations($user_id, $limit);
        
        // Add full URLs to each conversation
        foreach ($conversations as &$conversation) {
            $conversation['share_url'] = home_url("/magicassistant/shared/{$conversation['share_id']}");
        }
        
        return array(
            'success' => true,
            'conversations' => $conversations
        );
    }
    
    /**
     * Delete a shared conversation
     */
    public function delete_shared_conversation($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $share_id = $request->get_param('share_id');
        $user_id = get_current_user_id();
        
        if (empty($share_id)) {
            return new WP_Error('missing_share_id', 'Share ID is required', array('status' => 400));
        }
        
        $deleted = $this->db->delete_shared_conversation($user_id, $share_id);
        
        if ($deleted) {
            return array(
                'success' => true,
                'message' => 'Shared conversation deleted successfully'
            );
        } else {
            return new WP_Error('deletion_failed', 'Failed to delete shared conversation', array('status' => 500));
        }
    }
    
    /**
     * Update a shared conversation
     */
    public function update_shared_conversation($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $share_id = $request->get_param('share_id');
        $data = $request->get_json_params();
        $user_id = get_current_user_id();
        
        if (empty($share_id)) {
            return new WP_Error('missing_share_id', 'Share ID is required', array('status' => 400));
        }
        
        $update_data = array();
        
        if (isset($data['title'])) {
            $update_data['title'] = sanitize_text_field($data['title']);
        }
        
        if (isset($data['is_public'])) {
            $update_data['is_public'] = (bool) $data['is_public'];
        }
        
        if (isset($data['expires_in_days'])) {
            $expires_in_days = intval($data['expires_in_days']);
            if ($expires_in_days > 0) {
                $update_data['expires_at'] = date('Y-m-d H:i:s', strtotime("+{$expires_in_days} days"));
            } else {
                $update_data['expires_at'] = null;
            }
        }
        
        if (empty($update_data)) {
            return new WP_Error('no_data', 'No valid data to update', array('status' => 400));
        }
        
        $updated = $this->db->update_shared_conversation($user_id, $share_id, $update_data);
        
        if ($updated) {
            return array(
                'success' => true,
                'message' => 'Shared conversation updated successfully'
            );
        } else {
            return new WP_Error('update_failed', 'Failed to update shared conversation', array('status' => 500));
        }
    }
    
    /**
     * Get public shared conversation
     */
    public function get_public_shared_conversation($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        
        $share_id = $request->get_param('share_id');
        
        if (empty($share_id)) {
            return new WP_Error('missing_share_id', 'Share ID is required', array('status' => 400));
        }
        
        $conversation = $this->db->get_shared_conversation($share_id);
        
        if (!$conversation) {
            return new WP_Error('not_found', 'Shared conversation not found or expired', array('status' => 404));
        }
        
        return array(
            'success' => true,
            'conversation' => array(
                'title' => $conversation['title'],
                'html_content' => $conversation['html_content'],
                'formatted_content' => $conversation['formatted_content'],
                'view_count' => $conversation['view_count'],
                'created_at' => $conversation['created_at']
            )
        );
    }
    
    /**
     * Generate HTML content for shared conversation
     */
    private function generate_html_content($title, $formatted_content) {
        // Convert markdown to HTML using a simple approach
        $html_content = wp_kses_post($formatted_content);
        
        // Convert markdown headers
        $html_content = preg_replace('/^# (.+)$/m', '<h1>$1</h1>', $html_content);
        $html_content = preg_replace('/^## (.+)$/m', '<h2>$1</h2>', $html_content);
        $html_content = preg_replace('/^### (.+)$/m', '<h3>$1</h3>', $html_content);
        
        // Convert bold and italic
        $html_content = preg_replace('/\*\*([^*]+)\*\*/', '<strong>$1</strong>', $html_content);
        $html_content = preg_replace('/\*([^*]+)\*/', '<em>$1</em>', $html_content);
        
        // Convert line breaks
        $html_content = str_replace("\n", '<br>', $html_content);
        
        // Convert horizontal rules
        $html_content = str_replace('---', '<hr>', $html_content);
        
        return $html_content;
    }

    /**
     * Get the last opened chat session ID for the current user
     */
    public function get_last_session($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        $user_id = get_current_user_id();
        $session_id = $this->db->get_user_setting('last_session_id', $user_id, '');
        return array(
            'success' => true,
            'session_id' => $session_id,
        );
    }

    /**
     * Persist the last opened chat session ID for the current user
     */
    public function set_last_session($request) {
        if (!$this->db) {
            return new WP_Error('db_error', 'Database not available', array('status' => 500));
        }
        $data = $request->get_json_params();
        $session_id = isset($data['session_id']) ? sanitize_text_field($data['session_id']) : '';
        $user_id = get_current_user_id();
        if (empty($session_id)) {
            // If empty, clear the setting
            $this->db->delete_setting('last_session_id', $user_id);
            return array('success' => true, 'session_id' => '');
        }
        $this->db->save_user_setting('last_session_id', $session_id, $user_id);
        return array(
            'success' => true,
            'session_id' => $session_id,
        );
    }

}
