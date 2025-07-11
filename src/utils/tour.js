import { driver } from "driver.js";

/**
 * Step-centric validation system for tour steps
 */
class StepValidator {
  constructor() {
    this.currentValidation = null;
    this.cleanup = null;
    this.validationActive = false;
    this.buttonObserver = null;
  }

  // Enable next button
  enableNextButton() {
    const nextBtn = document.querySelector('.driver-popover-next-btn');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
      nextBtn.style.cursor = 'pointer';
    }
  }

  // Disable next button
  disableNextButton() {
    const nextBtn = document.querySelector('.driver-popover-next-btn');
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.5';
      nextBtn.style.cursor = 'not-allowed';
    }
    this.startButtonStateMonitoring();
  }

  // Start monitoring button state to prevent tour framework from overriding
  startButtonStateMonitoring() {
    if (this.buttonObserver) {
      this.buttonObserver.disconnect();
    }

    const nextBtn = document.querySelector('.driver-popover-next-btn');
    if (nextBtn && this.validationActive) {
      this.buttonObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName === 'disabled' || mutation.attributeName === 'style')) {
            // Re-enforce disabled state if validation is still active
            if (this.validationActive && !nextBtn.disabled) {
              nextBtn.disabled = true;
              nextBtn.style.opacity = '0.5';
              nextBtn.style.cursor = 'not-allowed';
            }
          }
        });
      });

      this.buttonObserver.observe(nextBtn, {
        attributes: true,
        attributeFilter: ['disabled', 'style']
      });
    }
  }

  // Stop monitoring button state
  stopButtonStateMonitoring() {
    if (this.buttonObserver) {
      this.buttonObserver.disconnect();
      this.buttonObserver = null;
    }
  }

  // Clean up current validation
  reset() {
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
    this.currentValidation = null;
    this.validationActive = false;
    this.stopButtonStateMonitoring();
  }

  // Create click validation for a step
  requireClick(selector, delay = 500) {
    // Clean up any existing validation
    this.reset();
    
    const targetElement = document.querySelector(selector);
    if (!targetElement) {
      return false;
    }

    // Set validation as active
    this.validationActive = true;

    // Disable next button initially
    this.disableNextButton();

    const handler = () => {
      setTimeout(() => {
        this.validationActive = false;
        this.stopButtonStateMonitoring();
        this.enableNextButton();
      }, delay);
    };

    // Add event listener
    targetElement.addEventListener('click', handler);

    // Store cleanup function
    this.cleanup = () => {
      targetElement.removeEventListener('click', handler);
      this.validationActive = false;
      this.stopButtonStateMonitoring();
    };

    return true;
  }

  // Create custom validation with callback
  requireCustom(validationCallback, cleanupCallback) {
    // Clean up any existing validation
    this.reset();
    
    // Disable next button initially
    this.disableNextButton();

    // Store cleanup function
    this.cleanup = cleanupCallback;

    // Execute validation callback
    validationCallback({
      enableNext: () => this.enableNextButton(),
      disableNext: () => this.disableNextButton()
    });

    return true;
  }
}

// Create global validator instance
const stepValidator = new StepValidator();

/**
 * Legacy helper functions for backward compatibility
 */
const TourHelpers = {
  // Clean up event handlers for an element
  cleanupEventHandlers(element) {
    if (element && element._tourHandlers) {
      element._tourHandlers.forEach(({ element: el, event, handler }) => {
        el.removeEventListener(event, handler);
      });
      element._tourHandlers = [];
    }
  }
};

/**
 * Main tour configuration
 * Guides users through the MagicAssistant interface
 */
export const licenseTour = {
  steps: [
    {
      popover: {
        title: 'Welcome to MagicAssistant! 🎉',
        description: 'Welcome to your AI-powered WordPress assistant! Let\'s take a quick tour to get you started with the key features.',
        side: 'center',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Start Tour',
        showButtons: ['next', 'close']
      }
    },
    {
      element: '[data-tour="license-tab"]',
      popover: {
        title: 'License Management',
        description: 'First, you\'ll need to activate your license. Click here to access the license management area where you can enter your license key.',
        side: 'right',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      },
      onHighlighted: (element) => {
        // Ensure sidebar is expanded for better visibility
        const sidebar = document.querySelector('.sidebar-container');
        if (sidebar?.classList.contains('w-16')) {
          // Trigger sidebar expansion if collapsed
          const expandButton = document.querySelector('button[title="Expand sidebar"]');
          if (expandButton) {
            expandButton.click();
          }
        }
        
        // Require click on license tab to proceed
        stepValidator.requireClick('[data-tour="license-tab"]', 500);
      }
    },
    {
      element: '[data-tour="license-management-card"]',
      popover: {
        title: 'Enter Your License Key',
        description: 'Please enter your license key in this section. You need to activate your license before proceeding to the next step.',
        side: 'right',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      },
      onHighlighted: (element) => {
        // Disable next button until license is activated
        setTimeout(() => {
          const nextBtn = document.querySelector('.driver-popover-next-btn');
          if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.style.opacity = '0.5';
            nextBtn.style.cursor = 'not-allowed';
          }
        }, 100);
        
        // Monitor for license activation by checking multiple indicators
        const checkLicenseActivation = () => {
          // Check for active license display (green success state container)
          const activeLicenseDisplay = document.querySelector('.bg-green-50, [class*="bg-green-50"]');
          
          // Check for "License Active" text
          const licenseActiveText = document.querySelector('h3');
          const hasLicenseActiveText = licenseActiveText && licenseActiveText.textContent.trim() === 'License Active';
          
          // Check for deactivate button (Flowbite failure color button)
          const deactivateBtn = document.querySelector('button[color="failure"], button.bg-red-600, button[class*="bg-red-"]');
          
          // Check if activate button is missing (means license is active)
          const activateBtn = document.querySelector('button[data-tour="activate-license-btn"]');
          const noActivateBtn = !activateBtn;
          
          // License is considered activated if any of these conditions are met:
          // 1. Active license display container is present
          // 2. "License Active" text is found
          // 3. Deactivate button exists
          // 4. Activate button is missing (replaced by deactivate)
          const isLicenseActive = activeLicenseDisplay || hasLicenseActiveText || deactivateBtn || noActivateBtn;
          
          const nextBtn = document.querySelector('.driver-popover-next-btn');
          if (nextBtn) {
            if (isLicenseActive) {
              nextBtn.disabled = false;
              nextBtn.style.opacity = '1';
              nextBtn.style.cursor = 'pointer';
            } else {
              nextBtn.disabled = true;
              nextBtn.style.opacity = '0.5';
              nextBtn.style.cursor = 'not-allowed';
            }
          }
        };
        
        // Check immediately and set up periodic checking
        checkLicenseActivation();
        const licenseCheckInterval = setInterval(checkLicenseActivation, 500);
        
        // Clean up interval when moving to next step
        setTimeout(() => {
          const nextBtn = document.querySelector('.driver-popover-next-btn');
          const originalNext = nextBtn?.onclick;
          if (nextBtn) {
            nextBtn.onclick = function() {
              clearInterval(licenseCheckInterval);
              if (originalNext) originalNext.call(this);
            };
          }
        }, 100);
        
        // Listen for form submissions and DOM changes
        const licenseForm = document.querySelector('form');
        if (licenseForm) {
          licenseForm.addEventListener('submit', () => {
            setTimeout(checkLicenseActivation, 1000);
          });
        }
        
        // Also observe DOM changes for dynamic content
        const observer = new MutationObserver(() => {
          checkLicenseActivation();
        });
        
        const licenseContainer = document.querySelector('[data-tour="license-management-card"]');
        if (licenseContainer) {
          observer.observe(licenseContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
          });
        }
        
        // Clean up observer when moving to next step
        setTimeout(() => {
          const nextBtn = document.querySelector('.driver-popover-next-btn');
          const originalNextWithObserver = nextBtn?.onclick;
          if (nextBtn) {
            nextBtn.onclick = function() {
              clearInterval(licenseCheckInterval);
              observer.disconnect();
              if (originalNextWithObserver) originalNextWithObserver.call(this);
            };
          }
        }, 100);
      }
    },
    {
      element: '[data-tour="settings-tab"]',
      popover: {
        title: 'Settings Configuration',
        description: 'Now let\'s configure your AI settings. Click on "Settings" in the sidebar to access the configuration options.',
        side: 'right',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      },
      onHighlighted: (element) => {
        // Ensure sidebar is expanded
        const sidebar = document.querySelector('.sidebar-container');
        if (sidebar?.classList.contains('w-16')) {
          const expandButton = document.querySelector('button[title="Expand sidebar"]');
          if (expandButton) {
            expandButton.click();
          }
        }
        
        // Require click on settings tab to proceed
        stepValidator.requireClick('[data-tour="settings-tab"]', 500);
      }
    },
    {
      element: '[data-tour="ai-configuration-tab"]',
      popover: {
        title: 'AI Configuration',
        description: 'Click on the "AI Configuration" tab to configure your AI settings and API keys.',
        side: 'bottom',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      },
      onHighlighted: (element) => {
        // Require click on AI Configuration tab to proceed
        stepValidator.requireClick('[data-tour="ai-configuration-tab"]', 500);
      }
    },
    {
      popover: {
        title: 'Choose Your Path',
        description: 'If you have a subscription plan, you can exit the tour here and start using MagicAssistant. If you have a BYOK (Bring Your Own Key) license, continue to configure your API keys.',
        side: 'center',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Continue (BYOK)',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      }
    },
    {
      element: '[data-tour="api-keys-section"]',
      popover: {
        title: 'Configure API Keys',
        description: 'For BYOK licenses, please enter your API keys here. OpenAI and Anthropic keys are required. DataForSEO credentials are optional but recommended for SEO features.',
        side: 'right',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      }
    },
    {
      element: '[data-tour="mcp-tools-section"]',
      popover: {
        title: 'MCP Tools',
        description: 'Here you can enable additional MCP (Model Context Protocol) tools to extend your AI assistant\'s capabilities. These tools provide specialized functionality for various tasks.',
        side: 'left',
        align: 'center',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      }
    },
    {
      element: '[data-tour="chat-tab"]',
      popover: {
        title: 'Start Using Your AI Assistant',
        description: 'Now you\'re ready to start using your AI assistant! Click on "AI Assistant" in the sidebar to begin chatting and get help with your WordPress tasks.',
        side: 'right',
        align: 'start',
        showProgress: true,
        nextBtnText: 'Next',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous', 'close']
      },
      onHighlighted: (element) => {
        // Require click on chat tab to proceed
        stepValidator.requireClick('[data-tour="chat-tab"]', 500);
      }
    },
    {
      popover: {
        title: 'Congratulations! 🎉',
        description: 'You\'ve successfully set up MagicAssistant! Your AI-powered WordPress assistant is now ready to help you with content creation, SEO optimization, and much more. Enjoy exploring all the features!',
        side: 'center',
        align: 'center',
        showProgress: true,
        doneBtnText: 'Finish',
        prevBtnText: 'Previous',
        showButtons: ['next', 'previous']
      }
    }
  ],
  
  config: {
    animate: true,
    smoothScroll: true,
    allowClose: true,
    allowKeyboardControl: true, // Enable keyboard navigation by default
    overlayOpacity: 0.8,
    stagePadding: 8,
    stageRadius: 8,
    showProgress: true,
    nextBtnText: 'Next →',
    prevBtnText: '← Previous',
    doneBtnText: 'Finish',
    popoverClass: 'magicassistant-tour-popover',
    overlayColor: 'rgba(0, 0, 0, 0.4)',
    popoverOffset: 20,
    
    // Confirm before exiting tour  
    onDestroyStarted: null, // Will be set in startLicenseTour function
    
    // Ensure proper positioning accounting for WordPress admin bar
    onBeforeHighlight: (element, step, { config, state }) => {
      // Scroll adjustment for WordPress admin bar
      const adminBar = document.querySelector('#wpadminbar');
      const adminBarHeight = adminBar ? adminBar.offsetHeight : 0;
      
      if (element && adminBarHeight > 0) {
        const elementRect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = elementRect.top + scrollTop - adminBarHeight - 20;
        
        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: 'smooth'
        });
      }
    },
    
    // Global hooks
    onDestroyed: () => {
      // Clean up step validator
      stepValidator.reset();
      
      // Clean up keyboard navigation handler
      if (window.tourKeyboardHandler) {
        document.removeEventListener('keydown', window.tourKeyboardHandler, true);
        window.tourKeyboardHandler = null;
      }
      
      // Clean up mutation observer
      if (window.tourButtonObserver) {
        window.tourButtonObserver.disconnect();
        window.tourButtonObserver = null;
      }
      
      // Clean up any remaining event handlers
      if (window.tourCurrentElement && window.tourCurrentElement._tourHandlers) {
        TourHelpers.cleanupEventHandlers(window.tourCurrentElement);
        window.tourCurrentElement = null;
      }
      
      // Mark tour as completed
      const tourCompleted = new CustomEvent('tourCompleted', {
        detail: { tourType: 'license' }
      });
      window.dispatchEvent(tourCompleted);
    },
    
    onHighlighted: (element, step, { config, state }) => {
      // Clean up previous step's validation
      stepValidator.reset();
      
      // Clean up previous step's event handlers
      if (window.tourCurrentElement && window.tourCurrentElement._tourHandlers) {
        TourHelpers.cleanupEventHandlers(window.tourCurrentElement);
      }
      
      // Store current element for cleanup
      window.tourCurrentElement = element;
      
      // Update progress tracking
      const progressEvent = new CustomEvent('tourProgress', {
        detail: { 
          currentStep: state.activeIndex + 1, 
          totalSteps: config.steps.length,
          tourType: 'license'
        }
      });
      window.dispatchEvent(progressEvent);
      
      // Dynamic keyboard navigation control based on next button state
      const manageKeyboardNavigation = () => {
        const nextBtn = document.querySelector('.driver-popover-next-btn');
        
        if (nextBtn) {
          // Store original keyboard handler if not already stored
          if (!window.tourKeyboardHandler) {
            window.tourKeyboardHandler = (e) => {
              // Block right arrow and Enter when next button is disabled
              if ((e.key === 'ArrowRight' || e.key === 'Enter') && nextBtn.disabled) {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }
              // Block left arrow when previous button is disabled
              if (e.key === 'ArrowLeft') {
                const prevBtn = document.querySelector('.driver-popover-prev-btn');
                if (prevBtn && prevBtn.disabled) {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }
              }
            };
            
            // Add keyboard event listener
            document.addEventListener('keydown', window.tourKeyboardHandler, true);
          }
        }
      };
      
      // Set up keyboard navigation management
      manageKeyboardNavigation();
      
      // Monitor next button state changes
      const nextBtn = document.querySelector('.driver-popover-next-btn');
      if (nextBtn) {
        // Clean up previous observer if exists
        if (window.tourButtonObserver) {
          window.tourButtonObserver.disconnect();
        }
        
        const observer = new MutationObserver(manageKeyboardNavigation);
        observer.observe(nextBtn, {
          attributes: true,
          attributeFilter: ['disabled']
        });
        
        // Store observer for cleanup
        window.tourButtonObserver = observer;
      }
      
      // Ensure proper positioning by adjusting popover after highlight
      if (element) {
        setTimeout(() => {
          const popover = document.querySelector('.driver-popover');
          if (popover) {
            // Add some breathing room between popover and highlighted element
            const rect = element.getBoundingClientRect();
            const popoverRect = popover.getBoundingClientRect();
            const minDistance = 20;
            
            // Adjust positioning if too close
            if (Math.abs(rect.bottom - popoverRect.top) < minDistance) {
              popover.style.top = `${rect.bottom + minDistance}px`;
            }
            if (Math.abs(rect.top - popoverRect.bottom) < minDistance) {
              popover.style.top = `${rect.top - popoverRect.height - minDistance}px`;
            }
            if (Math.abs(rect.right - popoverRect.left) < minDistance) {
              popover.style.left = `${rect.right + minDistance}px`;
            }
            if (Math.abs(rect.left - popoverRect.right) < minDistance) {
              popover.style.left = `${rect.left - popoverRect.width - minDistance}px`;
            }
          }
        }, 50);
      }
    }
  }
};

/**
 * Initialize and start the license tour
 * @param {Object} options - Tour options
 * @param {boolean} options.startImmediately - Whether to start the tour immediately
 * @param {Function} options.onComplete - Callback when tour is completed
 * @param {Function} options.onSkip - Callback when tour is skipped
 */
export const startLicenseTour = (options = {}) => {
  const { startImmediately = true, onComplete, onSkip } = options;
  
  // Create driver instance
  const driverObj = driver({
    ...licenseTour.config,
    steps: licenseTour.steps,
    
    // Confirm before exiting tour (except on last step)
    onDestroyStarted: () => {
      const currentStep = driverObj.getActiveIndex();
      const totalSteps = licenseTour.steps.length;
      
      // Skip confirmation on the last step
      if (currentStep === totalSteps - 1) {
        driverObj.destroy();
        return;
      }
      
      if (confirm('Are you sure you want to exit the tour?')) {
        driverObj.destroy();
      }
    },
    
    // Override onDestroyed to handle completion
    onDestroyed: (element, step, { config, state }) => {
      // Call original onDestroyed
      licenseTour.config.onDestroyed?.(element, step, { config, state });
      
      // Check if tour was completed or skipped
      const isCompleted = state.activeIndex === config.steps.length - 1;
      
      if (isCompleted && onComplete) {
        onComplete();
      } else if (!isCompleted && onSkip) {
        onSkip();
      }
    }
  });
  
  if (startImmediately) {
    // Mark tour as triggered via server-side tracking
    markTourTriggered();
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      driverObj.drive();
    }, 100);
  }
  
  return driverObj;
};

/**
 * Check if user has completed the license tour
 * @returns {boolean} - True if tour has been completed
 */
export const hasCompletedLicenseTour = () => {
  // Check WordPress user meta - this is the primary source of truth
  const wpUserMeta = window.matAdminData?.tourCompleted?.license;
  
  // Fallback to localStorage for backward compatibility during migration
  const localStorageCompleted = localStorage.getItem('magicassistant_license_tour_completed') === 'true';
  
  const result = Boolean(wpUserMeta) || localStorageCompleted;

  return result;
};

/**
 * Mark the license tour as completed
 */
export const markLicenseTourCompleted = () => {
  // Save to WordPress user meta via AJAX (primary method)
  if (window.matAdminData?.ajaxurl) {
    const formData = new FormData();
    formData.append('action', 'mat_mark_tour_completed');
    formData.append('tour_type', 'license');
    formData.append('_ajax_nonce', window.matAdminData.nonces?.mat_ajax || '');
    
    fetch(window.matAdminData.ajaxurl, {
      method: 'POST',
      body: formData
    }).then(response => response.json()).then(data => {
      if (data.success) {
        // Update local admin data to reflect the change
        if (window.matAdminData?.tourCompleted) {
          window.matAdminData.tourCompleted.license = true;
        }
      }
    }).catch(error => {
      // Fallback to localStorage as backup
      localStorage.setItem('magicassistant_license_tour_completed', 'true');
    });
  } else {
    // Fallback to localStorage if AJAX is not available
    localStorage.setItem('magicassistant_license_tour_completed', 'true');
  }
};

/**
 * Reset the license tour
 */
export const resetLicenseTour = () => {
  // Remove from WordPress user meta (primary method)
  if (window.matAdminData?.ajaxurl) {
    const formData = new FormData();
    formData.append('action', 'mat_reset_tour');
    formData.append('tour_type', 'license');
    formData.append('_ajax_nonce', window.matAdminData.nonces?.mat_ajax || '');
    
    return fetch(window.matAdminData.ajaxurl, {
      method: 'POST',
      body: formData
    }).then(response => response.json()).then(data => {
      if (data.success) {
        // Update local admin data to reflect the change
        if (window.matAdminData?.tourCompleted) {
          window.matAdminData.tourCompleted.license = false;
        }
        return true;
      }
      throw new Error('Failed to reset tour');
    }).catch(error => {
      // Fallback to localStorage cleanup
      localStorage.removeItem('magicassistant_license_tour_completed');
      throw error;
    });
  } else {
    // Fallback to localStorage cleanup
    localStorage.removeItem('magicassistant_license_tour_completed');
    return Promise.resolve(true);
  }
};

/**
 * Check if conditions are met to show the license tour
 * @param {Object} licenseData - Current license data
 * @returns {boolean} - True if tour should be shown
 */
export const shouldShowLicenseTour = (licenseData) => {
  const checks = {
    hasLicenseData: !!licenseData,
    hasCompleted: hasCompletedLicenseTour(),
    isLicenseActive: licenseData?.is_active,
    isPermanentlyDismissed: hasDismissedTourPermanently(),
    isGloballyDisabled: areToursGloballyDisabled()
  };
  
  // Don't show if no license data available
  if (!licenseData) {
    return false;
  }
  
  // Don't show if already completed
  if (hasCompletedLicenseTour()) {
    return false;
  }
  
  // Don't show if license is already active
  if (licenseData?.is_active) {
    return false;
  }
  
  // Don't show if permanently dismissed
  if (hasDismissedTourPermanently()) {
    return false;
  }
  
  // Don't show if tours are globally disabled
  if (areToursGloballyDisabled()) {
    return false;
  }
  
  // Show if license is not active and tour hasn't been completed
  console.log('Tour should be shown: All conditions met');
  return true;
};

/**
 * Mark that the tour has been triggered (for tracking purposes)
 */
export const markTourTriggered = () => {
  if (window.matAdminData?.ajaxurl) {
    const formData = new FormData();
    formData.append('action', 'mat_mark_tour_triggered');
    formData.append('tour_type', 'license');
    formData.append('_ajax_nonce', window.matAdminData.nonces?.mat_ajax || '');
    
    fetch(window.matAdminData.ajaxurl, {
      method: 'POST',
      body: formData
    }).catch(error => {
      // Silently fail if tracking unavailable
    });
  }
};

/**
 * Check if user has dismissed tours permanently
 * @returns {boolean} - True if permanently dismissed
 */
export const hasDismissedTourPermanently = () => {
  return Boolean(window.matAdminData?.tourDismissed?.permanently);
};

/**
 * Check if tours are globally disabled by admin
 * @returns {boolean} - True if globally disabled
 */
export const areToursGloballyDisabled = () => {
  return Boolean(window.matAdminData?.toursGloballyDisabled);
};

/**
 * Dismiss tours permanently for current user
 */
export const dismissToursPermanently = () => {
  if (window.matAdminData?.ajaxurl) {
    const formData = new FormData();
    formData.append('action', 'mat_dismiss_tour_permanently');
    formData.append('_ajax_nonce', window.matAdminData.nonces?.mat_ajax || '');
    
    return fetch(window.matAdminData.ajaxurl, {
      method: 'POST',
      body: formData
    }).then(response => response.json()).then(data => {
      if (data.success) {
        // Update local admin data to reflect the change
        if (window.matAdminData?.tourDismissed) {
          window.matAdminData.tourDismissed.permanently = true;
        }
        return true;
      }
      throw new Error('Failed to dismiss tours');
    }).catch(error => {
      throw error;
    });
  } else {
    return Promise.reject(new Error('AJAX not available'));
  }
};



export default {
  startLicenseTour,
  hasCompletedLicenseTour,
  markLicenseTourCompleted,
  resetLicenseTour,
  shouldShowLicenseTour,
  markTourTriggered,
  hasDismissedTourPermanently,
  areToursGloballyDisabled,
  dismissToursPermanently
};