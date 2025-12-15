# Quick Setup: Netlify Environment Variable

## Step 1: Get Railway Backend URL

1. Go to https://railway.app
2. Log in to your account
3. Click on your backend service/project
4. Go to **Settings** → **Networking**
5. Find **Public Domain** (it will look like: `https://your-app.up.railway.app`)
6. **Copy this URL** - you'll need it in Step 2

## Step 2: Set Netlify Environment Variable

1. Go to https://app.netlify.com
2. Log in to your account
3. Click on your site: **bulkdm-saas** (or search for it)
4. Go to **Site settings** (gear icon in the top menu)
5. Scroll down to **Environment variables** (in the left sidebar)
6. Click **Add a variable**
7. Enter:
   - **Key**: `NEXT_PUBLIC_BACKEND_URL`
   - **Value**: Paste your Railway URL from Step 1 (e.g., `https://your-app.up.railway.app`)
8. Click **Save**

## Step 3: Redeploy Netlify

1. Still in Netlify, go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**
3. Wait 2-3 minutes for deployment to complete

## Step 4: Test

1. Reload your extension in Chrome:
   - Go to `chrome://extensions/`
   - Find "BulkDM - Instagram Session Grabber"
   - Click the refresh icon 🔄

2. Test the extension:
   - Open Instagram
   - Click the extension icon
   - Click "Grab Instagram Session"
   - It should now connect successfully! ✅

## Quick Copy-Paste Commands

If you prefer using the command line, you can also set it via Netlify CLI:

```bash
# Install Netlify CLI (if not already installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Set the environment variable (replace YOUR_RAILWAY_URL with your actual Railway URL)
netlify env:set NEXT_PUBLIC_BACKEND_URL "YOUR_RAILWAY_URL" --context production

# Trigger a new deploy
netlify deploy --prod
```

## Verification

To verify the environment variable is set correctly:

1. In Netlify Dashboard → Site settings → Environment variables
2. You should see `NEXT_PUBLIC_BACKEND_URL` listed
3. The value should be your Railway backend URL

## Troubleshooting

**If the extension still doesn't work:**

1. **Check the Railway URL is correct:**
   - Visit your Railway URL in a browser
   - You should see a response (might be an error, but it means it's accessible)

2. **Check Netlify deployment logs:**
   - Go to Deploys tab → Latest deploy → View logs
   - Look for any errors related to environment variables

3. **Test the proxy route directly:**
   - Open browser console (F12)
   - Run: `fetch('https://bulkdm-saas.netlify.app/api/proxy/instagram/cookie/verify', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({cookies: {}})}).then(r => r.json()).then(console.log)`
   - If you get "Backend URL not configured", the env var isn't set
   - If you get a different error, the proxy is working but backend might have issues

## Need Help?

If you're stuck, share:
- Your Railway backend URL (you can check if it's accessible)
- Any error messages from the extension
- Netlify deployment logs

