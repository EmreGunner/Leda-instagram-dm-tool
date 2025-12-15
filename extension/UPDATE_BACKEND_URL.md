# Update Backend URL in Extension

When you deploy the backend separately (Railway, Render, Fly.io, etc.), update the backend URL in the extension.

## Quick Update Steps

1. **Get your backend URL**
   - Railway: `https://your-app.up.railway.app`
   - Render: `https://your-app.onrender.com`
   - Fly.io: `https://your-app.fly.dev`

2. **Update extension files:**

   **In `popup.js` (line ~4):**
   ```javascript
   const PRODUCTION_BACKEND_URL = 'https://your-backend-url.com';
   ```

   **In `background.js` (line ~4):**
   ```javascript
   const PRODUCTION_BACKEND_URL = 'https://your-backend-url.com';
   ```

3. **Rebuild extension:**
   ```bash
   cd extension
   ./build.sh
   ```

4. **Update Chrome Web Store** (if published):
   - Upload new ZIP file
   - Increment version in `manifest.json`
   - Submit for review

## Current Configuration

- **Frontend**: `https://bulkdm-saas.netlify.app` ✅
- **Backend**: `https://bulkdm-saas.netlify.app` ⚠️ (Update when backend is deployed separately)

## Testing

After updating:
1. Load extension in Chrome (Developer mode)
2. Check environment indicator shows correct URL
3. Test "Grab Instagram Session"
4. Verify connection works

