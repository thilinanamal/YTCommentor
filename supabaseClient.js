// This script assumes that the Supabase UMD bundle has been loaded via a <script> tag
// in popup.html before popup.js (which imports this file) is executed.
// The UMD bundle should create a global 'supabase' object.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabaseInstance = null;

// Check if the global supabase object and createClient function exist
if (window.supabase && typeof window.supabase.createClient === 'function') {
  supabaseInstance = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error('Supabase UMD bundle not loaded or window.supabase.createClient is not available.');
  // You might want to throw an error or handle this case more gracefully
  // For now, exporting null will likely cause errors downstream if not handled.
}

export const supabase = supabaseInstance;
