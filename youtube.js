import { BUTTON_STYLES, createButton, createDropdown, triggerInputEvents } from './utils.js';

export function getVideoTitle() {
  return document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent;
}

export function getCommentText(commentElement) {
  return commentElement.querySelector('#content-text')?.textContent;
}


// Add these transcript extraction functions to youtube.js
export function getVideoTranscript() {
  return new Promise(async (resolve) => {
    try {
      // First, check if we can get the transcript from the UI
      const transcriptText = await getTranscriptFromUI();
      if (transcriptText) {
        console.log('Got transcript from UI');
        resolve(transcriptText);
        return;
      }

      // If UI method fails, try to get it from network data
      const transcriptFromPlayer = await getTranscriptFromPlayerData();
      if (transcriptFromPlayer) {
        console.log('Got transcript from player data');
        resolve(transcriptFromPlayer);
        return;
      }

      // Final fallback - try to get it from the transcript button
      const transcriptFromButton = await getTranscriptByClickingButton();
      if (transcriptFromButton) {
        console.log('Got transcript from button click');
        resolve(transcriptFromButton);
        return;
      }

      // If all methods fail, fall back to title
      const title = getVideoTitle();
      console.log('Failed to get transcript, falling back to title');
      resolve(title ? `Video title: ${title}` : 'No transcript available');
    } catch (error) {
      console.error('Error getting transcript:', error);
      const title = getVideoTitle();
      resolve(title ? `Video title: ${title}` : 'No transcript available');
    }
  });
}

// Method 1: Try to extract transcript from UI if it's already open
async function getTranscriptFromUI() {
  // Look for transcript text in the UI
  const transcriptRenderer = document.querySelector('ytd-transcript-segment-renderer');
  if (transcriptRenderer) {
    // If transcript panel is already open, read all segments
    const segments = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
    if (segments.length > 0) {
      return segments
        .map(segment => segment.textContent.trim())
        .join(' ');
    }
  }
  return null;
}

// Method 2: Extract transcript data from YouTube player
async function getTranscriptFromPlayerData() {
  try {
    // Get video ID from URL
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) return null;

    // Try to access YouTube's ytInitialPlayerResponse object
    const ytInitialData = window.ytInitialPlayerResponse || 
                         window.ytInitialData ||
                         findInitialPlayerData();
                         
    if (!ytInitialData) return null;
    
    // Navigate through the complex structure to find captions data
    let captionTracks = null;
    
    // Path 1: Direct path to captions
    if (ytInitialData.captions && 
        ytInitialData.captions.playerCaptionsTracklistRenderer &&
        ytInitialData.captions.playerCaptionsTracklistRenderer.captionTracks) {
      captionTracks = ytInitialData.captions.playerCaptionsTracklistRenderer.captionTracks;
    }
    
    // Path 2: Alternative path to captions
    if (!captionTracks && ytInitialData.player && ytInitialData.player.captions && 
        ytInitialData.player.captions.playerCaptionsTracklistRenderer) {
      captionTracks = ytInitialData.player.captions.playerCaptionsTracklistRenderer.captionTracks;
    }
    
    if (!captionTracks) return null;
    
    // Find an English track, or use the first available one
    const captionTrack = captionTracks.find(track => 
      track.languageCode === 'en' || track.vssId?.includes('.en')
    ) || captionTracks[0];
    
    if (!captionTrack || !captionTrack.baseUrl) {
      console.log('No valid caption track or baseUrl found in getTranscriptFromPlayerData.');
      return null;
    }
    
    const transcriptUrl = `${captionTrack.baseUrl}&fmt=json3`;
    const response = await fetch(transcriptUrl);

    if (!response.ok) {
      console.error(`Failed to fetch transcript. URL: ${transcriptUrl}, Status: ${response.status} ${response.statusText}`);
      return null;
    }

    const textData = await response.text();
    if (!textData) {
      console.error(`Empty response body from transcript URL: ${transcriptUrl}`);
      return null;
    }
    
    const data = JSON.parse(textData); // Explicitly parse after getting text
    
    if (data && data.events) {
      // Extract text from transcript data
      return data.events
        .filter(event => event.segs)
        .map(event => 
          event.segs
            .map(seg => seg.utf8)
            .join('')
        )
        .join(' ')
        .replace(/\\n/g, ' ') // Replace literal \n
        .replace(/\s+/g, ' '); // Condense multiple spaces
    } else {
      console.log('Parsed transcript data does not contain events property or is null.');
      return null;
    }
  } catch (error) {
    // Log additional context if available
    let errorContext = '';
    if (typeof transcriptUrl !== 'undefined') errorContext += ` URL: ${transcriptUrl}`;
    // Avoid logging potentially very large textData directly, but maybe its start
    // if (typeof textData !== 'undefined') errorContext += ` | Received text (start): ${textData.substring(0, 100)}`;
    console.error(`Error in getTranscriptFromPlayerData:${errorContext}`, error);
  }
  return null;
}

// Helper function to find ytInitialPlayerResponse in scripts
function findInitialPlayerData() {
  for (const script of document.querySelectorAll('script')) {
    if (script.textContent.includes('ytInitialPlayerResponse')) {
      const match = script.textContent.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          console.error('Failed to parse ytInitialPlayerResponse:', e);
        }
      }
    }
  }
  return null;
}

// Method 3: Try to click the transcript button to open the panel
async function getTranscriptByClickingButton() {
  try {
    // Look for the "Show transcript" button
    const transcriptButton = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent.toLowerCase().includes('transcript'));
    
    if (transcriptButton) {
      // Click the button to open the transcript panel
      transcriptButton.click();
      
      // Wait for transcript to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now try to read the transcript
      return await getTranscriptFromUI();
    }
  } catch (error) {
    console.error('Error in getTranscriptByClickingButton:', error);
  }
  return null;
}



export function initializeSuggestionButton(commentField) {
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'position: relative; display: inline-block;';
  
  const suggestButton = createButton('💭 Suggest Comment', BUTTON_STYLES.primary);
  const dropdownContent = createDropdown();

  buttonContainer.appendChild(suggestButton);
  buttonContainer.appendChild(dropdownContent);
  commentField.parentElement.insertBefore(buttonContainer, commentField.nextSibling);

  suggestButton.addEventListener('click', async () => {
    const videoTitle = getVideoTitle();
    if (videoTitle) {
      dropdownContent.style.display = 'block';
      dropdownContent.textContent = 'Loading suggestion...';

      // Get transcript data for better context
      const transcript = await getVideoTranscript();

      if (chrome.runtime?.id) { // Check if context is still valid
        chrome.runtime.sendMessage({
          action: 'fetchComment',
          title: videoTitle,
          transcript: transcript || videoTitle
        });
      } else {
        console.warn('Extension context invalidated, not sending message for fetchComment.');
        dropdownContent.textContent = 'Error: Extension context lost. Please refresh.';
      }
    } else {
      dropdownContent.textContent = 'Could not find video title. Please try again.';
    }
  });

  setupMessageListener(buttonContainer, dropdownContent);
}

export function addReplyButtonToComment(commentElement) {
  // Skip if button already exists or if the element doesn't exist
  if (!commentElement || commentElement.hasAttribute('reply-button-added')) {
    return;
  }

  // Skip if this is not a comment thread
  if (!commentElement.tagName || !commentElement.tagName.toLowerCase().includes('comment')) {
    return;
  }

  // Try multiple selectors for action buttons
  const actionButtons = commentElement.querySelector('#action-buttons') ||
                       commentElement.querySelector('ytd-comment-action-buttons-renderer');
  if (!actionButtons) return;

  const replyButtonContainer = document.createElement('div');
  replyButtonContainer.style.cssText = 'position: relative; display: inline-block; margin-left: 8px;';
  replyButtonContainer.classList.add('suggest-reply-button');

  const suggestReplyButton = createButton('💭 Suggest Reply', BUTTON_STYLES.primary);
  const dropdownContent = createDropdown();
  dropdownContent.style.left = '0';

  replyButtonContainer.appendChild(suggestReplyButton);
  replyButtonContainer.appendChild(dropdownContent);
  actionButtons.appendChild(replyButtonContainer);

  setupReplyMessageListener(replyButtonContainer, dropdownContent, commentElement);
  
  // Mark this comment as processed
  commentElement.setAttribute('reply-button-added', 'true');
}

function setupMessageListener(container, dropdown) {
  const messageListener = (message) => {
    if (message.action === 'commentGenerated') {
      handleCommentGenerated(message, dropdown, '#simplebox-placeholder', '#contenteditable-root');
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);
  setupClickOutside(container, dropdown);
}

function setupReplyMessageListener(container, dropdown, commentElement) {
    const messageListener = (message) => {
      if (message.action === 'commentGenerated') {
        if (!message.comment) {
          dropdown.textContent = 'Error getting suggestion. Please try again.';
          return;
        }
  
        dropdown.textContent = message.comment;
        addUseButton(dropdown, message.comment, commentElement);
      }
    };
  
    container.messageListener = messageListener;
    chrome.runtime.onMessage.addListener(messageListener);
  
    container.querySelector('button').addEventListener('click', async () => {
      const videoTitle = getVideoTitle();
      const commentText = getCommentText(commentElement);
      const transcript = await getVideoTranscript();
  
      if (videoTitle && commentText) {
        dropdown.style.display = 'block';
        dropdown.textContent = 'Loading suggestion...';

        if (chrome.runtime?.id) { // Check if context is still valid
          chrome.runtime.sendMessage({
            action: 'fetchReply',
            title: videoTitle,
            transcript: transcript,
            parentComment: commentText
          });
        } else {
          console.warn('Extension context invalidated, not sending message for fetchReply.');
          dropdown.textContent = 'Error: Extension context lost. Please refresh.';
        }
      }
    });
  
    setupClickOutside(container, dropdown);
  }

function handleCommentGenerated(message, dropdown, inputSelector, editableSelector) {
  if (!message.comment) {
    dropdown.textContent = 'Error getting suggestion. Please try again.';
    return;
  }
  
  dropdown.textContent = message.comment;
  
  const useButton = createButton('Use this comment', BUTTON_STYLES.secondary);
  useButton.addEventListener('click', () => {
    const commentBox = document.querySelector(inputSelector);
    if (commentBox) {
      commentBox.click();
      
      setTimeout(() => {
        const editableBox = document.querySelector(editableSelector);
        if (editableBox) {
          editableBox.textContent = message.comment;
          editableBox.innerText = message.comment;
          triggerInputEvents(editableBox);
          editableBox.focus();
        }
      }, 100);
    }
    dropdown.style.display = 'none';
  });
  
  dropdown.appendChild(useButton);
}

function addUseButton(dropdown, comment, commentElement) {
  const useButton = createButton('Use this reply', BUTTON_STYLES.secondary);
  
  useButton.addEventListener('click', () => {
    const replyButton = commentElement.querySelector('#reply-button-end');
    if (replyButton) {
      replyButton.click();

      setTimeout(() => {
        const replyBox = commentElement.querySelector('#contenteditable-root');
        if (replyBox) {
          replyBox.textContent = comment;
          replyBox.innerText = comment;
          triggerInputEvents(replyBox);
          replyBox.focus();
        }
      }, 100);
    }
    dropdown.style.display = 'none';
  });

  dropdown.appendChild(useButton);
}

function setupClickOutside(container, dropdown) {
  document.addEventListener('click', (event) => {
    if (!container.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });
}
