// Helper function to safely send messages to tabs
async function safelySendMessageToTab(tabId, message) {
  try {
    // Check if the tab still exists
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      console.log('Tab no longer exists');
      return false;
    }

    // Attempt to send the message
    return await chrome.tabs.sendMessage(tabId, message).catch(error => {
      console.log('Failed to send message to tab:', error);
      return false;
    });
  } catch (error) {
    console.log('Error checking tab:', error);
    return false;
  }
}

// Helper function to send comment to all listeners with error handling
async function sendCommentToAllListeners(comment) {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const activeTab = tabs[0];
    
    if (activeTab) {
      await safelySendMessageToTab(activeTab.id, {
        action: 'commentGenerated',
        comment: comment
      });
    }

    // Also send to runtime (popup)
    chrome.runtime.sendMessage({
      action: 'commentGenerated',
      comment: comment
    }).catch(error => console.log('Error sending to runtime:', error));
  } catch (error) {
    console.error('Error in sendCommentToAllListeners:', error);
  }
}

// Helper function to send error to all listeners with error handling
async function sendErrorToAllListeners(errorMessage) {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const activeTab = tabs[0];
    
    if (activeTab) {
      await safelySendMessageToTab(activeTab.id, {
        action: 'commentGenerated',
        comment: errorMessage
      });
    }

    // Also send to runtime (popup)
    chrome.runtime.sendMessage({
      action: 'commentGenerated',
      comment: errorMessage
    }).catch(error => console.log('Error sending to runtime:', error));
  } catch (error) {
    console.error('Error in sendErrorToAllListeners:', error);
  }
}

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
            maxOutputTokens: message.action === 'fetchReply' ? 50 : 100,
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
          sendErrorToAllListeners('Sorry, there was an error generating a comment. Please try again.');
        });
    });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});