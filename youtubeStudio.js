import { BUTTON_STYLES, createButton, createDropdown, triggerInputEvents } from './utils.js';

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
  chrome.runtime.onMessage.addListener(messageListener);

  container.querySelector('button').addEventListener('click', () => {
    const videoTitle = getVideoTitle();
    const commentText = getCommentText(commentElement);

    if (videoTitle && commentText) {
      dropdown.style.display = 'block';
      dropdown.textContent = 'Loading suggestion...';

      chrome.runtime.sendMessage({
        action: 'fetchReply',
        title: videoTitle,
        parentComment: commentText
      });
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

      // Try to find the reply input within this specific comment's context
      const textareaSelectors = [
        'tp-yt-iron-autogrow-textarea',
        'textarea.ytcp-commentbox',
        'textarea#textarea',
        '[slot="body"]',
        'paper-input-input'
      ];

      let replyInput = null;

      // First try to find the input within this specific comment's context
      const commentThread = commentElement.closest('ytcp-comment-thread') || 
                          commentElement.closest('ytcp-comment-thread-renderer');
      
      if (commentThread) {
        // Try each selector within this comment's thread
        for (const selector of textareaSelectors) {
          const elements = commentThread.querySelectorAll(selector);
          replyInput = Array.from(elements).find(el => {
            const isVisible = el.offsetParent !== null;
            const isEditable = !el.disabled && !el.readOnly;
            // Check if this input appeared after clicking reply (it's new)
            const isNew = el.getBoundingClientRect().height > 0;
            return isVisible && isEditable && isNew;
          });
          if (replyInput) break;
        }

        // If still not found, try searching in shadow roots within this comment thread
        if (!replyInput) {
          const shadowElements = commentThread.querySelectorAll('*');
          for (const el of shadowElements) {
            if (el.shadowRoot) {
              for (const selector of textareaSelectors) {
                const shadowInput = el.shadowRoot.querySelector(selector);
                if (shadowInput && shadowInput.offsetParent !== null) {
                  // Verify this is a newly appeared input
                  const isNew = shadowInput.getBoundingClientRect().height > 0;
                  if (isNew) {
                    replyInput = shadowInput;
                    break;
                  }
                }
              }
            }
            if (replyInput) break;
          }
        }
      }

      if (replyInput) {
        try {
          // Set the value in multiple ways to ensure it works
          replyInput.value = comment;
          replyInput.textContent = comment;
          replyInput.innerText = comment;
          
          // If it's an iron-autogrow-textarea, try to set its internal value
          if (replyInput.tagName.toLowerCase() === 'tp-yt-iron-autogrow-textarea') {
            const innerTextarea = replyInput.querySelector('textarea') || 
                                replyInput.shadowRoot?.querySelector('textarea');
            if (innerTextarea) {
              innerTextarea.value = comment;
              innerTextarea.textContent = comment;
              triggerInputEvents(innerTextarea);
            }
          }

          // Trigger input events
          triggerInputEvents(replyInput);

          // Focus the input
          replyInput.focus();
          
          // Additional event dispatch for YouTube Studio components
          replyInput.dispatchEvent(new CustomEvent('bind-value-changed', { 
            detail: { value: comment }, 
            bubbles: true, 
            composed: true 
          }));
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