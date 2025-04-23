// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchComment' || message.action === 'fetchReply') {
    const videoTitle = message.title;
    const parentComment = message.parentComment; // Will be undefined for regular comments

    // Get the API key from storage
    chrome.storage.local.get(['geminiApiKey'], function(result) {
      if (!result.geminiApiKey) {
        sendErrorToAllListeners('Please set your Gemini API key in the extension popup.');
        return;
      }

      // Prepare prompt based on whether this is a reply or new comment
      let prompt;
      if (message.action === 'fetchReply') {
        prompt = `Generate a short, engaging reply (maximum 20 words) to the YouTube comment "${parentComment}" on a video titled "${videoTitle}". Be concise and natural. Provide ONLY the reply text.`;
      } else {
        prompt = `Generate a single, concise YouTube comment for the video titled "${videoTitle}". The comment should be natural and engaging. Provide ONLY the comment text, without any additional formatting, options, or explanations.`;
      }

      // Call the Google Gemini API to generate a comment
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${result.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            maxOutputTokens: message.action === 'fetchReply' ? 50 : 100, // Reduced tokens for replies
            temperature: 0.7
          }
        })
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response format');
          }
          // Extract the generated text from Gemini's response
          const generatedComment = data.candidates[0].content.parts[0].text;
          sendCommentToAllListeners(generatedComment);
        })
        .catch(error => {
          console.error('Error fetching comment:', error);
          sendErrorToAllListeners('Sorry, there was an error generating a comment.');
        });
    });
  }
});

// Helper function to send comment to all listeners
function sendCommentToAllListeners(comment) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'commentGenerated', 
        comment: comment 
      });
    }
    chrome.runtime.sendMessage({ 
      action: 'commentGenerated', 
      comment: comment 
    });
  });
}

// Helper function to send error to all listeners
function sendErrorToAllListeners(errorMessage) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'commentGenerated', 
        comment: errorMessage 
      });
    }
    chrome.runtime.sendMessage({ 
      action: 'commentGenerated', 
      comment: errorMessage 
    });
  });
}