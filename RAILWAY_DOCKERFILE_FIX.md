# Railway Dockerfile Deployment Fix

## Issue: "The executable `cd` could not be found"

### Problem
Railway was trying to execute `cd backend && npm run start:prod` from `railway.json`, but `cd` is a shell builtin and doesn't exist as an executable in the container.

### Solution
1. **Updated `railway.json`**:
   - Changed builder to `DOCKERFILE` (explicit)
   - Removed `startCommand` (Dockerfile CMD handles it)
   - Railway will now use the Dockerfile's CMD directive

2. **Dockerfile Configuration**:
   - WORKDIR is set to `/app/backend` (no need for `cd`)
   - CMD uses exec form: `["npm", "run", "start:prod"]`
   - This is the recommended Docker practice

### Railway Settings

**In Railway Dashboard:**
1. Go to **Settings** → **Build & Deploy**
2. **Root Directory**: Leave empty (root) or `.`
3. **Build Command**: Leave empty (uses Dockerfile)
4. **Start Command**: Leave empty (uses Dockerfile CMD)
5. Railway will automatically detect and use the `Dockerfile`

### How It Works

1. Railway detects `Dockerfile` in root
2. Builds the Docker image using the Dockerfile
3. Sets WORKDIR to `/app/backend` during build
4. Runs `CMD ["npm", "run", "start:prod"]` when container starts
5. No `cd` command needed - WORKDIR is already set

### Verification

After redeploying, check:
- ✅ Build succeeds
- ✅ Container starts without "cd could not be found" error
- ✅ Application runs on port 3001
- ✅ Logs show "🚀 Backend running on http://localhost:3001"

### If Still Having Issues

1. **Clear Railway cache**:
   - Delete the service
   - Create a new service
   - Connect the repo
   - Railway will detect Dockerfile automatically

2. **Check Railway Settings**:
   - Ensure no custom start command is set
   - Ensure Root Directory is empty or `.`
   - Ensure Build Command is empty

3. **Verify Dockerfile**:
   - Make sure WORKDIR is `/app/backend`
   - Make sure CMD is `["npm", "run", "start:prod"]`
   - Make sure all paths are correct

