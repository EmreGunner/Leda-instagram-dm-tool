# Extension Connection Troubleshooting Guide

## Issue: "Cannot connect to backend"

This error occurs when the extension cannot reach the backend through the frontend proxy routes.

## Step-by-Step Fix

### 1. ✅ Check Netlify Environment Variables

**CRITICAL**: The `NEXT_PUBLIC_BACKEND_URL` must be set in Netlify.

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site: `bulkdm-saas`
3. Go to **Site settings** → **Environment variables**
4. Look for `NEXT_PUBLIC_BACKEND_URL`
5. If it's **NOT there**, add it:
   - **Key**: `NEXT_PUBLIC_BACKEND_URL`
   - **Value**: Your Railway backend URL (see step 2)
   - Click **Save**

### 2. 🔍 Get Your Railway Backend URL

1. Go to [Railway Dashboard](https://railway.app)
2. Open your backend service
3. Go to **Settings** → **Networking**
4. Find **Public Domain** (e.g., `https://bulkdm-backend-production.up.railway.app`)
5. Copy the full URL (including `https://`)

### 3. 🔄 Redeploy Netlify

After setting the environment variable:

1. Go to **Deploys** tab in Netlify
2. Click **Trigger deploy** → **Deploy site**
3. Wait for deployment to complete (2-3 minutes)

### 4. 🧪 Test the Proxy Routes

After Netlify redeploys, test if the proxy routes work:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Run this command:
   ```javascript
   fetch('https://bulkdm-saas.netlify.app/api/proxy/instagram/cookie/verify', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ cookies: {} })
   }).then(r => r.json()).then(console.log).catch(console.error)
   ```

**Expected Results:**
- ✅ If `NEXT_PUBLIC_BACKEND_URL` is set: You'll get a response (might be an error, but it means the proxy is working)
- ❌ If `NEXT_PUBLIC_BACKEND_URL` is NOT set: You'll get `"Backend URL not configured"` error

### 5. 🔍 Check Netlify Function Logs

1. Go to Netlify Dashboard → **Functions** tab
2. Look for recent invocations of `/api/proxy/instagram/cookie/verify`
3. Check for errors in the logs

### 6. 🔍 Check Railway Backend

1. Go to Railway Dashboard → your backend service
2. Check **Logs** tab
3. Verify backend is running (should see "🚀 Backend running on...")
4. Check for any errors

### 7. 🔄 Rebuild Extension (If Needed)

If you've updated the extension code:

```bash
cd extension
./build.sh
```

Then reload the extension in Chrome:
1. Go to `chrome://extensions/`
2. Find "BulkDM - Instagram Session Grabber"
3. Click the refresh icon
4. Test again

## Common Issues

### Issue 1: Environment Variable Not Set
**Symptom**: Error message says "Backend URL not configured"
**Fix**: Set `NEXT_PUBLIC_BACKEND_URL` in Netlify (see step 1)

### Issue 2: Wrong Backend URL
**Symptom**: Connection timeout or 404 errors
**Fix**: 
- Verify Railway backend URL is correct
- Make sure it includes `https://`
- No trailing slash

### Issue 3: Backend Not Running
**Symptom**: Connection refused or timeout
**Fix**: 
- Check Railway logs
- Verify backend service is running
- Check if backend URL is accessible in browser

### Issue 4: CORS Errors
**Symptom**: Browser console shows CORS errors
**Fix**: 
- Should be fixed with latest code (CORS headers added)
- Redeploy Netlify to get latest code

### Issue 5: Extension Not Updated
**Symptom**: Still seeing old error messages
**Fix**: 
- Rebuild extension (see step 7)
- Reload extension in Chrome

## Quick Checklist

- [ ] `NEXT_PUBLIC_BACKEND_URL` is set in Netlify
- [ ] Netlify has been redeployed after setting env var
- [ ] Railway backend is running
- [ ] Railway backend URL is correct
- [ ] Extension is reloaded (if code was updated)
- [ ] Test proxy route directly (see step 4)

## Still Not Working?

1. **Check Browser Console**:
   - Open extension popup
   - Open DevTools (F12)
   - Check Console for detailed error messages

2. **Check Network Tab**:
   - Open DevTools → Network tab
   - Try connecting with extension
   - Look for failed requests to `/api/proxy/instagram/cookie/verify`
   - Check the response/error

3. **Verify URLs**:
   - Frontend: `https://bulkdm-saas.netlify.app`
   - Backend: Your Railway URL
   - Proxy route: `https://bulkdm-saas.netlify.app/api/proxy/instagram/cookie/verify`

4. **Contact Support**:
   - Share the error message from browser console
   - Share Netlify function logs
   - Share Railway backend logs

