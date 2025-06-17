/**
 * MagicAssistant Pagebuilder Integration
 * 
 * Coordinates pagebuilder detection and element insertion
 */

(function($) {
    'use strict';
    
    window.matPagebuilderIntegration = {
        
        activeIntegrations: [],
        currentPagebuilder: null,
        
        /**
         * Initialize pagebuilder integration
         */
        init: function() {
            console.log('Initializing pagebuilder integration');
            
            // Detect active pagebuilders
            this.detectPagebuilders();
            
            // Setup communication with floating chat
            this.setupChatCommunication();
        },
        
        /**
         * Detect which pagebuilders are active
         */
        detectPagebuilders: function() {
            // Check for Bricks
            if (this.isBricksActive()) {
                this.activeIntegrations.push('bricks');
                this.currentPagebuilder = 'bricks';
                console.log('Detected Bricks pagebuilder');
            }
            
            // Check for Elementor
            if (this.isElementorActive()) {
                this.activeIntegrations.push('elementor');
                if (!this.currentPagebuilder) {
                    this.currentPagebuilder = 'elementor';
                }
                console.log('Detected Elementor pagebuilder');
            }
            
            // Check for Gutenberg
            if (this.isGutenbergActive()) {
                this.activeIntegrations.push('gutenberg');
                if (!this.currentPagebuilder) {
                    this.currentPagebuilder = 'gutenberg';
                }
                console.log('Detected Gutenberg editor');
            }
            
            console.log('Active pagebuilders:', this.activeIntegrations);
        },
        
        /**
         * Check if Bricks is active
         */
        isBricksActive: function() {
            return (
                window.location.href.includes('bricks=edit') ||
                window.location.href.includes('bricks=run') ||
                (typeof window.bricksData !== 'undefined') ||
                document.body.classList.contains('bricks-is-builder')
            );
        },
        
        /**
         * Check if Elementor is active
         */
        isElementorActive: function() {
            return (
                window.location.href.includes('elementor') ||
                (typeof window.elementor !== 'undefined') ||
                document.body.classList.contains('elementor-editor-active')
            );
        },
        
        /**
         * Check if Gutenberg is active
         */
        isGutenbergActive: function() {
            return (
                (typeof window.wp !== 'undefined' && window.wp.blocks) ||
                document.body.classList.contains('block-editor-page')
            );
        },
        
        /**
         * Setup communication with floating chat
         */
        setupChatCommunication: function() {
            // Listen for pagebuilder content generation requests
            window.addEventListener('mat-pagebuilder-content', (event) => {
                this.handleContentGeneration(event.detail);
            });
            
            // Provide pagebuilder context to chat
            this.providePagebuilderContext();
        },
        
        /**
         * Handle content generation request
         */
        handleContentGeneration: function(data) {
            console.log('Handling pagebuilder content generation:', data);
            
            if (!this.currentPagebuilder) {
                console.warn('No active pagebuilder detected');
                return;
            }
            
            // Route to appropriate pagebuilder integration
            switch (this.currentPagebuilder) {
                case 'bricks':
                    if (window.matBricksIntegration) {
                        window.matBricksIntegration.insertElements(data.elements, data.insertMethod);
                    }
                    break;
                    
                case 'elementor':
                    // Future Elementor integration
                    console.log('Elementor integration not yet implemented');
                    break;
                    
                case 'gutenberg':
                    // Future Gutenberg integration
                    console.log('Gutenberg integration not yet implemented');
                    break;
                    
                default:
                    console.warn('Unknown pagebuilder:', this.currentPagebuilder);
            }
        },
        
        /**
         * Provide pagebuilder context to chat interface
         */
        providePagebuilderContext: function() {
            // Update global data for floating chat
            if (typeof window.matPublicData !== 'undefined') {
                window.matPublicData.pagebuilderContext = {
                    active: this.activeIntegrations,
                    current: this.currentPagebuilder,
                    inBuilder: this.isInBuilderMode()
                };
            }
            
            if (typeof window.matAdminData !== 'undefined') {
                window.matAdminData.pagebuilderContext = {
                    active: this.activeIntegrations,
                    current: this.currentPagebuilder,
                    inBuilder: this.isInBuilderMode()
                };
            }
        },
        
        /**
         * Check if we're currently in a builder mode
         */
        isInBuilderMode: function() {
            return this.activeIntegrations.length > 0;
        },
        
        /**
         * Get pagebuilder-specific information for AI context
         */
        getPagebuilderInfo: function() {
            return {
                pagebuilder: this.currentPagebuilder,
                inBuilderMode: this.isInBuilderMode(),
                availableElements: this.getAvailableElements(),
                capabilities: this.getPagebuilderCapabilities()
            };
        },
        
        /**
         * Get available elements for current pagebuilder
         */
        getAvailableElements: function() {
            switch (this.currentPagebuilder) {
                case 'bricks':
                    return [
                        'heading', 'text', 'button', 'image', 'div', 'section',
                        'form', 'video', 'slider', 'testimonial', 'icon', 'spacer'
                    ];
                    
                case 'elementor':
                    return [
                        'heading', 'text-editor', 'button', 'image', 'spacer',
                        'divider', 'video', 'html', 'shortcode', 'icon'
                    ];
                    
                case 'gutenberg':
                    return [
                        'paragraph', 'heading', 'button', 'image', 'spacer',
                        'separator', 'video', 'html', 'shortcode', 'group'
                    ];
                    
                default:
                    return [];
            }
        },
        
        /**
         * Get pagebuilder capabilities
         */
        getPagebuilderCapabilities: function() {
            const capabilities = {
                responsive_design: true,
                custom_css: true,
                dynamic_content: false,
                animations: false,
                templates: false
            };
            
            switch (this.currentPagebuilder) {
                case 'bricks':
                    capabilities.dynamic_content = true;
                    capabilities.animations = true;
                    capabilities.templates = true;
                    break;
                    
                case 'elementor':
                    capabilities.animations = true;
                    capabilities.templates = true;
                    break;
                    
                case 'gutenberg':
                    capabilities.dynamic_content = true;
                    break;
            }
            
            return capabilities;
        }
    };
    
    // Initialize when document is ready
    $(document).ready(function() {
        window.matPagebuilderIntegration.init();
    });
    
})(jQuery); 