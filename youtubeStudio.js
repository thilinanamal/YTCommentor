import { BUTTON_STYLES, createButton, createDropdown, triggerInputEvents } from './utils.js';

function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime, which throws if context is invalid
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

export function getVideoTitle() {
  // Try to get title from entity-name first (most reliable)
  const entityTitle = document.querySelector('#entity-name')?.textContent?.trim();
  console.log('Entity title found:', entityTitle);
  
  // Fallback to other selectors if entity-name is not found
  const breadcrumbTitle = document.querySelector('ytcp-breadcrumb .ytcp-text')?.textContent;
  const headerTitle = document.querySelector('ytcp-text-input[label="Title"] #textbox')?.textContent;
  const infoTitle = document.querySelector('.ytcp-video-info-title')?.textContent;
  const commentTitle = document.querySelector('[id^="video-title"]')?.textContent;
  
  // Log all attempts
  console.log('Title detection attempts:', {
    entityTitle,
    breadcrumbTitle,
    headerTitle,
    infoTitle,
    commentTitle
  });
  
  // Use the first available title
  const studioTitle = entityTitle || breadcrumbTitle || headerTitle || infoTitle || commentTitle || getVideoTitleFromStudioURL();
  console.log('Final selected title:', studioTitle);
  return studioTitle?.trim();
}

function getVideoTitleFromStudioURL() {
  const match = window.location.pathname.match(/\/video\/([^/]+)/);
  if (!match) return null;
  
  const videoId = match[1];
  // Try multiple selectors that might contain the title
  const possibleTitleElements = [
    ...document.querySelectorAll(`[id*="${videoId}"]`),
    ...document.querySelectorAll('.ytcp-video-row'),
    ...document.querySelectorAll('[id^="video-title"]'),
    ...document.querySelectorAll('.style-scope ytcp-video-info')
  ];

  const titleElement = possibleTitleElements.find(el => 
    el?.textContent?.trim().length > 5 && 
    !el.textContent.includes('http') &&
    !el.textContent.includes('www.')
  );
  
  return titleElement?.textContent?.trim();
}

export function getCommentText(commentElement) {
  // Try different selectors for finding comment text
  return (
    commentElement.querySelector('#content-text')?.textContent ||
    commentElement.querySelector('[class*="comment-text"]')?.textContent ||
    commentElement.querySelector('.style-scope.ytcp-comment-content')?.textContent ||
    commentElement.querySelector('[id*="comment-content"]')?.textContent ||
    ''
  )?.trim();
}

export function initializeSuggestionButton(commentField) {
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'position: relative; display: inline-block;';
  
  const suggestButton = createButton('💭 Suggest Comment', BUTTON_STYLES.primary);
  const dropdownContent = createDropdown();

  buttonContainer.appendChild(suggestButton);
  buttonContainer.appendChild(dropdownContent);
  commentField.parentElement.insertBefore(buttonContainer, commentField.nextSibling);

  suggestButton.addEventListener('click', () => {
    const videoTitle = getVideoTitle();
    if (videoTitle) {
      dropdownContent.style.display = 'block';
      dropdownContent.textContent = 'Loading suggestion...';

      chrome.runtime.sendMessage({ 
        action: 'fetchComment', 
        title: videoTitle 
      });
    } else {
      dropdownContent.textContent = 'Could not find video title. Please try again.';
    }
  });

  setupMessageListener(buttonContainer, dropdownContent);
}

export function addReplyButtonToComment(commentElement) {
  if (commentElement.querySelector('.suggest-reply-button')) return;

  // Try different selectors for finding the action buttons container
  const actionButtons = findActionButtonsContainer(commentElement);
  if (!actionButtons) return;

  const replyButtonContainer = document.createElement('div');
  replyButtonContainer.style.cssText = 'position: relative; display: inline-block; margin-left: 8px;';
  replyButtonContainer.classList.add('suggest-reply-button');

  const suggestReplyButton = createButton('💭 Suggest Reply', BUTTON_STYLES.primary);
  const dropdownContent = createDropdown();
  dropdownContent.style.left = '0';

  replyButtonContainer.appendChild(suggestReplyButton);
  replyButtonContainer.appendChild(dropdownContent);
  actionButtons.appendChild(replyButtonContainer);

  setupReplyMessageListener(replyButtonContainer, dropdownContent, commentElement);
}

function findActionButtonsContainer(commentElement) {
  // Try all possible selectors for the actions container
  return (
    commentElement.querySelector('ytcp-comment-action-buttons') ||
    commentElement.querySelector('[id="action-buttons"]') ||
    commentElement.querySelector('.comment-actions') ||
    commentElement.querySelector('[class*="comment-actions"]') ||
    commentElement.querySelector('.style-scope.ytcp-comment-base.comment-actions') ||
    // If no direct match, try to find a suitable container near reply button
    findContainerNearReplyButton(commentElement)
  );
}

function findContainerNearReplyButton(commentElement) {
  // Find the reply button first
  const replyButton = commentElement.querySelector('[class*="reply-button"]') ||
                     commentElement.querySelector('ytcp-button[id="reply-button"]') ||
                     commentElement.querySelector('ytcp-comment-reply-button');
                     
  if (replyButton) {
    // Get the parent container that holds the reply button
    return replyButton.parentElement;
  }
  return null;
}

function setupMessageListener(container, dropdown) {
  const messageListener = (message) => {
    if (message.action === 'commentGenerated') {
      handleCommentGenerated(message, dropdown, '[class*="comment-text-input"]', '.ytcp-comment-text-input');
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);
  setupClickOutside(container, dropdown);
}

function setupReplyMessageListener(container, dropdown, commentElement) {
  const messageListener = (message) => {
    if (message.action === 'commentGenerated') {
      if (!message.comment) {
        dropdown.textContent = 'Error getting suggestion. Please try again.';
        return;
      }

      dropdown.textContent = message.comment;
      addUseButton(dropdown, message.comment, commentElement);
    }
  };

  container.messageListener = messageListener;
  
  try {
    if (isExtensionContextValid()) {
      chrome.runtime.onMessage.addListener(messageListener);
    }
  } catch (error) {
    console.error('Failed to set up message listener:', error);
    dropdown.textContent = 'Extension context error. Please refresh the page.';
  }

  container.querySelector('button').addEventListener('click', () => {
    const videoTitle = getVideoTitle();
    const commentText = getCommentText(commentElement);

    if (videoTitle && commentText) {
      dropdown.style.display = 'block';
      dropdown.textContent = 'Loading suggestion...';

      try {
        if (isExtensionContextValid()) {
          chrome.runtime.sendMessage({
            action: 'fetchReply',
            title: videoTitle,
            parentComment: commentText
          });
        } else {
          dropdown.textContent = 'Extension context error. Please refresh the page.';
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        dropdown.textContent = 'Failed to get suggestion. Please refresh the page.';
      }
    }
  });

  setupClickOutside(container, dropdown);
}

function handleCommentGenerated(message, dropdown, inputSelector, editableSelector) {
  if (!message.comment) {
    dropdown.textContent = 'Error getting suggestion. Please try again.';
    return;
  }
  
  dropdown.textContent = message.comment;
  
  const useButton = createButton('Use this comment', BUTTON_STYLES.secondary);
  useButton.addEventListener('click', () => {
    const commentBox = document.querySelector(inputSelector);
    if (commentBox) {
      commentBox.click();
      
      setTimeout(() => {
        const editableBox = document.querySelector(editableSelector);
        if (editableBox) {
          editableBox.textContent = message.comment;
          editableBox.innerText = message.comment;
          triggerInputEvents(editableBox);
          editableBox.focus();
        }
      }, 200); // Longer delay for YouTube Studio
    }
    dropdown.style.display = 'none';
  });
  
  dropdown.appendChild(useButton);
}

function addUseButton(dropdown, comment, commentElement) {
  const useButton = createButton('Use this reply', BUTTON_STYLES.secondary);
  
  useButton.addEventListener('click', async () => {
    // Find the reply button within this specific comment
    const replyButton = commentElement.querySelector('[class*="reply-button"]') ||
                       commentElement.querySelector('.ytcp-comment-reply-button');
    if (replyButton) {
      replyButton.click();

      // Wait for the reply box to appear and be editable
      await new Promise(resolve => setTimeout(resolve, 1000));

      // First try to find the iron-autogrow-textarea component
      const ironTextarea = commentElement.querySelector('tp-yt-iron-autogrow-textarea') || 
                          document.querySelector('tp-yt-iron-autogrow-textarea');

      if (ironTextarea) {
        try {
          // Get the actual textarea from shadow root or as a child
          let actualTextarea = ironTextarea.shadowRoot?.querySelector('textarea') || 
                             ironTextarea.querySelector('textarea');

          // If we didn't find it in the immediate shadow root, look deeper
          if (!actualTextarea) {
            ironTextarea.childNodes.forEach(node => {
              if (node.shadowRoot) {
                const textarea = node.shadowRoot.querySelector('textarea');
                if (textarea) actualTextarea = textarea;
              }
            });
          }

          if (actualTextarea) {
            // First focus and click to ensure the textarea is ready
            actualTextarea.focus();
            actualTextarea.click();

            // Simulate real typing
            actualTextarea.value = comment;
            actualTextarea.textContent = comment;

            // Create and dispatch necessary events
            actualTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            actualTextarea.dispatchEvent(new Event('change', { bubbles: true }));

            // Also update the iron-textarea's bind-value
            ironTextarea.bindValue = comment;
            ironTextarea.dispatchEvent(new CustomEvent('bind-value-changed', {
              detail: { value: comment },
              bubbles: true,
              composed: true
            }));

            // Focus again to ensure cursor is in place
            actualTextarea.focus();
          }
        } catch (error) {
          console.error('Error setting reply text:', error);
        }
      }
    }
    dropdown.style.display = 'none';
  });

  dropdown.appendChild(useButton);
}

function setupClickOutside(container, dropdown) {
  document.addEventListener('click', (event) => {
    if (!container.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });
}