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
const loadingIndicator = document.getElementById('loadingIndicator');

let isLoginMode = true;

// --- UI Update Functions ---
function showLoading() {
  if (loadingIndicator) loadingIndicator.style.display = 'block';
  if (authForm) authForm.style.display = 'none';
  if (apiKeyForm) apiKeyForm.style.display = 'none';
  if (commentSection) commentSection.style.display = 'none';
  if (logoutButton) logoutButton.style.display = 'none';
}

function hideLoading() {
  if (loadingIndicator) loadingIndicator.style.display = 'none';
}

function showAuthForm() {
  hideLoading();
  if (authForm) authForm.style.display = 'block';
  apiKeyForm.style.display = 'none';
  commentSection.style.display = 'none';
  logoutButton.style.display = 'none';
  updateAuthFormUI(); // Ensure auth form UI is correct
}

function showAppContent() {
  hideLoading();
  if (authForm) authForm.style.display = 'none';
  chrome.storage.local.get(['geminiApiKey'], function(result) {
    if (result.geminiApiKey) {
      if (apiKeyForm) apiKeyForm.style.display = 'none';
      if (commentSection) commentSection.style.display = 'block';
      requestVideoComment();
    } else {
      if (apiKeyForm) apiKeyForm.style.display = 'block';
      if (commentSection) commentSection.style.display = 'none';
    }
  });
  if (logoutButton) logoutButton.style.display = 'block';
}

function updateAuthFormUI() {
  // This function is called by showAuthForm, which already hides loading.
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
    // Attempt to load API key from Supabase
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('user_api_keys')
      .select('gemini_api_key')
      .eq('email', session.user.email)
      .single();

    if (apiKeyData && apiKeyData.gemini_api_key) {
      chrome.storage.local.set({ geminiApiKey: apiKeyData.gemini_api_key }, () => {
        console.log('API Key loaded from Supabase and saved to local storage.');
        showAppContent();
      });
    } else {
      if (apiKeyError && apiKeyError.code !== 'PGRST116') { // PGRST116: no rows found
        console.error('Error fetching API key from Supabase during checkSession:', apiKeyError.message, apiKeyError);
      } else {
        console.log('No API key found in Supabase for this user during checkSession.');
      }
      showAppContent(); // Show app content, will prompt for API key if not found
    }
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
          // Attempt to load API key from Supabase after login
          const { data: apiKeyData, error: apiKeyError } = await supabase
            .from('user_api_keys')
            .select('gemini_api_key')
            .eq('email', data.user.email)
            .single();

          if (apiKeyData && apiKeyData.gemini_api_key) {
            chrome.storage.local.set({ geminiApiKey: apiKeyData.gemini_api_key }, () => {
              console.log('API Key loaded from Supabase and saved to local storage after login.');
              showAppContent();
            });
          } else {
            if (apiKeyError && apiKeyError.code !== 'PGRST116') {
              console.error('Error fetching API key from Supabase after login:', apiKeyError.message, apiKeyError);
            } else {
                console.log('No API key found in Supabase for this user after login.');
            }
            showAppContent(); // Show app content, will prompt for API key if not found
          }
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

async function handleApiKeySubmission(apiKey) {
  apiKeyErrorDiv.textContent = '';
  if (!apiKey) {
    apiKeyErrorDiv.textContent = 'Please enter an API key';
    return;
  }

  const supabase = await getSupabase();
  if (!supabase) {
    apiKeyErrorDiv.textContent = 'Error initializing. Please try again.';
    return;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    apiKeyErrorDiv.textContent = 'You must be logged in to save an API key.';
    console.error('Error getting session or no session:', sessionError);
    return;
  }

  const userEmail = session.user.email;

  // Save to Supabase
  const { error: upsertError } = await supabase
    .from('user_api_keys')
    .upsert({ email: userEmail, gemini_api_key: apiKey }, { onConflict: 'email' });

  if (upsertError) {
    console.error('Error saving API key to Supabase:', upsertError.message, upsertError);
    apiKeyErrorDiv.textContent = 'Failed to save API key to cloud. Please try again.';
    return;
  }

  console.log('API key saved to Supabase for user:', userEmail);

  // Save to local storage and update UI
  chrome.storage.local.set({ geminiApiKey: apiKey }, function() {
    if (chrome.runtime.lastError) {
        console.error("Error saving API key to local storage:", chrome.runtime.lastError.message);
        apiKeyErrorDiv.textContent = 'Failed to save API key locally. Please try again.';
        return;
    }
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

async function initializeApp() {
    showLoading(); // Show loading indicator initially
    const supabase = await getSupabase();
    if (supabase) {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            if (event === 'SIGNED_OUT') {
                chrome.storage.local.remove('geminiApiKey', () => {
                    console.log('Gemini API key removed from local storage on sign out.');
                    showAuthForm();
                });
            } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
                checkSession(); // Re-check session and API key status
            } else if (event === 'USER_DELETED' || event === 'USER_UPDATED') {
                 checkSession();
            }
        });
    }
    // Initial check
    checkSession();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
