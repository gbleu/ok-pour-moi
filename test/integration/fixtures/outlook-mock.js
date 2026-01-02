/**
 * Outlook Mock - Simulates Outlook Web interactions for testing
 * This script handles context menus, downloads, and UI interactions
 */

(function() {
  const contextMenu = document.getElementById('context-menu');
  let currentAttachment = null;
  let downloadTriggered = false;

  // Track selected email
  document.querySelectorAll('.email-item, [data-convid]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.email-item, [data-convid]').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');

      // Show the corresponding messages in reading pane
      const convId = item.getAttribute('data-convid');
      if (convId && window.showConversation) {
        window.showConversation(convId);
      }
    });
  });

  // Track folder selection
  document.querySelectorAll('[role="treeitem"]').forEach(folder => {
    folder.addEventListener('click', () => {
      document.querySelectorAll('[role="treeitem"]').forEach(f => f.classList.remove('selected'));
      folder.classList.add('selected');

      // Trigger folder change event
      const folderName = folder.textContent.trim();
      if (window.onFolderChange) {
        window.onFolderChange(folderName);
      }
    });
  });

  // Handle right-click on attachments
  document.addEventListener('contextmenu', (e) => {
    const attachment = e.target.closest('[role="option"]');
    if (attachment) {
      e.preventDefault();
      currentAttachment = attachment;
      contextMenu.style.left = e.pageX + 'px';
      contextMenu.style.top = e.pageY + 'px';
      contextMenu.classList.add('visible');
    }
  });

  // Hide context menu on click outside
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.classList.remove('visible');
      currentAttachment = null;
    }
  });

  // Handle download menu item click
  contextMenu.querySelector('[role="menuitem"]:nth-child(2)').addEventListener('click', () => {
    if (currentAttachment) {
      downloadTriggered = true;
      const rawFileName = currentAttachment.textContent.trim().match(/^(.+\.pdf)/i)?.[1] || 'attachment.pdf';
      // Sanitize fileName to prevent path traversal and URL injection
      const fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Dispatch a custom download event that Playwright can intercept
      const downloadEvent = new CustomEvent('mock-download', {
        detail: { fileName, attachment: currentAttachment }
      });
      document.dispatchEvent(downloadEvent);

      // Create a fake download link that Playwright can intercept
      const link = document.createElement('a');
      link.href = '/mock-downloads/' + fileName;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    contextMenu.classList.remove('visible');
    currentAttachment = null;
  });

  // Handle "See more messages" button
  document.querySelectorAll('button[name="See more messages"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Reveal hidden messages
      const hiddenMessages = document.querySelectorAll('.message.hidden');
      hiddenMessages.forEach(msg => msg.classList.remove('hidden'));
      btn.style.display = 'none';
    });
  });

  // Handle message row/button clicks to expand collapsed messages
  document.addEventListener('click', (e) => {
    const fromButton = e.target.closest('button[name^="From:"]');
    if (fromButton) {
      const message = fromButton.closest('.message');
      if (message && message.classList.contains('collapsed')) {
        message.classList.remove('collapsed');
      }
    }

    // Handle row clicks
    const row = e.target.closest('[tabindex]');
    if (row && row.closest('.message')) {
      const message = row.closest('.message');
      if (message.classList.contains('collapsed')) {
        message.classList.remove('collapsed');
      }
    }
  });

  // Handle Reply button
  document.addEventListener('click', (e) => {
    if (e.target.closest('button[name="Reply"]')) {
      const composeArea = document.getElementById('compose-area');
      if (composeArea) {
        composeArea.classList.add('visible');
      }
    }
  });

  // Handle Attach file button
  document.addEventListener('click', (e) => {
    if (e.target.closest('button[name="Attach file"]')) {
      // This will be handled by Playwright's filechooser event
    }
  });

  // Handle Move to button
  document.addEventListener('click', (e) => {
    if (e.target.closest('button[name="Move to"]')) {
      const moveMenu = document.createElement('div');
      moveMenu.className = 'context-menu visible';
      moveMenu.setAttribute('role', 'menu');
      moveMenu.style.left = e.pageX + 'px';
      moveMenu.style.top = e.pageY + 'px';
      moveMenu.innerHTML = '<div role="menuitem">Inbox</div><div role="menuitem">Archive</div>';
      document.body.appendChild(moveMenu);

      moveMenu.addEventListener('click', (me) => {
        if (me.target.getAttribute('role') === 'menuitem') {
          // Remove the email from list
          const selected = document.querySelector('[data-convid].selected');
          if (selected) {
            selected.remove();
          }
          moveMenu.remove();
        }
      });

      // Close on click outside
      setTimeout(() => {
        document.addEventListener('click', function closeMenu(ce) {
          if (!moveMenu.contains(ce.target)) {
            moveMenu.remove();
            document.removeEventListener('click', closeMenu);
          }
        });
      }, 0);
    }
  });

  // Handle tab switching
  document.querySelectorAll('[role="tab"]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');

      // Show/hide CC checkbox based on Options tab
      if (tab.getAttribute('name') === 'Options') {
        document.querySelector('[aria-label="Show Cc"]').style.display = 'block';
      }
      if (tab.getAttribute('name') === 'Message') {
        const ccField = document.querySelector('[aria-label="Cc"]');
        if (ccField && document.querySelector('[aria-label="Show Cc"]').checked) {
          ccField.style.display = 'block';
        }
      }
    });
  });

  // Handle Show Cc checkbox
  const showCcCheckbox = document.querySelector('[aria-label="Show Cc"]');
  if (showCcCheckbox) {
    showCcCheckbox.addEventListener('change', () => {
      const ccField = document.querySelector('[aria-label="Cc"]');
      if (ccField) {
        ccField.style.display = showCcCheckbox.checked ? 'block' : 'none';
      }
    });
  }

  // Expose utility for tests
  window.OutlookMock = {
    wasDownloadTriggered: () => downloadTriggered,
    resetDownloadFlag: () => { downloadTriggered = false; },
    getCurrentAttachment: () => currentAttachment,
  };
})();
