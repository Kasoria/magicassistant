/**
 * Bricks Integration JavaScript
 * 
 * Handles communication between MagicAssistant and Bricks builder
 * to insert generated elements into the page structure
 */

(function($) {
    'use strict';
    
    // Initialize Bricks integration
    window.matBricksIntegration = {
        
        /**
         * Insert elements into Bricks builder
         */
        insertElements: function(elements, insertMethod) {
            console.log('Inserting Bricks elements:', elements, insertMethod);
            
            // Check if we're in Bricks builder context
            if (!this.isBricksBuilder()) {
                console.warn('Not in Bricks builder context');
                return false;
            }
            
            try {
                // Try to insert elements using Bricks API
                this.insertViaBricksAPI(elements, insertMethod);
                
                // Show success message
                this.showNotification('Elements inserted successfully!', 'success');
                
                return true;
                
            } catch (error) {
                console.error('Failed to insert elements:', error);
                this.showNotification('Failed to insert elements: ' + error.message, 'error');
                return false;
            }
        },
        
        /**
         * Check if we're in Bricks builder
         */
        isBricksBuilder: function() {
            // Check for Bricks builder indicators
            return (
                window.location.href.includes('bricks=edit') ||
                window.location.href.includes('bricks=run') ||
                (typeof window.bricksData !== 'undefined') ||
                document.body.classList.contains('bricks-is-builder')
            );
        },
        
        /**
         * Insert elements using Bricks API
         */
        insertViaBricksAPI: function(elements, insertMethod) {
            // Check if Bricks builder API is available
            if (typeof window.bricksData === 'undefined' || typeof window.bricksBuilderApp === 'undefined') {
                throw new Error('Bricks builder API not available');
            }
            
            // Get the current page elements
            let pageElements = window.bricksData.pageElements || [];
            
            // Process each element
            elements.forEach(element => {
                const bricksElement = this.formatElementForBricks(element);
                
                switch (insertMethod) {
                    case 'prepend':
                        pageElements.unshift(bricksElement);
                        break;
                    case 'append':
                    default:
                        pageElements.push(bricksElement);
                        break;
                    case 'replace':
                        pageElements = [bricksElement];
                        break;
                }
            });
            
            // Update the page elements
            window.bricksData.pageElements = pageElements;
            
            // Trigger builder refresh if possible
            if (window.bricksBuilderApp && typeof window.bricksBuilderApp.updateElements === 'function') {
                window.bricksBuilderApp.updateElements();
            }
            
            // Alternative: trigger Vue reactivity update
            if (window.Vue && window.bricksBuilderApp) {
                window.bricksBuilderApp.$forceUpdate();
            }
        },
        
        /**
         * Format element for Bricks builder
         */
        formatElementForBricks: function(element) {
            return {
                id: element.id || this.generateElementId(),
                name: element.name || 'div',
                label: element.label || element.name || 'Element',
                settings: element.settings || {},
                children: (element.children || []).map(child => this.formatElementForBricks(child))
            };
        },
        
        /**
         * Generate unique element ID
         */
        generateElementId: function() {
            return 'mat_' + Math.random().toString(36).substr(2, 9);
        },
        
        /**
         * Show notification to user
         */
        showNotification: function(message, type) {
            // Try to use Bricks notification system first
            if (window.bricksNotification && typeof window.bricksNotification.show === 'function') {
                window.bricksNotification.show(message, type);
                return;
            }
            
            // Fallback to browser notification
            console.log('[Bricks Integration] ' + type.toUpperCase() + ': ' + message);
            
            // Simple visual notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'success' ? '#10b981' : '#ef4444'};
                color: white;
                border-radius: 6px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
        },
        
        /**
         * Debug function to inspect Bricks builder state
         */
        debugBricksState: function() {
            console.log('Bricks Debug Info:', {
                url: window.location.href,
                bricksData: window.bricksData,
                bricksBuilderApp: window.bricksBuilderApp,
                bodyClasses: document.body.className
            });
        }
    };
    
    // Auto-initialize when document is ready
    $(document).ready(function() {
        console.log('Bricks integration loaded');
        
        // Debug info in development
        if (window.location.href.includes('debug=true')) {
            window.matBricksIntegration.debugBricksState();
        }
    });
    
})(jQuery); 