// Wait for the comment section to load and initialize everything
function waitForElements() {
  const observer = new MutationObserver((mutations, obs) => {
    const commentField = document.querySelector('#placeholder-area');
    const commentSection = document.querySelector('ytd-comments');
    
    if (commentField) {
      initializeSuggestionButton();
    }
    
    if (commentSection) {
      // Initialize the reply buttons for existing comments
      const existingComments = commentSection.querySelectorAll('ytd-comment-thread-renderer');
      existingComments.forEach(addReplyButtonToComment);
      
      // Start observing for new comments
      addReplyButtonsToComments();
      
      // If both elements are found, disconnect this observer
      if (commentField && commentSection) {
        obs.disconnect();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function initializeSuggestionButton() {
  const commentField = document.querySelector('#placeholder-area');
  const buttonContainer = document.createElement('div');
  buttonContainer.style.position = 'relative';
  buttonContainer.style.display = 'inline-block';
  
  const suggestButton = document.createElement('button');
  suggestButton.innerHTML = '💭 Suggest Comment';
  suggestButton.style.cssText = `
    background: #065fd4;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 18px;
    cursor: pointer;
    margin: 8px;
    font-size: 14px;
  `;

  const dropdownContent = document.createElement('div');
  dropdownContent.style.cssText = `
    display: none;
    position: absolute;
    background-color: #f9f9f9;
    min-width: 200px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    padding: 12px;
    z-index: 1000;
    border-radius: 8px;
    margin-top: 4px;
  `;

  buttonContainer.appendChild(suggestButton);
  buttonContainer.appendChild(dropdownContent);
  commentField.parentElement.insertBefore(buttonContainer, commentField.nextSibling);

  // Extract the video title and get comment suggestion when button is clicked
  suggestButton.addEventListener('click', () => {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
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

  // Remove existing listener to avoid duplicates
  chrome.runtime.onMessage.removeListener(handleCommentGenerated);

  // Create a named listener function
  function handleCommentGenerated(message, sender, sendResponse) {
    if (message.action === 'commentGenerated') {
      if (!message.comment) {
        dropdownContent.textContent = 'Error getting suggestion. Please try again.';
        return;
      }
      
      dropdownContent.textContent = message.comment;
      
      // Add "Use this comment" button
      const useButton = document.createElement('button');
      useButton.textContent = 'Use this comment';
      useButton.style.cssText = `
        background: #065fd4;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 18px;
        cursor: pointer;
        margin-top: 8px;
        font-size: 12px;
        display: block;
        width: 100%;
      `;
      
      useButton.addEventListener('click', () => {
        // Find the comment input box - using a more specific selector
        const commentBox = document.querySelector('#simplebox-placeholder');
        if (commentBox) {
          // Click the comment box to activate it
          commentBox.click();
          
          // Wait for the editable comment box to appear
          setTimeout(() => {
            const editableBox = document.querySelector('#contenteditable-root');
            if (editableBox) {
              // Set the comment text
              editableBox.textContent = message.comment;
              editableBox.innerText = message.comment;
              
              // Trigger input events to activate the comment submit button
              const inputEvent = new InputEvent('input', { bubbles: true });
              editableBox.dispatchEvent(inputEvent);
              editableBox.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Focus the comment box
              editableBox.focus();
            }
          }, 100); // Small delay to ensure the editable box is ready
        }
        dropdownContent.style.display = 'none';
      });
      
      dropdownContent.appendChild(useButton);
    }
  }

  // Add the listener
  chrome.runtime.onMessage.addListener(handleCommentGenerated);

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!buttonContainer.contains(event.target)) {
      dropdownContent.style.display = 'none';
    }
  });
}

// Update the addReplyButtonsToComments function
function addReplyButtonsToComments() {
  const commentSection = document.querySelector('ytd-comments');
  if (!commentSection) return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check both the node itself and its children for comments
            if (node.matches('ytd-comment-thread-renderer')) {
              addReplyButtonToComment(node);
            }
            const comments = node.querySelectorAll('ytd-comment-thread-renderer');
            comments.forEach(addReplyButtonToComment);
          }
        });
      }
    });
  });

  observer.observe(commentSection, {
    childList: true,
    subtree: true
  });
}

function addReplyButtonToComment(commentElement) {
  // Check if we've already added a button to this comment
  if (commentElement.querySelector('.suggest-reply-button')) {
    return;
  }

  const actionButtons = commentElement.querySelector('#action-buttons');
  if (!actionButtons) return;

  // Create button container with the same style as the original suggestion button
  const replyButtonContainer = document.createElement('div');
  replyButtonContainer.style.position = 'relative';
  replyButtonContainer.style.display = 'inline-block';
  replyButtonContainer.classList.add('suggest-reply-button');

  const suggestReplyButton = document.createElement('button');
  suggestReplyButton.innerHTML = '💭 Suggest Reply';
  suggestReplyButton.style.cssText = `
    background: #065fd4;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 18px;
    cursor: pointer;
    margin: 8px;
    font-size: 12px;
  `;

  const dropdownContent = document.createElement('div');
  dropdownContent.style.cssText = `
    display: none;
    position: absolute;
    background-color: #f9f9f9;
    min-width: 200px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    padding: 12px;
    z-index: 1000;
    border-radius: 8px;
    margin-top: 4px;
    left: 0;
  `;

  replyButtonContainer.appendChild(suggestReplyButton);
  replyButtonContainer.appendChild(dropdownContent);
  actionButtons.appendChild(replyButtonContainer);

  // Create a unique listener for this reply button
  const messageListener = (message) => {
    if (message.action === 'commentGenerated') {
      if (!message.comment) {
        dropdownContent.textContent = 'Error getting suggestion. Please try again.';
        return;
      }

      dropdownContent.textContent = message.comment;

      // Add "Use this reply" button
      const useButton = document.createElement('button');
      useButton.textContent = 'Use this reply';
      useButton.style.cssText = `
        background: #065fd4;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 18px;
        cursor: pointer;
        margin-top: 8px;
        font-size: 12px;
        display: block;
        width: 100%;
      `;

      useButton.addEventListener('click', () => {
        // Click the reply button to open the reply box
        const replyButton = commentElement.querySelector('#reply-button-end');
        if (replyButton) {
          replyButton.click();

          // Wait for the reply box to appear
          setTimeout(() => {
            const replyBox = commentElement.querySelector('#contenteditable-root');
            if (replyBox) {
              // Set the reply text
              replyBox.textContent = message.comment;
              replyBox.innerText = message.comment;

              // Trigger input events
              const inputEvent = new InputEvent('input', { bubbles: true });
              replyBox.dispatchEvent(inputEvent);
              replyBox.dispatchEvent(new Event('change', { bubbles: true }));

              // Focus the reply box
              replyBox.focus();
            }
          }, 100);
        }
        dropdownContent.style.display = 'none';
      });

      dropdownContent.appendChild(useButton);
    }
  };

  // Store the listener reference on the button container
  replyButtonContainer.messageListener = messageListener;
  chrome.runtime.onMessage.addListener(messageListener);

  suggestReplyButton.addEventListener('click', () => {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
    const commentText = commentElement.querySelector('#content-text')?.textContent;

    if (videoTitle && commentText) {
      dropdownContent.style.display = 'block';
      dropdownContent.textContent = 'Loading suggestion...';

      chrome.runtime.sendMessage({
        action: 'fetchReply',
        title: videoTitle,
        parentComment: commentText
      });
    }
  });

  // Clean up listener when comment is removed
  const cleanup = () => {
    if (replyButtonContainer.messageListener) {
      chrome.runtime.onMessage.removeListener(replyButtonContainer.messageListener);
    }
  };

  // Create a MutationObserver to watch for comment removal
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && !document.contains(commentElement)) {
        cleanup();
        observer.disconnect();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (event) => {
    if (!replyButtonContainer.contains(event.target)) {
      dropdownContent.style.display = 'none';
    }
  });
}

// Listen for video title requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getVideoTitle") {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
    sendResponse({ title: videoTitle });
  }
  return true; // Keep the message channel open for asynchronous response
});

// Start observing for elements
waitForElements();