/**
 * MagicAssistant Bricks Integration
 * 
 * This file provides JavaScript functionality for enhanced Bricks pagebuilder integration.
 */

(function($) {
    'use strict';
    
    /**
     * Initialize Bricks integration when document is ready
     */
    $(document).ready(function() {
        if (typeof magicAssistantBricks === 'undefined') {
            return;
        }
        
        // Only proceed if we're in Bricks builder
        if (!magicAssistantBricks.isBuilder) {
            return;
        }
        
        console.log('MagicAssistant Bricks Integration loaded');
        
        // Initialize Bricks-specific functionality
        initBricksIntegration();
    });
    
    /**
     * Initialize Bricks integration features
     */
    function initBricksIntegration() {
        // Add pagebuilder context to chat interface
        addPagebuilderContext();
        
        // Listen for element addition events
        listenForElementAdditions();
        
        // Add Bricks-specific UI enhancements
        addBricksUIEnhancements();
    }
    
    /**
     * Add pagebuilder context information to the chat interface
     */
    function addPagebuilderContext() {
        // Ensure the chat interface knows we're in Bricks mode
        if (typeof window.magicAssistantData !== 'undefined') {
            window.magicAssistantData.pagebuilder = 'bricks';
            window.magicAssistantData.pagebuilderName = 'Bricks';
            window.magicAssistantData.canCreateElements = true;
        }
        
        // Add data attribute to body for CSS targeting
        $('body').attr('data-ma-pagebuilder', 'bricks');
    }
    
    /**
     * Listen for element addition events from the AI
     */
    function listenForElementAdditions() {
        $(document).on('magicassistant:element:added', function(event, data) {
            if (data.pagebuilder === 'bricks') {
                handleBricksElementAdded(data);
            }
        });
    }
    
    /**
     * Handle when a Bricks element is added by the AI
     */
    function handleBricksElementAdded(data) {
        console.log('Bricks element added:', data);
        
        // Refresh the Bricks builder panel if possible
        if (typeof window.bricksData !== 'undefined' && window.bricksData.isBuilder) {
            // Trigger a refresh of the Bricks panel
            // Note: This may need to be adjusted based on Bricks' internal API
            refreshBricksPanel();
        }
        
        // Show a notification
        showElementAddedNotification(data);
    }
    
    /**
     * Add Bricks-specific UI enhancements
     */
    function addBricksUIEnhancements() {
        // Add a visual indicator that MagicAssistant is active
        addMagicAssistantIndicator();
        
        // Add quick action buttons if appropriate
        addQuickActionButtons();
    }
    
    /**
     * Add a visual indicator that MagicAssistant is active in Bricks
     */
    function addMagicAssistantIndicator() {
        // Check if Bricks builder panel exists
        if ($('#bricks-builder-panel').length) {
            // Add indicator to Bricks panel
            const indicator = $('<div class="ma-bricks-indicator">MagicAssistant Active</div>');
            indicator.css({
                'position': 'fixed',
                'top': '10px',
                'right': '10px',
                'background': '#007cba',
                'color': 'white',
                'padding': '5px 10px',
                'border-radius': '3px',
                'font-size': '12px',
                'z-index': '999999'
            });
            
            $('body').append(indicator);
            
            // Auto-hide after 3 seconds
            setTimeout(function() {
                indicator.fadeOut();
            }, 3000);
        }
    }
    
    /**
     * Add quick action buttons for common tasks
     */
    function addQuickActionButtons() {
        // This could be expanded to add quick buttons for common AI actions
        // For now, just log that this feature is available
        console.log('Quick action buttons feature available for future enhancement');
    }
    
    /**
     * Refresh the Bricks builder panel
     */
    function refreshBricksPanel() {
        // Attempt to refresh Bricks panel
        // This may need to be adjusted based on Bricks' actual API
        if (typeof window.bricks !== 'undefined' && window.bricks.refresh) {
            window.bricks.refresh();
        } else {
            // Fallback: trigger a general refresh event
            $(window).trigger('resize');
        }
    }
    
    /**
     * Show notification when element is added
     */
    function showElementAddedNotification(data) {
        const notification = $('<div class="ma-element-notification">')
            .text(`${data.element_name} element added successfully!`)
            .css({
                'position': 'fixed',
                'bottom': '20px',
                'right': '20px',
                'background': '#46b450',
                'color': 'white',
                'padding': '10px 15px',
                'border-radius': '3px',
                'z-index': '999999',
                'font-size': '14px'
            });
        
        $('body').append(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(function() {
            notification.fadeOut(function() {
                $(this).remove();
            });
        }, 3000);
    }
    
    /**
     * Helper function to get current Bricks context
     */
    function getBricksContext() {
        return {
            isBuilder: magicAssistantBricks.isBuilder,
            postId: magicAssistantBricks.postId,
            hasElements: $('.bricks-element').length > 0
        };
    }
    
    // Expose some functions globally for external use
    window.magicAssistantBricks = $.extend(window.magicAssistantBricks || {}, {
        refreshPanel: refreshBricksPanel,
        getContext: getBricksContext,
        addElement: handleBricksElementAdded
    });
    
})(jQuery); 