// This script assumes that the Supabase UMD bundle has been loaded via a <script> tag
// in popup.html before popup.js (which imports this file) is executed.
// The UMD bundle should create a global 'supabase' object.

let supabaseInstance = null;
let initializeSupabasePromise = null;

async function initializeSupabase() {
  if (!chrome.runtime || !chrome.runtime.sendMessage) {
    console.error("Chrome runtime API is not available. Supabase client cannot be initialized.");
    return null;
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getSupabaseConfig' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting Supabase config:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response && response.url && response.anonKey) {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          supabaseInstance = window.supabase.createClient(response.url, response.anonKey);
          console.log('Supabase client initialized.');
          resolve(supabaseInstance);
        } else {
          console.error('Supabase UMD bundle not loaded or window.supabase.createClient is not available.');
          reject(new Error('Supabase UMD bundle not loaded.'));
        }
      } else {
        console.error('Failed to get Supabase config from background script or config is invalid:', response);
        reject(new Error('Failed to get Supabase config.'));
      }
    });
  });
}

// Initialize Supabase and store the promise.
// This allows other modules to await the initialization.
initializeSupabasePromise = initializeSupabase().catch(err => {
  console.error("Failed to initialize Supabase during script load:", err);
  // supabaseInstance will remain null
  return null; // Ensure the promise chain resolves to null on error
});

// Export a way to get the supabase instance, potentially after it's initialized.
// Callers should await this promise.
export const getSupabase = () => initializeSupabasePromise;

// For convenience, you can also export the instance directly.
// Code using this should check if it's null or await the promise.
export { supabaseInstance as supabase };
