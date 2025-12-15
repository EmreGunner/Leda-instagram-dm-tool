#!/bin/bash

# Setup Netlify Environment Variable for BulkDM
# This script helps set NEXT_PUBLIC_BACKEND_URL in Netlify

echo "🚀 BulkDM - Netlify Environment Variable Setup"
echo "================================================"
echo ""

# Check if Railway URL is provided as argument
if [ -z "$1" ]; then
    echo "📝 Please provide your Railway backend URL"
    echo ""
    echo "Usage: ./setup-netlify-env.sh https://your-app.up.railway.app"
    echo ""
    echo "To find your Railway URL:"
    echo "1. Go to https://railway.app"
    echo "2. Open your backend service"
    echo "3. Go to Settings → Networking"
    echo "4. Copy the Public Domain URL"
    echo ""
    read -p "Enter your Railway backend URL: " RAILWAY_URL
else
    RAILWAY_URL="$1"
fi

# Validate URL format
if [[ ! $RAILWAY_URL =~ ^https?:// ]]; then
    echo "❌ Error: URL must start with http:// or https://"
    exit 1
fi

echo ""
echo "✅ Railway URL: $RAILWAY_URL"
echo ""

# Check if logged in to Netlify
echo "🔐 Checking Netlify login status..."
if npx netlify status 2>&1 | grep -q "Logged in"; then
    echo "✅ Already logged in to Netlify"
else
    echo "⚠️  Not logged in. Opening browser for authentication..."
    echo "Please log in to Netlify in the browser window that opens."
    npx netlify login
fi

echo ""
echo "📦 Setting environment variable in Netlify..."
echo ""

# Get the site name (bulkdm-saas)
SITE_NAME="bulkdm-saas"

# Set the environment variable for production
npx netlify env:set NEXT_PUBLIC_BACKEND_URL "$RAILWAY_URL" --context production --site "$SITE_NAME"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully set NEXT_PUBLIC_BACKEND_URL = $RAILWAY_URL"
    echo ""
    echo "🔄 Next steps:"
    echo "1. The environment variable is now set in Netlify"
    echo "2. You need to trigger a new deployment:"
    echo "   npx netlify deploy --prod"
    echo ""
    echo "Or trigger it from Netlify Dashboard:"
    echo "   https://app.netlify.com/sites/$SITE_NAME/deploys"
    echo ""
    read -p "Would you like to trigger a deployment now? (y/n): " DEPLOY_NOW
    
    if [ "$DEPLOY_NOW" = "y" ] || [ "$DEPLOY_NOW" = "Y" ]; then
        echo ""
        echo "🚀 Triggering deployment..."
        npx netlify deploy --prod --dir=frontend
    else
        echo ""
        echo "📝 To deploy later, run:"
        echo "   npx netlify deploy --prod --dir=frontend"
    fi
else
    echo ""
    echo "❌ Failed to set environment variable"
    echo "Please check:"
    echo "1. You're logged in to Netlify"
    echo "2. The site name is correct (bulkdm-saas)"
    echo "3. You have permissions to modify the site"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""

