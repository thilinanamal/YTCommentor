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
  // Request video title from active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "getVideoTitle"}, function(response) {
      if (response && response.title) {
        // Send the video title to background script for comment generation
        chrome.runtime.sendMessage({ 
          action: 'fetchComment', 
          title: response.title 
        });
      } else {
        document.getElementById('comment').textContent = 'Please open a YouTube video to get comment suggestions.';
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