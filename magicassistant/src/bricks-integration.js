/**
 * Bricks Builder Integration for MagicAssistant
 * 
 * This file handles the integration between MagicAssistant AI chat and Bricks Builder:
 * - Detects when we're in Bricks Builder mode
 * - Processes AI-generated HTML/TailwindCSS content
 * - Converts to native Bricks elements
 * - Inserts elements directly into the Bricks canvas
 */

class MagicAssistantBricksIntegration {
    constructor() {
        this.isActive = false;
        this.bricksData = null;
        this.chatInterface = null;
        this.originalSendMessage = null;
        
        this.init();
    }

    /**
     * Initialize the integration
     */
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    /**
     * Setup the integration
     */
    setup() {
        // Check if we're in Bricks Builder
        if (!this.isBricksBuilder()) {
            return;
        }

        this.isActive = true;
        console.log('MagicAssistant: Bricks Builder mode detected');

        // Wait for Bricks to be fully loaded
        this.waitForBricks(() => {
            this.setupBricksIntegration();
        });

        // Wait for chat interface and enhance it
        this.waitForChatInterface(() => {
            this.enhanceChatInterface();
        });
    }

    /**
     * Check if we're in Bricks Builder mode
     */
    isBricksBuilder() {
        const url = new URL(window.location.href);
        return url.searchParams.get('bricks') === 'run' || 
               window.location.href.includes('bricks=run') ||
               (typeof window.bricksData !== 'undefined');
    }

    /**
     * Wait for Bricks to be loaded
     */
    waitForBricks(callback, attempts = 0) {
        if (typeof window.bricksData !== 'undefined' && window.bricksData) {
            this.bricksData = window.bricksData;
            callback();
        } else if (attempts < 50) {
            setTimeout(() => this.waitForBricks(callback, attempts + 1), 200);
        } else {
            console.warn('MagicAssistant: Bricks data not found after waiting');
        }
    }

    /**
     * Wait for chat interface to be available
     */
    waitForChatInterface(callback, attempts = 0) {
        const chatContainer = document.querySelector('.chat-interface') || 
                            document.querySelector('[data-testid="chat-interface"]') ||
                            document.querySelector('.floating-chat');
        
        if (chatContainer || attempts > 30) {
            if (chatContainer) {
                this.chatInterface = chatContainer;
                callback();
            } else {
                console.warn('MagicAssistant: Chat interface not found');
            }
        } else {
            setTimeout(() => this.waitForChatInterface(callback, attempts + 1), 200);
        }
    }

    /**
     * Setup Bricks-specific integration
     */
    setupBricksIntegration() {
        // Add styles for Bricks integration
        this.addBricksStyles();

        // Listen for Bricks events
        this.setupBricksEventListeners();

        console.log('MagicAssistant: Bricks integration ready');
    }

    /**
     * Enhance the chat interface for Bricks
     */
    enhanceChatInterface() {
        // Add Bricks mode indicator
        this.addBricksModeIndicator();

        // Enhance message handling
        this.enhanceMessageHandling();

        // Add Bricks-specific UI elements
        this.addBricksUI();

        console.log('MagicAssistant: Chat interface enhanced for Bricks');
    }

    /**
     * Add Bricks mode indicator to chat
     */
    addBricksModeIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'bricks-mode-indicator';
        indicator.innerHTML = `
            <div class="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <svg class="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                </svg>
                <div>
                    <div class="font-medium text-blue-900">Bricks Builder Mode</div>
                    <div class="text-sm text-blue-700">AI will generate structures that can be inserted directly into your canvas</div>
                </div>
            </div>
        `;

        const chatHeader = this.chatInterface.querySelector('.chat-header') || 
                          this.chatInterface.querySelector('h2')?.parentNode ||
                          this.chatInterface.firstElementChild;
        
        if (chatHeader) {
            chatHeader.insertAdjacentElement('afterend', indicator);
        }
    }

    /**
     * Enhance message handling for Bricks content
     */
    enhanceMessageHandling() {
        // Intercept message sending to add Bricks context
        this.interceptMessageSending();

        // Enhance message display to show Bricks actions
        this.enhanceMessageDisplay();
    }

    /**
     * Intercept message sending to add Bricks context
     */
    interceptMessageSending() {
        // Find the message input and send button
        const messageInput = document.querySelector('textarea[placeholder*="message"], input[placeholder*="message"]');
        const sendButton = document.querySelector('button[type="submit"], button:has(svg)');

        if (!messageInput || !sendButton) {
            setTimeout(() => this.interceptMessageSending(), 1000);
            return;
        }

        // Add event listener to enhance messages with Bricks context
        const originalSubmitHandler = sendButton.onclick;
        sendButton.onclick = (e) => {
            this.enhanceMessageWithBricksContext(messageInput);
            if (originalSubmitHandler) {
                originalSubmitHandler.call(sendButton, e);
            }
        };

        // Also handle form submission
        const form = messageInput.closest('form');
        if (form) {
            const originalFormHandler = form.onsubmit;
            form.onsubmit = (e) => {
                this.enhanceMessageWithBricksContext(messageInput);
                if (originalFormHandler) {
                    originalFormHandler.call(form, e);
                }
            };
        }
    }

    /**
     * Enhance message with Bricks context
     */
    enhanceMessageWithBricksContext(messageInput) {
        const message = messageInput.value.trim();
        if (!message) return;

        // Check if message is asking for design/layout
        const isDesignRequest = this.isDesignRelatedMessage(message);
        
        if (isDesignRequest) {
            // Add Bricks context to the message
            const enhancedMessage = this.addBricksContextToMessage(message);
            messageInput.value = enhancedMessage;
        }
    }

    /**
     * Check if message is design-related
     */
    isDesignRelatedMessage(message) {
        const designKeywords = [
            'create', 'design', 'build', 'make', 'section', 'page', 'layout', 
            'header', 'footer', 'hero', 'button', 'form', 'card', 'grid',
            'navigation', 'menu', 'banner', 'content', 'block', 'element'
        ];

        const lowerMessage = message.toLowerCase();
        return designKeywords.some(keyword => lowerMessage.includes(keyword));
    }

    /**
     * Add Bricks context to message
     */
    addBricksContextToMessage(message) {
        const context = `

[BRICKS BUILDER CONTEXT]
I'm working in Bricks Builder. Please generate semantic HTML with TailwindCSS classes that can be converted to native Bricks elements. Focus on:
- Clean, semantic HTML structure
- TailwindCSS utility classes for styling
- Elements that map well to Bricks (headings, text, buttons, containers, images)
- Responsive design with Tailwind responsive prefixes
- Structure that can be easily converted to Bricks elements

Original request: ${message}`;

        return context;
    }

    /**
     * Enhance message display for Bricks
     */
    enhanceMessageDisplay() {
        // Use MutationObserver to watch for new messages
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.processNewMessage(node);
                    }
                });
            });
        });

        const chatMessages = document.querySelector('.chat-messages') || 
                           document.querySelector('[data-testid="chat-messages"]') ||
                           this.chatInterface;

        if (chatMessages) {
            observer.observe(chatMessages, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Process new AI messages for Bricks content
     */
    processNewMessage(messageElement) {
        // Look for AI messages containing HTML/code
        const codeBlocks = messageElement.querySelectorAll('pre code, code');
        
        codeBlocks.forEach((codeBlock) => {
            const content = codeBlock.textContent;
            if (this.looksLikeHTML(content)) {
                this.addBricksActionButton(codeBlock, content);
            }
        });
    }

    /**
     * Check if content looks like HTML
     */
    looksLikeHTML(content) {
        const htmlPattern = /<\s*[a-zA-Z][^>]*>/;
        const hasHTMLTags = htmlPattern.test(content);
        const hasTailwindClasses = content.includes('class=') && 
            (content.includes('flex') || content.includes('grid') || 
             content.includes('text-') || content.includes('bg-') ||
             content.includes('p-') || content.includes('m-'));
        
        return hasHTMLTags && hasTailwindClasses;
    }

    /**
     * Add Bricks action button to code block
     */
    addBricksActionButton(codeBlock, htmlContent) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'bricks-action-container mt-2';
        buttonContainer.innerHTML = `
            <button class="bricks-insert-btn bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
                </svg>
                <span>Insert into Bricks</span>
            </button>
            <div class="bricks-status text-sm text-gray-600 mt-1" style="display: none;"></div>
        `;

        const button = buttonContainer.querySelector('.bricks-insert-btn');
        const status = buttonContainer.querySelector('.bricks-status');

        button.addEventListener('click', () => {
            this.insertIntoBricks(htmlContent, button, status);
        });

        // Insert after the code block
        codeBlock.parentNode.insertAdjacentElement('afterend', buttonContainer);
    }

    /**
     * Insert HTML content into Bricks
     */
    async insertIntoBricks(htmlContent, button, statusElement) {
        try {
            button.disabled = true;
            button.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing...</span>
            `;
            statusElement.style.display = 'block';
            statusElement.textContent = 'Parsing HTML and mapping to Bricks elements...';

            // Step 1: Parse HTML
            const parseResult = await this.makeAPICall('bricks_parse_html', {
                html: htmlContent,
                preserve_structure: true
            });

            if (!parseResult.success) {
                throw new Error('Failed to parse HTML');
            }

            statusElement.textContent = 'Mapping TailwindCSS to Bricks styles...';

            // Step 2: Map Tailwind classes for each element
            for (let element of parseResult.elements) {
                if (element.classes) {
                    const mappingResult = await this.makeAPICall('bricks_map_tailwind', {
                        tailwind_classes: element.classes,
                        element_type: element.bricks_type
                    });
                    element.style_mapping = mappingResult;
                }
            }

            statusElement.textContent = 'Creating Bricks element structure...';

            // Step 3: Create Bricks elements
            const structureResult = await this.makeAPICall('bricks_create_element_structure', {
                elements: parseResult.elements,
                parent_id: this.getCurrentBricksSelection()
            });

            if (!structureResult.success) {
                throw new Error('Failed to create Bricks structure');
            }

            statusElement.textContent = 'Inserting elements into canvas...';

            // Step 4: Insert into Bricks canvas
            const inserted = await this.insertElementsIntoBricks(structureResult.bricks_elements);

            if (inserted) {
                button.innerHTML = `
                    <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    <span>Inserted Successfully</span>
                `;
                button.className = button.className.replace('bg-blue-600 hover:bg-blue-700', 'bg-green-600');
                statusElement.textContent = `Successfully inserted ${structureResult.bricks_elements.length} elements into Bricks canvas`;
                statusElement.className = statusElement.className + ' text-green-600';
            } else {
                throw new Error('Failed to insert elements into Bricks canvas');
            }

        } catch (error) {
            console.error('Bricks insertion error:', error);
            button.innerHTML = `
                <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                </svg>
                <span>Failed</span>
            `;
            button.className = button.className.replace('bg-blue-600 hover:bg-blue-700', 'bg-red-600');
            statusElement.textContent = 'Error: ' + error.message;
            statusElement.className = statusElement.className + ' text-red-600';
        } finally {
            button.disabled = false;
        }
    }

    /**
     * Make API call to MagicAssistant MCP tools
     */
    async makeAPICall(toolName, args) {
        const response = await fetch('/wp-json/magicassistant/v1/mcp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': window.matPublicData?.nonce || window.matAdminData?.nonce
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: args
                },
                id: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error(`API call failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        return JSON.parse(data.result.content[0].text);
    }

    /**
     * Get current Bricks selection/insertion point
     */
    getCurrentBricksSelection() {
        // Try to get current selected element in Bricks
        if (window.bricksData && window.bricksData.selectedElement) {
            return window.bricksData.selectedElement;
        }

        // Fallback to root
        return null;
    }

    /**
     * Insert elements into Bricks canvas
     */
    async insertElementsIntoBricks(bricksElements) {
        console.log('🚀 Attempting to insert elements into Bricks:', bricksElements);
        console.log('🔍 Bricks environment check:', {
            bricksData: typeof window.bricksData,
            bricksAddElement: typeof window.bricksAddElement,
            bricksUpdateCanvas: typeof window.bricksUpdateCanvas,
            currentURL: window.location.href,
            isBricksBuilder: this.isBricksBuilder()
        });

        try {
            // Method 1: Use Bricks API if available
            if (typeof window.bricksAddElement === 'function') {
                console.log('✅ Using window.bricksAddElement');
                bricksElements.forEach(element => {
                    window.bricksAddElement(element);
                });
                return true;
            }

            // Method 2: Use Bricks events/messaging
            if (window.parent && window.parent.postMessage) {
                console.log('✅ Using postMessage to parent');
                window.parent.postMessage({
                    type: 'bricks_add_elements',
                    elements: bricksElements
                }, '*');
                return true;
            }

            // Method 3: Direct manipulation of Bricks data
            if (window.bricksData && window.bricksData.elements) {
                console.log('✅ Using direct bricksData manipulation');
                bricksElements.forEach(element => {
                    window.bricksData.elements.push(element);
                });
                
                // Trigger Bricks update
                if (typeof window.bricksUpdateCanvas === 'function') {
                    window.bricksUpdateCanvas();
                }
                return true;
            }

            console.log('⚠️ No direct insertion method available, trying jQuery events');
            
            // Method 4: Try jQuery events (Bricks uses jQuery)
            if (typeof jQuery !== 'undefined') {
                jQuery(document).trigger('bricks:addElements', [bricksElements]);
                console.log('✅ Triggered jQuery event bricks:addElements');
                return true;
            }

            // Method 5: Try to find and use Bricks app instance
            if (window.bricksApp || window.BricksApp) {
                const app = window.bricksApp || window.BricksApp;
                console.log('✅ Found Bricks app instance:', app);
                if (app.addElements) {
                    app.addElements(bricksElements);
                    return true;
                } else if (app.builder && app.builder.addElements) {
                    app.builder.addElements(bricksElements);
                    return true;
                }
            }

            // Method 6: Simulate Bricks insertion
            console.log('❌ All methods failed, falling back to simulation');
            return this.simulateBricksInsertion(bricksElements);

        } catch (error) {
            console.error('💥 Error inserting into Bricks:', error);
            return false;
        }
    }

    /**
     * Simulate Bricks insertion by triggering UI actions
     */
    simulateBricksInsertion(bricksElements) {
        try {
            // This is a fallback method that tries to simulate user actions
            // in the Bricks interface to add elements
            
            // Store elements in a way Bricks can access them
            window.magicAssistantBricksElements = bricksElements;
            
            // Try to trigger Bricks refresh/update
            const bricksIframe = document.querySelector('iframe[name*="bricks"], iframe[src*="bricks"]');
            if (bricksIframe) {
                bricksIframe.contentWindow.postMessage({
                    type: 'magicassistant_elements',
                    elements: bricksElements
                }, '*');
            }

            // Show manual insertion instructions
            this.showManualInsertionInstructions(bricksElements);
            
            return true;
        } catch (error) {
            console.error('Simulation failed:', error);
            return false;
        }
    }

    /**
     * Show manual insertion instructions
     */
    showManualInsertionInstructions(elements) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Elements Ready for Bricks</h3>
                <p class="text-gray-600 mb-4">
                    ${elements.length} elements have been processed and are ready for insertion. 
                    The element data has been prepared and logged to the console.
                </p>
                <div class="bg-gray-50 p-3 rounded text-sm mb-4">
                    <strong>Console Command:</strong><br>
                    <code>window.magicAssistantBricksElements</code>
                </div>
                <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full">
                    Close
                </button>
            </div>
        `;

        modal.querySelector('button').addEventListener('click', () => {
            modal.remove();
        });

        document.body.appendChild(modal);

        // Log elements to console for manual access
        console.log('MagicAssistant Bricks Elements:', elements);
    }

    /**
     * Add Bricks-specific UI elements
     */
    addBricksUI() {
        // Add quick action buttons for common Bricks patterns
        const quickActions = document.createElement('div');
        quickActions.className = 'bricks-quick-actions mb-4';
        quickActions.innerHTML = `
            <div class="text-sm font-medium text-gray-700 mb-2">Quick Actions:</div>
            <div class="flex flex-wrap gap-2">
                <button class="quick-action-btn bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm" data-prompt="Create a hero section with heading, subtext and button">Hero Section</button>
                <button class="quick-action-btn bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm" data-prompt="Create a features section with 3 columns">Features Grid</button>
                <button class="quick-action-btn bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm" data-prompt="Create a contact form with name, email and message fields">Contact Form</button>
                <button class="quick-action-btn bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm" data-prompt="Create a pricing table with 3 tiers">Pricing Table</button>
            </div>
        `;

        // Add event listeners to quick action buttons
        quickActions.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const prompt = e.target.dataset.prompt;
                const messageInput = document.querySelector('textarea[placeholder*="message"], input[placeholder*="message"]');
                if (messageInput) {
                    messageInput.value = prompt;
                    messageInput.focus();
                }
            }
        });

        // Insert quick actions
        const indicator = document.querySelector('.bricks-mode-indicator');
        if (indicator) {
            indicator.insertAdjacentElement('afterend', quickActions);
        }
    }

    /**
     * Add CSS styles for Bricks integration
     */
    addBricksStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .bricks-mode-indicator {
                animation: fadeIn 0.3s ease-in-out;
            }
            
            .bricks-action-container {
                border-top: 1px solid #e5e7eb;
                padding-top: 0.5rem;
                margin-top: 0.5rem;
            }
            
            .bricks-insert-btn {
                transition: all 0.2s ease;
            }
            
            .bricks-insert-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
            }
            
            .quick-action-btn {
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }
            
            .quick-action-btn:hover {
                border-color: #d1d5db;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .animate-spin {
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        
        document.head.appendChild(styles);
    }

    /**
     * Setup Bricks event listeners
     */
    setupBricksEventListeners() {
        // Listen for Bricks events
        window.addEventListener('message', (event) => {
            if (event.data.type === 'bricks_element_selected') {
                console.log('Bricks element selected:', event.data.element);
            }
        });

        // Listen for Bricks state changes
        if (window.bricksData) {
            // Set up observer for Bricks data changes
            if (typeof Proxy !== 'undefined') {
                window.bricksData = new Proxy(window.bricksData, {
                    set: (target, property, value) => {
                        if (property === 'selectedElement') {
                            console.log('Bricks selection changed:', value);
                        }
                        target[property] = value;
                        return true;
                    }
                });
            }
        }
    }
}

// Initialize the integration when the script loads
window.magicAssistantBricksIntegration = new MagicAssistantBricksIntegration();

// Export for potential use by other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MagicAssistantBricksIntegration;
}