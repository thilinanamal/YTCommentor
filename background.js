// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchComment') {
    const videoTitle = message.title;

    // Call the Google Gemini API to generate a comment
    fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=API', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a single, concise YouTube comment for the video titled "${videoTitle}". The comment should be natural and engaging. Provide ONLY the comment text, without any additional formatting, options, or explanations.`
          }]
        }],
        generationConfig: {
          maxOutputTokens: 100,
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
        // Send the generated comment back to all listeners (popup and content script)
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'commentGenerated', 
              comment: generatedComment 
            });
          }
          chrome.runtime.sendMessage({ 
            action: 'commentGenerated', 
            comment: generatedComment 
          });
        });
      })
      .catch(error => {
        console.error('Error fetching comment:', error);
        // Send error message to all listeners
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
              action: 'commentGenerated', 
              comment: 'Sorry, there was an error generating a comment.' 
            });
          }
          chrome.runtime.sendMessage({ 
            action: 'commentGenerated', 
            comment: 'Sorry, there was an error generating a comment.' 
          });
        });
      });
  }
});