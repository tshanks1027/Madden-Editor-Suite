/**
 * Update Notification UI
 *
 * Displays a notification banner when a new version is available
 */

(function() {
  'use strict';

  // Check if electronAPI is available
  if (!window.electronAPI?.update) {
    console.warn('[UpdateNotification] electronAPI.update not available');
    return;
  }

  // Listen for update notifications
  window.electronAPI.update.onUpdateAvailable((updateInfo) => {
    console.log('[UpdateNotification] Update available:', updateInfo);
    showUpdateNotification(updateInfo);
  });

  /**
   * Show update notification banner
   */
  function showUpdateNotification(updateInfo) {
    // Check if notification already exists
    let notification = document.getElementById('update-notification');
    if (notification) {
      // Update existing notification
      updateNotificationContent(notification, updateInfo);
      return;
    }

    // Create notification banner
    notification = document.createElement('div');
    notification.id = 'update-notification';
    notification.className = 'update-notification';
    notification.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideDown 0.3s ease-out;
    `;

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    // Create content
    const content = document.createElement('div');
    content.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 12px;';

    const icon = document.createElement('span');
    icon.textContent = '🎉';
    icon.style.fontSize = '24px';

    const text = document.createElement('div');
    text.innerHTML = `
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">
        New version available: v${updateInfo.latestVersion}
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        You're currently on v${updateInfo.currentVersion}
      </div>
    `;

    content.appendChild(icon);
    content.appendChild(text);

    // Create buttons
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display: flex; gap: 8px;';

    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download';
    downloadButton.style.cssText = `
      background: white;
      color: #667eea;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: transform 0.2s;
    `;
    downloadButton.onmouseover = () => downloadButton.style.transform = 'scale(1.05)';
    downloadButton.onmouseout = () => downloadButton.style.transform = 'scale(1)';
    downloadButton.onclick = () => {
      window.open(updateInfo.downloadUrl, '_blank');
    };

    const dismissButton = document.createElement('button');
    dismissButton.textContent = '×';
    dismissButton.style.cssText = `
      background: rgba(255,255,255,0.2);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      transition: background 0.2s;
    `;
    dismissButton.onmouseover = () => dismissButton.style.background = 'rgba(255,255,255,0.3)';
    dismissButton.onmouseout = () => dismissButton.style.background = 'rgba(255,255,255,0.2)';
    dismissButton.onclick = () => {
      notification.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    };

    const slideUpStyle = document.createElement('style');
    slideUpStyle.textContent = `
      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(slideUpStyle);

    buttons.appendChild(downloadButton);
    buttons.appendChild(dismissButton);

    notification.appendChild(content);
    notification.appendChild(buttons);

    // Add to page
    document.body.appendChild(notification);

    // Adjust main content padding to account for notification
    adjustContentPadding(true);
  }

  /**
   * Update existing notification content
   */
  function updateNotificationContent(notification, updateInfo) {
    const text = notification.querySelector('div > div');
    if (text) {
      text.innerHTML = `
        <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">
          New version available: v${updateInfo.latestVersion}
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          You're currently on v${updateInfo.currentVersion}
        </div>
      `;
    }
  }

  /**
   * Adjust main content padding
   */
  function adjustContentPadding(add) {
    const main = document.querySelector('main') || document.body;
    if (add) {
      main.style.paddingTop = '60px';
    } else {
      main.style.paddingTop = '';
    }
  }

  console.log('[UpdateNotification] Initialized');
})();
