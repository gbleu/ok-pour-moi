/**
 * Outlook Web Mock - Simulates Outlook behavior for testing
 */

(function() {
  const contextMenu = document.getElementById('contextMenu');
  let currentAttachment = null;

  // Hide context menu when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.classList.remove('visible');
    }
  });

  // Close context menu on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      contextMenu.classList.remove('visible');
    }
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

  // Handle download menu item click
  const downloadMenuItem = contextMenu.querySelector('[aria-label="Download"]');
  if (downloadMenuItem) {
    downloadMenuItem.addEventListener('click', () => {
      if (currentAttachment) {
        const filename = currentAttachment.textContent.trim().match(/^(.+\.pdf)/i)?.[1] || 'attachment.pdf';
        // Trigger download event - the test will intercept this via route
        const link = document.createElement('a');
        link.href = `/download/${filename}`;
        link.download = filename;
        link.click();
        contextMenu.classList.remove('visible');
      }
    });
  }

  // Handle email item clicks - expand reading pane
  document.addEventListener('click', (e) => {
    const emailItem = e.target.closest('[data-convid]');
    if (emailItem) {
      // Remove selected class from all items
      document.querySelectorAll('[data-convid]').forEach(el => {
        el.classList.remove('selected');
      });
      // Add selected class to clicked item
      emailItem.classList.add('selected');
    }
  });

  // Handle folder clicks
  document.addEventListener('click', (e) => {
    const folderItem = e.target.closest('[role="treeitem"]');
    if (folderItem) {
      document.querySelectorAll('[role="treeitem"]').forEach(el => {
        el.classList.remove('selected');
      });
      folderItem.classList.add('selected');
    }
  });

  // Handle message row expansion
  document.addEventListener('click', (e) => {
    const clickableRow = e.target.closest('.clickable-row');
    if (clickableRow) {
      clickableRow.classList.toggle('expanded');
    }
  });

  // Expose helper functions for test setup
  window.OutlookMock = {
    /**
     * Load a scenario into the email list and reading pane
     * @param {string} scenario - Scenario name to load
     */
    loadScenario: async function(scenario) {
      try {
        const response = await fetch(`scenarios/${scenario}.html`);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const emailListContent = doc.getElementById('emailListContent');
        const readingPaneContent = doc.getElementById('readingPaneContent');

        if (emailListContent) {
          document.getElementById('emailList').innerHTML = emailListContent.innerHTML;
        }
        if (readingPaneContent) {
          document.getElementById('readingPane').innerHTML = readingPaneContent.innerHTML;
        }
      } catch (error) {
        console.error('Failed to load scenario:', error);
      }
    },

    /**
     * Simulate a download trigger for testing
     * @param {string} filename - Name of the file to download
     */
    triggerDownload: function(filename) {
      const link = document.createElement('a');
      link.href = `/download/${filename}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
})();
