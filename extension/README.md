# BulkDM Chrome Extension

Chrome extension for one-click Instagram account connection to BulkDM.

## Features

- 🔐 One-click Instagram session extraction
- 🌐 Auto-detects production vs localhost
- 🔄 Automatic fallback between environments
- 📊 Visual environment indicator
- ✅ Works with multiple Instagram accounts

## URLs

### Production (Default)
- **Frontend**: `https://bulkdm-saas.netlify.app`
- **Backend**: `https://bulkdm-saas.netlify.app` (Update when backend is deployed separately)

### Development (Fallback)
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:3001`

## How It Works

1. **Auto-Detection**: Extension automatically detects if production or localhost is available
2. **Smart Fallback**: If production fails, automatically tries localhost
3. **Manual Override**: Users can manually configure URLs via Chrome storage

## Environment Indicator

The extension shows which environment it's connected to:
- 🌐 Green: Connected to production (Netlify)
- 💻 Yellow: Connected to localhost (Development)

## Updating Backend URL

When you deploy the backend separately (Railway, Render, etc.):

1. Update `PRODUCTION_BACKEND_URL` in:
   - `popup.js` (line ~4)
   - `background.js` (line ~4)

2. Rebuild the extension:
   ```bash
   cd extension
   ./build.sh
   ```

3. Update the ZIP file and republish to Chrome Web Store

## Installation

1. Download `bulkdm-extension-v1.0.1.zip`
2. Extract the ZIP file
3. Open Chrome and go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked"
6. Select the extracted extension folder

## Publishing

See `../EXTENSION_DEPLOYMENT.md` for Chrome Web Store publishing instructions.

