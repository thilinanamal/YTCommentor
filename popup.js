// Check for stored API key when popup opens
chrome.storage.local.get(['geminiApiKey'], function(result) {
  if (result.geminiApiKey) {
    // If API key exists, show comment section and hide API form
    document.getElementById('apiKeyForm').style.display = 'none';
    document.getElementById('commentSection').style.display = 'block';
    
    // Request video title and comment as before
    requestVideoComment();
  }
});

// Handle API key submission
document.getElementById('submitApiKey').addEventListener('click', function() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const errorDiv = document.getElementById('apiKeyError');
  
  if (!apiKey) {
    errorDiv.textContent = 'Please enter an API key';
    return;
  }

  // Store the API key
  chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
    document.getElementById('apiKeyForm').style.display = 'none';
    document.getElementById('commentSection').style.display = 'block';
    requestVideoComment();
  });
});

function requestVideoComment() {
  // First check if we're on a YouTube video page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]?.url?.includes('youtube.com/watch')) {
      document.getElementById('comment').textContent = 'Please open a YouTube video to get comment suggestions.';
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {action: "getVideoTitle"}, function(response) {
      // Check for runtime.lastError to handle connection errors
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        document.getElementById('comment').textContent = 'Unable to connect to the YouTube page. Please refresh the page and try again.';
        return;
      }

      if (response && response.title) {
        // Send the video title to background script for comment generation
        chrome.runtime.sendMessage({ 
          action: 'fetchComment', 
          title: response.title 
        });
      } else {
        document.getElementById('comment').textContent = 'Could not find video title. Please make sure you are on a YouTube video page.';
      }
    });
  });
}

// Listen for the generated comment from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'commentGenerated') {
    const commentElement = document.getElementById('comment');
    commentElement.textContent = message.comment;
  }
});