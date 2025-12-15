#!/bin/bash

# Quick script to set NEXT_PUBLIC_BACKEND_URL in Netlify
# Usage: ./set-env.sh https://your-railway-url.up.railway.app

if [ -z "$1" ]; then
    echo "❌ Error: Please provide your Railway backend URL"
    echo ""
    echo "Usage: ./set-env.sh https://your-railway-url.up.railway.app"
    echo ""
    echo "To find your Railway URL:"
    echo "1. Go to https://railway.app"
    echo "2. Open your backend service"
    echo "3. Go to Settings → Networking"
    echo "4. Copy the Public Domain URL"
    exit 1
fi

RAILWAY_URL="$1"

echo "🚀 Setting NEXT_PUBLIC_BACKEND_URL in Netlify..."
echo "📍 Railway URL: $RAILWAY_URL"
echo ""

cd frontend

# Set for production context
npx netlify env:set NEXT_PUBLIC_BACKEND_URL "$RAILWAY_URL" --context production

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully set NEXT_PUBLIC_BACKEND_URL = $RAILWAY_URL"
    echo ""
    echo "🔄 Triggering new deployment..."
    npx netlify deploy --prod --dir=.
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Deployment triggered successfully!"
        echo "📝 Check deployment status at: https://app.netlify.com/sites/bulkdm-saas/deploys"
    else
        echo ""
        echo "⚠️  Environment variable set, but deployment failed"
        echo "You can trigger deployment manually from Netlify Dashboard"
    fi
else
    echo ""
    echo "❌ Failed to set environment variable"
    exit 1
fi

