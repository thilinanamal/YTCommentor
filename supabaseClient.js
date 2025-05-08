// This script assumes that the Supabase UMD bundle has been loaded via a <script> tag
// in popup.html before popup.js (which imports this file) is executed.
// The UMD bundle should create a global 'supabase' object.

const supabaseUrl = 'https://dwjqrxxvjznhdfklfjbx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3anFyeHh2anpuaGRma2xmamJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2ODk1MTAsImV4cCI6MjA2MjI2NTUxMH0.EOFQwttYq3ssp1HI4oYRWnAvn4B6E5s9rU6-hL-yQEc';

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
