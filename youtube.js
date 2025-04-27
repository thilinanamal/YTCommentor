import { BUTTON_STYLES, createButton, createDropdown, triggerInputEvents } from './utils.js';

export function getVideoTitle() {
  return document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
}

export function getCommentText(commentElement) {
  return commentElement.querySelector('#content-text')?.textContent;
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
  // Skip if button already exists or if the element doesn't exist
  if (!commentElement || commentElement.hasAttribute('reply-button-added')) {
    return;
  }

  // Skip if this is not a comment thread
  if (!commentElement.tagName || !commentElement.tagName.toLowerCase().includes('comment')) {
    return;
  }

  // Try multiple selectors for action buttons
  const actionButtons = commentElement.querySelector('#action-buttons') ||
                       commentElement.querySelector('ytd-comment-action-buttons-renderer');
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
  
  // Mark this comment as processed
  commentElement.setAttribute('reply-button-added', 'true');
}

function setupMessageListener(container, dropdown) {
  const messageListener = (message) => {
    if (message.action === 'commentGenerated') {
      handleCommentGenerated(message, dropdown, '#simplebox-placeholder', '#contenteditable-root');
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
      }, 100);
    }
    dropdown.style.display = 'none';
  });
  
  dropdown.appendChild(useButton);
}

function addUseButton(dropdown, comment, commentElement) {
  const useButton = createButton('Use this reply', BUTTON_STYLES.secondary);
  
  useButton.addEventListener('click', () => {
    const replyButton = commentElement.querySelector('#reply-button-end');
    if (replyButton) {
      replyButton.click();

      setTimeout(() => {
        const replyBox = commentElement.querySelector('#contenteditable-root');
        if (replyBox) {
          replyBox.textContent = comment;
          replyBox.innerText = comment;
          triggerInputEvents(replyBox);
          replyBox.focus();
        }
      }, 100);
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