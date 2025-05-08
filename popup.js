import { getSupabase } from './supabaseClient.js';

// DOM Elements
const authForm = document.getElementById('authForm');
const apiKeyForm = document.getElementById('apiKeyForm');
const commentSection = document.getElementById('commentSection');
const authTitle = document.getElementById('authTitle');
const authButton = document.getElementById('authButton');
const logoutButton = document.getElementById('logoutButton');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const authErrorDiv = document.getElementById('authError');
const toggleAuthModeButton = document.getElementById('toggleAuthModeButton');

const apiKeyInput = document.getElementById('apiKey');
const submitApiKeyButton = document.getElementById('submitApiKey');
const changeApiKeyButton = document.getElementById('changeApiKey');
const apiKeyErrorDiv = document.getElementById('apiKeyError');
const commentDiv = document.getElementById('comment');

let isLoginMode = true;

// --- UI Update Functions ---
function showAuthForm() {
  authForm.style.display = 'block';
  apiKeyForm.style.display = 'none';
  commentSection.style.display = 'none';
  logoutButton.style.display = 'none';
  updateAuthFormUI(); // Ensure auth form UI is correct
}

function showAppContent() {
  authForm.style.display = 'none';
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (result.geminiApiKey) {
      apiKeyForm.style.display = 'none';
      commentSection.style.display = 'block';
      requestVideoComment();
    } else {
      apiKeyForm.style.display = 'block';
      commentSection.style.display = 'none';
    }
  });
  logoutButton.style.display = 'block';
}

function updateAuthFormUI() {
  authErrorDiv.textContent = ''; // Clear previous errors
  if (isLoginMode) {
    authTitle.textContent = 'Login';
    authButton.textContent = 'Login';
    if (confirmPasswordInput) { // Check if element exists
        confirmPasswordInput.style.display = 'none';
        confirmPasswordInput.required = false;
    }
    toggleAuthModeButton.textContent = 'Need an account? Sign Up';
  } else {
    authTitle.textContent = 'Sign Up';
    authButton.textContent = 'Sign Up';
    if (confirmPasswordInput) { // Check if element exists
        confirmPasswordInput.style.display = 'block';
        confirmPasswordInput.required = true;
    }
    toggleAuthModeButton.textContent = 'Already have an account? Login';
  }
}

// --- Authentication ---
async function checkSession() {
  const supabase = await getSupabase();
  if (!supabase) {
    console.error('Supabase client is not initialized.');
    authErrorDiv.textContent = 'Error initializing. Please try again.';
    showAuthForm();
    return;
  }
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error.message);
    showAuthForm();
    return;
  }
  if (session) {
    console.log('User is logged in:', session.user.email);
    showAppContent();
  } else {
    console.log('User is not logged in.');
    showAuthForm();
  }
}

if (toggleAuthModeButton) {
    toggleAuthModeButton.addEventListener('click', () => {
      isLoginMode = !isLoginMode;
      updateAuthFormUI();
    });
}

if (authButton) {
    authButton.addEventListener('click', async () => {
      const supabase = await getSupabase();
      if (!supabase) {
        authErrorDiv.textContent = 'Error initializing. Please try again.';
        return;
      }
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      authErrorDiv.textContent = '';

      if (!email || !password) {
        authErrorDiv.textContent = 'Email and password are required.';
        return;
      }

      if (isLoginMode) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          authErrorDiv.textContent = error.message;
          return;
        }
        if (data.user) {
          console.log('Login successful:', data.user.email);
          showAppContent();
        }
      } else {
        // Sign Up
        const confirmPassword = confirmPasswordInput.value.trim();
        if (!confirmPassword) {
            authErrorDiv.textContent = 'Please confirm your password.';
            return;
        }
        if (password !== confirmPassword) {
          authErrorDiv.textContent = 'Passwords do not match.';
          return;
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          authErrorDiv.textContent = error.message;
          return;
        }
        if (data.user) {
          if (data.user.email_confirmed_at || data.session) {
             console.log('Signup successful and user confirmed/logged in:', data.user.email);
             showAppContent();
          } else {
            authErrorDiv.textContent = 'Registration successful! Please check your email to confirm your account.';
          }
        } else {
            authErrorDiv.textContent = 'Registration successful! Please check your email to confirm your account.';
        }
      }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      const supabase = await getSupabase();
      if (!supabase) {
        authErrorDiv.textContent = 'Error initializing. Please try again.';
        return;
      }
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error.message);
        authErrorDiv.textContent = `Error signing out: ${error.message}`;
      } else {
        console.log('Logout successful');
        emailInput.value = '';
        passwordInput.value = '';
        if(confirmPasswordInput) confirmPasswordInput.value = '';
        authErrorDiv.textContent = '';
        isLoginMode = true; // Reset to login mode
        showAuthForm();
      }
    });
}

// --- Existing Gemini API Key Logic ---
if (submitApiKeyButton) {
    submitApiKeyButton.addEventListener('click', function() {
      const apiKey = apiKeyInput.value.trim();
      handleApiKeySubmission(apiKey);
    });
}

if (changeApiKeyButton) {
    changeApiKeyButton.addEventListener('click', function() {
      apiKeyForm.style.display = 'block';
      commentSection.style.display = 'none';
      apiKeyInput.value = '';
      apiKeyErrorDiv.textContent = '';
    });
}

function handleApiKeySubmission(apiKey) {
  apiKeyErrorDiv.textContent = '';
  if (!apiKey) {
    apiKeyErrorDiv.textContent = 'Please enter an API key';
    return;
  }
  chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
    apiKeyForm.style.display = 'none';
    commentSection.style.display = 'block';
    requestVideoComment();
  });
}

function requestVideoComment() {
  commentDiv.textContent = 'Loading...';
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (!tabs[0]?.id) {
      commentDiv.textContent = 'Unable to access the current tab.';
      return;
    }
    const url = tabs[0].url || '';
    const isYouTube = url.includes('youtube.com/watch');
    const isYouTubeStudio = url.includes('studio.youtube.com/video/');
    if (!isYouTube && !isYouTubeStudio) {
      commentDiv.textContent = 'Please open a YouTube video or YouTube Studio video page to get comment suggestions.';
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {action: "ping"}, function(response) {
      if (chrome.runtime.lastError || !response) { // Added !response check
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }).then(() => {
          requestTitle(tabs[0].id);
        }).catch(error => {
          console.error("Script injection failed:", error);
          commentDiv.textContent = 'Error loading extension. Please refresh the page and try again.';
        });
      } else {
        requestTitle(tabs[0].id);
      }
    });
  });
}

function requestTitle(tabId) {
  chrome.tabs.sendMessage(tabId, {action: "getVideoWithTranscript"}, function(response) {
    if (chrome.runtime.lastError || !response) { // Added !response check
      console.error("Error getting video data:", chrome.runtime.lastError?.message);
      commentDiv.textContent = 'Unable to connect to the page or get video data. Please refresh and try again.';
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
      commentDiv.textContent = 'Could not find video data. Please make sure you are on a video page.';
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'commentGenerated') {
    commentDiv.textContent = message.comment;
  }
  // It's good practice to return true for async sendResponse, though not used here.
  return true; 
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    updateAuthFormUI(); // Initial UI setup for auth form
});
