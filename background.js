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
let supabaseInstance = null;

async function loadSupabaseConfig() {
  try {
    // First try to load from storage
    const storedConfig = await new Promise(resolve => {
      chrome.storage.local.get(['supabaseConfig'], result => {
        resolve(result.supabaseConfig);
      });
    });
    
    // If we have a valid stored config, use it
    if (storedConfig && storedConfig.url && storedConfig.anonKey) {
      supabaseConfig = storedConfig;
      console.log('Supabase config loaded from storage');
      return supabaseConfig;
    }
    
    // Otherwise load from .env file
    const response = await fetch(chrome.runtime.getURL('.env'));
    if (!response.ok) {
      console.error('Failed to fetch .env file:', response.statusText);
      return null;
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
      // Store the config for future use
      chrome.storage.local.set({ supabaseConfig: config });
      
      supabaseConfig = config;
      console.log('Supabase config loaded from .env and saved to storage');
      return supabaseConfig;
    } else {
      console.error('Supabase URL or Anon Key not found in .env file');
      return null;
    }
  } catch (error) {
    console.error('Error loading Supabase config:', error);
    return null;
  }
}

// Load config on startup
loadSupabaseConfig();

// We'll use a different approach for background script
// Instead of initializing Supabase directly, we'll communicate with popup.js
// which has access to the window object

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSupabaseConfig') {
    // Always try to load the latest config when requested
    loadSupabaseConfig().then(config => {
      if (config) {
        sendResponse(config);
      } else {
        // If we still don't have a config, try one more time with a delay
        setTimeout(async () => {
          const retryConfig = await loadSupabaseConfig();
          if (retryConfig) {
            sendResponse(retryConfig);
          } else {
            // If all else fails, try to construct a minimal config from environment variables
            // This is a last resort fallback
            const fallbackConfig = {
              url: 'https://your-project-id.supabase.co',  // Replace with your actual URL if known
              anonKey: 'your-anon-key'  // Replace with your actual key if known
            };
            
            // Store this fallback config
            chrome.storage.local.set({ supabaseConfig: fallbackConfig });
            supabaseConfig = fallbackConfig;
            
            sendResponse(fallbackConfig);
          }
        }, 500); // Small delay before retry
      }
    }).catch(error => {
      console.error('Error in getSupabaseConfig handler:', error);
      sendResponse({ error: "Failed to load Supabase config: " + error.message });
    });
    
    return true; // Indicates that the response is sent asynchronously
  } else if (message.action === 'fetchComment' || message.action === 'fetchReply') {
    const videoTitle = message.title;
    const videoTranscript = message.transcript; // New parameter
    const parentComment = message.parentComment; // Will be undefined for regular comments
  
    // Check user credits from local storage
    checkLocalCredits()
      .then(creditResult => {
        if (!creditResult.success) {
          sendErrorToAllListeners(creditResult.message);
          return null; // Return null to continue the chain but skip API call
        }
        
        // Return a promise for the API key
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(['geminiApiKey'], function(result) {
            if (!result.geminiApiKey) {
              console.error('Gemini API key not found in local storage.');
              reject(new Error('Please set your Gemini API key in the extension popup.'));
              return;
            }
            resolve(result.geminiApiKey);
          });
        });
      })
      .then(apiKey => {
        // If previous step returned null, skip this step
        if (apiKey === null) return;
        
        console.log(`Using Gemini API Key (first 5 chars): ${apiKey.substring(0, 5)}...`);

        // Prepare prompt based on whether this is a reply or new comment
        let prompt;
        if (message.action === 'fetchReply') {
          prompt = `Generate a engaging reply to the YouTube comment "${parentComment}" on a video with the following content: "${videoTranscript}". Be casual and natural. Provide ONLY the reply text.`;
        } else {
          // Use transcript if available, otherwise fall back to title
          prompt = `Generate a single, engaging YouTube comment for a video with the following content: "${videoTranscript}". The comment should be natural and engaging. Provide ONLY the comment text, without any additional formatting, options, or explanations.`;
        }
    
        // Call the Google Gemini API to generate a comment
        return fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
        });
      })
      .then(response => {
        // If previous step returned undefined, skip this step
        if (!response) return;
        
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        // If previous step returned undefined, skip this step
        if (!data) return;
        
        if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
          throw new Error('Invalid response format from Gemini API');
        }
        // Extract the generated text from Gemini's response
        const generatedComment = data.candidates[0].content.parts[0].text;
        sendCommentToAllListeners(generatedComment);
      })
      .catch(error => {
        console.error('Error in comment generation process:', error);
        sendErrorToAllListeners(error.message || 'Sorry, there was an error generating a comment. Please try again.');
      });
  
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

// Local credit management system
let lastSyncTime = 0;
const SYNC_INTERVAL = 1 * 60 * 1000; // 10 minutes in milliseconds

// Function to check local credits
async function checkLocalCredits() {
  try {
    // Get user email from storage
    const userDataResult = await new Promise(resolve => {
      chrome.storage.local.get(['userEmail', 'userCredits', 'lastCreditSync'], result => {
        resolve(result);
      });
    });
    
    const { userEmail, userCredits, lastCreditSync } = userDataResult;
    
    if (!userEmail) {
      return { success: false, message: 'Please log in to generate comments.' };
    }
    
    // If credits are not initialized yet, initialize them
    if (userCredits === undefined) {
      // Request initial credit value from popup
      chrome.runtime.sendMessage({ action: 'initializeCredits' });
      return { success: false, message: 'Initializing your credits. Please try again in a moment.' };
    }
    
    // Check if user has enough credits
    if (userCredits <= 0) {
      return { 
        success: false, 
        message: 'You have run out of credits. Please purchase more credits to continue generating comments.' 
      };
    }
    
    // Deduct one credit locally
    const newCreditAmount = userCredits - 1;
    await new Promise(resolve => {
      chrome.storage.local.set({ userCredits: newCreditAmount }, resolve);
    });
    
    // Check if we need to sync with Supabase
    const currentTime = Date.now();
    if (!lastCreditSync || (currentTime - lastCreditSync) > SYNC_INTERVAL) {
      // Request sync with Supabase
      chrome.runtime.sendMessage({ 
        action: 'syncCredits', 
        credits: newCreditAmount 
      });
      
      // Update last sync time
      chrome.storage.local.set({ lastCreditSync: currentTime });
    }
    
    console.log(`Credit used. User ${userEmail} now has ${newCreditAmount} credits remaining.`);
    return { success: true, credits: newCreditAmount };
  } catch (error) {
    console.error('Unexpected error in checkLocalCredits:', error);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }
}

// Listen for credit updates from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateLocalCredits' && message.credits !== undefined) {
    chrome.storage.local.set({ 
      userCredits: message.credits,
      lastCreditSync: Date.now()
    }, () => {
      console.log(`Local credits updated to ${message.credits}`);
      sendResponse({ success: true });
    });
    return true; // Indicates async response
  }
  // Always send a response for any message we don't handle
  // This prevents 'message channel closed' errors
  sendResponse({ success: false, error: 'Unhandled message type' });
});
