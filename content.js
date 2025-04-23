// Wait for the comment section to load
function waitForCommentField() {
  const observer = new MutationObserver((mutations, obs) => {
    const commentField = document.querySelector('#placeholder-area');
    if (commentField) {
      obs.disconnect();
      initializeSuggestionButton();
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

// Listen for video title requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getVideoTitle") {
    const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
    sendResponse({ title: videoTitle });
  }
  return true; // Keep the message channel open for asynchronous response
});

// Start observing for comment field
waitForCommentField();