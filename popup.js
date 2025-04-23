// Request video title from active tab when popup opens
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

// Listen for the generated comment from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'commentGenerated') {
    const commentElement = document.getElementById('comment');
    commentElement.textContent = message.comment;
  }
});