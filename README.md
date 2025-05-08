# YouTube Comment Suggester Chrome Extension

## Description

The YouTube Comment Suggester is a Chrome extension designed to help users generate engaging comments for YouTube videos. It utilizes the Google Gemini API to suggest comments based on the video's title and transcript (if available). The extension also features user authentication powered by Supabase.

## Features

-   **Automatic Comment Generation**: Suggests YouTube comments using the Google Gemini API.
-   **Transcript-Based Suggestions**: Uses video transcripts (when available) for more relevant comment suggestions, otherwise falls back to the video title.
-   **Reply Generation**: Can generate replies to existing comments.
-   **User Authentication**: Secure login and sign-up functionality using Supabase.
-   **API Key Management**: Allows users to securely store and manage their Google Gemini API key.
-   **Works on YouTube and YouTube Studio**: Provides suggestions on both regular YouTube video pages and within YouTube Studio.

## Tech Stack

-   **Frontend**: HTML, CSS, JavaScript
-   **Browser Extension API**: Chrome Extension Manifest V3
-   **AI Model**: Google Gemini API (via `gemini-2.0-flash` model)
-   **Authentication & Database**: Supabase (for user management)
-   **Core Libraries**:
    -   Supabase Client Library (`supabase-js` UMD bundle)

## Setup and Installation

1.  **Clone the Repository (Example)**:
    ```bash
    git clone https://example.com/your-repository-name.git
    cd your-repository-name
    ```

2.  **Create `.env` File**:
    In the root directory of the project, create a file named `.env` and add your Supabase and Google Gemini API credentials:

    ```env
    const supabaseUrl = YOUR_SUPABASE_URL;
    const supabaseAnonKey = YOUR_SUPABASE_ANON_KEY;
    ```
    *   `YOUR_SUPABASE_URL`: Your Supabase project URL.
    *   `YOUR_SUPABASE_ANON_KEY`: Your Supabase project's public anon key.

    *Note: The Gemini API key is managed through the extension's popup interface after installation and login.*

3.  **Load the Extension in Chrome**:
    *   Open Google Chrome and navigate to `chrome://extensions`.
    *   Enable "Developer mode" using the toggle switch in the top right corner.
    *   Click the "Load unpacked" button.
    *   Select the project's root directory.

## File Structure

-   `manifest.json`: The extension's manifest file, defining permissions, scripts, and other metadata.
-   `popup.html`: The HTML structure for the extension's popup interface.
-   `popup.js`: Handles the logic for the popup, including UI interactions, authentication, API key management, and communication with the background script.
-   `background.js`: The service worker for the extension. It manages:
    -   Loading Supabase configuration securely from the `.env` file.
    -   Handling API calls to the Google Gemini API.
    -   Message passing between different parts of the extension.
-   `content.js`: Injected into YouTube and YouTube Studio pages to extract video titles, transcripts, and facilitate comment interaction.
-   `supabaseClient.js`: Initializes the Supabase client, fetching configuration securely from `background.js`.
-   `.env`: (You create this) Stores Supabase URL and Anon Key. **This file should be in your .gitignore if you are using version control.**
-   `icon16.png`, `icon48.png`, `icon128.png`: Extension icons.
-   `lib/supabase.umd.js`: The Supabase client library (UMD version).
-   `utils.js`, `youtube.js`, `youtubeStudio.js`: Utility scripts, likely for interacting with YouTube pages (contents not fully inspected for this README).

## How It Works

1.  **Configuration Loading**:
    -   On startup, `background.js` fetches the `.env` file (made accessible via `web_accessible_resources`) to load the Supabase URL and Anon Key.
    -   `supabaseClient.js` requests this configuration from `background.js` via `chrome.runtime.sendMessage` to initialize the Supabase client asynchronously.

2.  **User Authentication**:
    -   `popup.js` uses the initialized Supabase client (obtained via `await getSupabase()`) to handle user sign-up, login, and session management.

3.  **Gemini API Key**:
    -   Users enter their Gemini API key through the extension popup.
    -   The key is stored securely using `chrome.storage.local`.

4.  **Comment Generation**:
    -   When on a YouTube video page, `popup.js` requests video information (title, transcript) from `content.js`.
    -   `popup.js` then sends a message to `background.js` with the video details and a request to fetch a comment.
    -   `background.js` makes a POST request to the Google Gemini API using the stored API key and video information.
    -   The generated comment is sent back to `popup.js` and displayed to the user.

## Troubleshooting

-   **"Supabase URL or Anon Key not found in .env file"**: Ensure your `.env` file is in the root directory and correctly formatted with `const supabaseUrl = ...;` and `const supabaseAnonKey = ...;`.
-   **"Cannot read properties of null (reading 'auth')"**: This usually means the Supabase client wasn't initialized correctly. Ensure `background.js` can access and parse `.env`, and that `popup.js` is awaiting `getSupabase()`.
-   **"Please set your Gemini API key..."**: Open the extension popup and enter your Google Gemini API key in the settings section.
-   **Extension not loading/errors on `chrome://extensions`**: Check the "Errors" button for the extension on the `chrome://extensions` page for detailed error messages. Ensure `manifest.json` is valid.
