# BulkDM Chrome Extension

Chrome extension for one-click Instagram account connection to BulkDM.

## Overview

The BulkDM Chrome Extension simplifies connecting your Instagram account by automatically extracting session cookies from your browser when you're logged into Instagram. This eliminates the need for manual cookie management.

## Features

- 🔐 **One-Click Connection**: Connect Instagram account with a single click
- 🔒 **Secure**: Cookies are encrypted and stored securely
- 🌐 **Auto-Detection**: Automatically detects production or localhost environment
- 📱 **Easy Setup**: Works with existing Instagram browser session
- 🔄 **Reliable Transfer**: Uses content script for reliable cookie transfer

## How It Works

1. User clicks "Grab Instagram Session" button in extension popup
2. Extension extracts Instagram session cookies from browser
3. Verifies session with BulkDM backend
4. Transfers cookies to BulkDM web application via localStorage
5. Account is automatically connected in BulkDM dashboard

## Privacy & Security

- **No Browsing History**: Extension only accesses Instagram cookies, not browsing history
- **User Consent**: Only extracts cookies when user explicitly clicks the button
- **Encrypted Storage**: Cookies are encrypted before storage
- **Local Transfer**: Cookies are transferred via browser localStorage, not external servers
- **No Background Activity**: Extension only runs when user interacts with it

See the [Privacy Policy](https://instagram-dm-saas-h94m.vercel.app/privacy) for detailed information.

## Installation

### For Development

1. Clone the repository
2. Load extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` folder

### For Production

1. Build the extension:
   ```bash
   cd extension
   ./build.sh
   ```

2. Install from Chrome Web Store (when published)

## Configuration

The extension uses `config.js` for URL configuration:

- **Production**: `https://instagram-dm-saas-h94m.vercel.app`
- **Local**: `http://localhost:3000`
- **Auto-Detection**: Automatically detects which environment is available

## Files

- `manifest.json` - Extension configuration and permissions
- `popup.html` - Extension popup UI
- `popup.js` - Main extension logic
- `background.js` - Background service worker
- `content-script.js` - Content script for cookie transfer
- `config.js` - URL configuration
- `build.sh` - Build script for creating ZIP package

## Permissions

- `cookies` - Required to read Instagram session cookies
- `activeTab` - Required to interact with Instagram tabs
- `storage` - Required to store cookies temporarily
- `scripting` - Required to inject content scripts

## Building

```bash
cd extension
./build.sh
```

This creates `bulkdm-extension-v1.0.3.zip` ready for Chrome Web Store submission.

## Support

For issues or questions:
- Check [Extension Troubleshooting Guide](../EXTENSION_TROUBLESHOOTING.md)
- Visit [Support Page](https://instagram-dm-saas-h94m.vercel.app/support)

