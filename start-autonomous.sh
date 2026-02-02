#!/bin/bash

# AUTONOMOUS LEAD GENERATION ENGINE LAUNCHER
# Starts the engine via API endpoint

echo "🤖 AUTONOMOUS LEAD GENERATION ENGINE"
echo "====================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ Next.js server is not running!"
    echo "   Please start it with: npm run dev"
    exit 1
fi

echo "✅ Server is running"
echo ""
echo "🚀 Starting autonomous engine..."
echo "   Target: 4000 real estate leads"
echo "   Check autonomous_engine.log for progress"
echo ""

# Start the engine
response=$(curl -s -X POST http://localhost:3000/api/autonomous/start \
  -H "Content-Type: application/json")

if echo "$response" | grep -q "success"; then
    echo "✅ Engine started successfully!"
    echo ""
    echo "📊 Monitor progress:"
    echo "   - Logs: tail -f autonomous_engine.log"
    echo "   - Status: curl http://localhost:3000/api/autonomous/status"
    echo ""
    echo "💡 The engine will run in the background until 4000 leads are collected"
    echo "   It will auto-commit to git every 10 cycles"
else
    echo "❌ Failed to start engine:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    exit 1
fi
