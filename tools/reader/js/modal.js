/**
 * iOS-style Modal Dialog System
 * Replaces native confirm() and alert() with beautiful, modern dialogs
 */

class IOSModal {
  constructor() {
    this.modalContainer = null;
    this.currentResolve = null;
    this.init();
  }

  init() {
    // Create modal container if it doesn't exist
    if (!document.getElementById('ios-modal-container')) {
      this.modalContainer = document.createElement('div');
      this.modalContainer.id = 'ios-modal-container';
      this.modalContainer.className = 'ios-modal-container';
      this.modalContainer.innerHTML = `
        <div class="ios-modal-backdrop"></div>
        <div class="ios-modal-dialog">
          <div class="ios-modal-content">
            <div class="ios-modal-header">
              <h3 class="ios-modal-title"></h3>
              <p class="ios-modal-message"></p>
            </div>
            <div class="ios-modal-actions"></div>
          </div>
        </div>
      `;
      document.body.appendChild(this.modalContainer);

      // Close on backdrop click for alerts
      this.modalContainer.querySelector('.ios-modal-backdrop').addEventListener('click', () => {
        if (this.modalContainer.dataset.type === 'alert') {
          this.close(true);
        }
      });
    } else {
      this.modalContainer = document.getElementById('ios-modal-container');
    }
  }

  /**
   * Show a confirm dialog (replaces window.confirm)
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} options.confirmText - Confirm button text (default: "Confirm")
   * @param {string} options.cancelText - Cancel button text (default: "Cancel")
   * @param {boolean} options.destructive - Whether confirm action is destructive (red)
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  confirm(options = {}) {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      destructive = false
    } = options;

    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.modalContainer.dataset.type = 'confirm';

      const titleEl = this.modalContainer.querySelector('.ios-modal-title');
      const messageEl = this.modalContainer.querySelector('.ios-modal-message');
      const actionsEl = this.modalContainer.querySelector('.ios-modal-actions');

      titleEl.textContent = title;
      messageEl.textContent = message;
      messageEl.style.display = message ? 'block' : 'none';

      actionsEl.innerHTML = `
        <button class="ios-modal-btn ios-modal-btn-cancel">${cancelText}</button>
        <button class="ios-modal-btn ios-modal-btn-confirm ${destructive ? 'ios-modal-btn-destructive' : ''}">${confirmText}</button>
      `;

      // Add event listeners
      actionsEl.querySelector('.ios-modal-btn-cancel').addEventListener('click', () => {
        this.close(false);
      });
      actionsEl.querySelector('.ios-modal-btn-confirm').addEventListener('click', () => {
        this.close(true);
      });

      // Show modal
      this.show();
    });
  }

  /**
   * Show an alert dialog (replaces window.alert)
   * @param {Object} options - Dialog options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message
   * @param {string} options.buttonText - Button text (default: "OK")
   * @returns {Promise<void>} - Resolves when dismissed
   */
  alert(options = {}) {
    const {
      title = 'Alert',
      message = '',
      buttonText = 'OK'
    } = options;

    return new Promise((resolve) => {
      this.currentResolve = resolve;
      this.modalContainer.dataset.type = 'alert';

      const titleEl = this.modalContainer.querySelector('.ios-modal-title');
      const messageEl = this.modalContainer.querySelector('.ios-modal-message');
      const actionsEl = this.modalContainer.querySelector('.ios-modal-actions');

      titleEl.textContent = title;
      messageEl.textContent = message;
      messageEl.style.display = message ? 'block' : 'none';

      actionsEl.innerHTML = `
        <button class="ios-modal-btn ios-modal-btn-primary">${buttonText}</button>
      `;

      // Add event listener
      actionsEl.querySelector('.ios-modal-btn-primary').addEventListener('click', () => {
        this.close(true);
      });

      // Show modal
      this.show();
    });
  }

  /**
   * Show a success message (toast-style but as modal)
   */
  success(message, duration = 1500) {
    return this.toast({ message, type: 'success', duration });
  }

  /**
   * Show an error message
   */
  error(message, duration = 2500) {
    return this.toast({ message, type: 'error', duration });
  }

  /**
   * Show a toast-style notification
   */
  toast(options = {}) {
    const {
      message = '',
      type = 'info',
      duration = 2000
    } = options;

    return new Promise((resolve) => {
      // Create toast element
      let toastContainer = document.getElementById('ios-toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'ios-toast-container';
        toastContainer.className = 'ios-toast-container';
        document.body.appendChild(toastContainer);
      }

      const toast = document.createElement('div');
      toast.className = `ios-toast ios-toast-${type}`;
      
      const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
      toast.innerHTML = `
        <span class="ios-toast-icon">${icon}</span>
        <span class="ios-toast-message">${message}</span>
      `;

      toastContainer.appendChild(toast);

      // Trigger animation
      requestAnimationFrame(() => {
        toast.classList.add('ios-toast-show');
      });

      // Auto dismiss
      setTimeout(() => {
        toast.classList.remove('ios-toast-show');
        toast.classList.add('ios-toast-hide');
        setTimeout(() => {
          toast.remove();
          resolve();
        }, 300);
      }, duration);
    });
  }

  show() {
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Show with animation
    this.modalContainer.classList.add('ios-modal-visible');
    
    // Focus first button for accessibility
    requestAnimationFrame(() => {
      const firstBtn = this.modalContainer.querySelector('.ios-modal-btn');
      if (firstBtn) firstBtn.focus();
    });

    // Add keyboard handler
    this.keyHandler = (e) => {
      if (e.key === 'Escape') {
        this.close(false);
      } else if (e.key === 'Enter') {
        const confirmBtn = this.modalContainer.querySelector('.ios-modal-btn-confirm, .ios-modal-btn-primary');
        if (confirmBtn) confirmBtn.click();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  close(result) {
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Hide with animation
    this.modalContainer.classList.remove('ios-modal-visible');
    this.modalContainer.classList.add('ios-modal-hiding');
    
    setTimeout(() => {
      this.modalContainer.classList.remove('ios-modal-hiding');
    }, 300);

    // Remove keyboard handler
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    // Resolve promise
    if (this.currentResolve) {
      this.currentResolve(result);
      this.currentResolve = null;
    }
  }
}

// Create global instance
window.iosModal = new IOSModal();

// Convenience functions to replace native dialogs
window.showConfirm = (options) => window.iosModal.confirm(options);
window.showAlert = (options) => window.iosModal.alert(options);
window.showSuccess = (message) => window.iosModal.success(message);
window.showError = (message) => window.iosModal.error(message);
