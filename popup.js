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
  handleApiKeySubmission(apiKey);
});

// Handle Change API Key button click
document.getElementById('changeApiKey').addEventListener('click', function() {
  // Show API key form and hide comment section
  document.getElementById('apiKeyForm').style.display = 'block';
  document.getElementById('commentSection').style.display = 'none';
  
  // Clear the API key input
  document.getElementById('apiKey').value = '';
  document.getElementById('apiKeyError').textContent = '';
});

function handleApiKeySubmission(apiKey) {
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
}

function requestVideoComment() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]?.id) {
      document.getElementById('comment').textContent = 'Unable to access the current tab.';
      return;
    }

    const url = tabs[0].url || '';
    const isYouTube = url.includes('youtube.com/watch');
    const isYouTubeStudio = url.includes('studio.youtube.com/video/');
    
    if (!isYouTube && !isYouTubeStudio) {
      document.getElementById('comment').textContent = 'Please open a YouTube video or YouTube Studio video page to get comment suggestions.';
      return;
    }

    // First check if content script is loaded
    chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
      if (chrome.runtime.lastError) {
        // Content script not loaded, try to inject it
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }).then(() => {
          // Now try to get the video data
          requestTitle(tabs[0].id);
        }).catch(error => {
          document.getElementById('comment').textContent = 'Error loading extension. Please refresh the page and try again.';
        });
      } else {
        // Content script is loaded, proceed with getting data
        requestTitle(tabs[0].id);
      }
    });
  });
}

function requestTitle(tabId) {
  chrome.tabs.sendMessage(tabId, {action: "getVideoWithTranscript"}, function(response) {
    if (chrome.runtime.lastError) {
      document.getElementById('comment').textContent = 'Unable to connect to the page. Please refresh and try again.';
      return;
    }

    if (response?.title) {
      console.log('Found title:', response.title); 
      console.log('Found transcript:', response.transcript ? "yes" : "no");
      
      chrome.runtime.sendMessage({ 
        action: 'fetchComment', 
        title: response.title,
        transcript: response.transcript || response.title
      });
    } else {
      document.getElementById('comment').textContent = 'Could not find video data. Please make sure you are on a video page.';
    }
  });
}

// Listen for the generated comment from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'commentGenerated') {
    const commentElement = document.getElementById('comment');
    commentElement.textContent = message.comment;
  }
});