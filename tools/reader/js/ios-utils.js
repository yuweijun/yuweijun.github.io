/**
 * iOS-specific utility functions
 * Handles iOS viewport height fixes and safe area handling
 */

/**
 * Set viewport height CSS variable for iOS devices
 * iOS Safari viewport height changes when address bar appears/disappears
 */
function setViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/**
 * Initialize iOS viewport height handling
 */
function initializeIOSViewport() {
  setViewportHeight();
  window.addEventListener('resize', window.debounce(setViewportHeight, 100));
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
  });
}

// Export to window for global access
window.initializeIOSViewport = initializeIOSViewport;
