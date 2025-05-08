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

let supabaseConfig = null;

async function loadSupabaseConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    if (!response.ok) {
      console.error('Failed to fetch .env file:', response.statusText);
      return;
    }
    const text = await response.text();
    const lines = text.split('\n');
    const config = {};
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        let key = parts[0].trim();
        const value = parts[1].trim().replace(/;$/, ''); // Remove trailing semicolon
        
        // Remove "const " prefix if it exists
        if (key.startsWith('const ')) {
          key = key.substring(6).trim();
        }

        if (key === 'supabaseUrl' || key === 'SUPABASE_URL') {
          config.url = value;
        } else if (key === 'supabaseAnonKey' || key === 'SUPABASE_ANON_KEY') {
          config.anonKey = value;
        }
      }
    });
    if (config.url && config.anonKey) {
      supabaseConfig = config;
      console.log('Supabase config loaded:', supabaseConfig);
    } else {
      console.error('Supabase URL or Anon Key not found in .env file');
    }
  } catch (error) {
    console.error('Error loading Supabase config:', error);
  }
}

// Load config on startup
loadSupabaseConfig();

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSupabaseConfig') {
    if (supabaseConfig) {
      sendResponse(supabaseConfig);
    } else {
      // If config isn't loaded yet, try loading again and then respond
      loadSupabaseConfig().then(() => {
        if (supabaseConfig) {
          sendResponse(supabaseConfig);
        } else {
          sendResponse({ error: "Supabase config not available." });
        }
      });
    }
    return true; // Indicates that the response is sent asynchronously
  } else if (message.action === 'fetchComment' || message.action === 'fetchReply') {
    const videoTitle = message.title;
    const videoTranscript = message.transcript; // New parameter
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
        prompt = `Generate a engaging reply to the YouTube comment "${parentComment}" on a video with the following content: "${videoTranscript}". Be casual and natural. Provide ONLY the reply text.`;
      } else {
        // Use transcript if available, otherwise fall back to title
        prompt = `Generate a single, engaging YouTube comment for a video with the following content: "${videoTranscript}". The comment should be natural and engaging. Provide ONLY the comment text, without any additional formatting, options, or explanations.`;
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
