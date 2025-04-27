// Get the chrome extension URL for our module files
const extensionUrl = chrome.runtime.getURL('');

// Add ping message handler at the top level
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ status: "ok" });
    return true;
  }
  if (message.action === "getVideoTitle") {
    // For YouTube Studio, wait a bit for the entity-name to load if needed
    if (window.location.hostname === 'studio.youtube.com') {
      const maxAttempts = 5;
      let attempts = 0;

      function tryGetTitle() {
        const videoTitle = youtubeStudio?.getVideoTitle();
        if (videoTitle || attempts >= maxAttempts) {
          sendResponse({ title: videoTitle });
        } else {
          attempts++;
          setTimeout(tryGetTitle, 500); // Try again in 500ms
        }
      }

      tryGetTitle();
      return true; // Keep the message channel open
    } else {
      // Regular YouTube, no need to wait
      const videoTitle = youtube?.getVideoTitle();
      sendResponse({ title: videoTitle });
      return true;
    }
  }
});

// Dynamically import our modules
Promise.all([
  import(chrome.runtime.getURL('utils.js')),
  import(chrome.runtime.getURL('youtube.js')),
  import(chrome.runtime.getURL('youtubeStudio.js'))
]).then(([utils, youtube, youtubeStudio]) => {
  // Helper function to determine if we're on YouTube Studio
  function isYouTubeStudio() {
    return window.location.hostname === 'studio.youtube.com';
  }

  // Wait for the comment section to load and initialize everything
  function waitForElements() {
    const observer = new MutationObserver((mutations, obs) => {
      if (isYouTubeStudio()) {
        // YouTube Studio: Look for comments container and thread items
        const studioCommentSection = document.querySelector('ytcp-video-comments') ||
                                   document.querySelector('ytcp-comments-section') ||
                                   document.querySelector('#comments-page') ||
                                   document.querySelector('[page-subtype="comments"]');
        
        if (studioCommentSection) {
          // Look for both individual comments and comment threads
          const existingComments = [
            ...Array.from(studioCommentSection.querySelectorAll('ytcp-comment-thread')),
            ...Array.from(studioCommentSection.querySelectorAll('ytcp-comment-thread-renderer')),
            ...Array.from(studioCommentSection.querySelectorAll('[id^="comment-"]'))
          ];

          // Add reply buttons to existing comments
          existingComments.forEach(comment => {
            // Wait a bit to ensure the comment's internal elements are loaded
            setTimeout(() => youtubeStudio.addReplyButtonToComment(comment), 500);
          });

          // Watch for new comments
          addReplyButtonsToComments(studioCommentSection, youtubeStudio.addReplyButtonToComment);
        }

        // Look for comment input field
        const studioCommentField = document.querySelector('ytcp-comment-text-input');
        if (studioCommentField) {
          youtubeStudio.initializeSuggestionButton(studioCommentField);
        }

        // Don't disconnect observer for Studio since comments load dynamically
      } else {
        // YouTube handling - similar to Studio approach
        const commentField = document.querySelector('#placeholder-area');
        if (commentField && !commentField.hasAttribute('suggestion-button-added')) {
          youtube.initializeSuggestionButton(commentField);
          commentField.setAttribute('suggestion-button-added', 'true');
        }

        // Look for the comment section container
        const commentSections = [
          document.querySelector('ytd-comments#comments'),
          document.querySelector('#comments>#sections>ytd-comment-thread-renderer'),
          document.querySelector('#sections>ytd-comment-thread-renderer')
        ];
        
        const commentSection = commentSections.find(section => section !== null);
        
        if (commentSection) {
          // Add observer directly to the comment section
          if (!commentSection.hasAttribute('observer-added')) {
            const commentsObserver = new MutationObserver((mutations) => {
              mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    // Check if it's a comment thread
                    if (node.tagName?.toLowerCase() === 'ytd-comment-thread-renderer') {
                      // Add reply button with a small delay to ensure comment is rendered
                      setTimeout(() => youtube.addReplyButtonToComment(node), 100);
                    }
                    // Also check for any comment threads within the added node
                    node.querySelectorAll('ytd-comment-thread-renderer').forEach(comment => {
                      if (!comment.hasAttribute('reply-button-added')) {
                        setTimeout(() => youtube.addReplyButtonToComment(comment), 100);
                        comment.setAttribute('reply-button-added', 'true');
                      }
                    });
                  }
                });
              });
            });

            // Observe only essential changes
            commentsObserver.observe(commentSection, {
              childList: true,
              subtree: true
            });

            commentSection.setAttribute('observer-added', 'true');

            // Add buttons to any existing comments
            commentSection.querySelectorAll('ytd-comment-thread-renderer').forEach(comment => {
              if (!comment.hasAttribute('reply-button-added')) {
                setTimeout(() => youtube.addReplyButtonToComment(comment), 100);
                comment.setAttribute('reply-button-added', 'true');
              }
            });
          }
        }
      }
    });

    // Only observe body for initial setup
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // We don't need to disconnect the main observer since it's lightweight
    // and only looks for major structure changes
  }

  // Update the addReplyButtonsToComments function
  function addReplyButtonsToComments(commentSection, addReplyButtonCallback) {
    if (!commentSection) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for new comments with a delay to ensure they're fully loaded
              setTimeout(() => {
                if (node.matches('ytcp-comment-thread, ytcp-comment-thread-renderer, [id^="comment-"]')) {
                  addReplyButtonCallback(node);
                }
                const comments = node.querySelectorAll('ytcp-comment-thread, ytcp-comment-thread-renderer, [id^="comment-"]');
                comments.forEach(comment => {
                  setTimeout(() => addReplyButtonCallback(comment), 500);
                });
              }, 500);
            }
          });
        }
      });
    });

    observer.observe(commentSection, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id']
    });
  }

  // Listen for video title requests from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getVideoTitle") {
      const videoTitle = isYouTubeStudio() 
        ? youtubeStudio.getVideoTitle()
        : youtube.getVideoTitle();
      sendResponse({ title: videoTitle });
      return true; // Keep the message channel open for async response
    }
  });

  // Start observing for elements
  waitForElements();
}).catch(error => {
  console.error('Error loading modules:', error);
});