#!/bin/bash

# Configuration
API_URL="http://localhost:3000/api/jobs/process"
INTERVAL=60 # Seconds between checks

echo "==================================================="
echo "   SOCIALORA OVERNIGHT WATCHDOG - STARTED"
echo "==================================================="
echo "Press [CTRL+C] to stop."
echo ""

while true; do
  echo "[$(date '+%H:%M:%S')] Pinging Worker..."
  
  # Send request to process job. We use a mock cookie or env auth if needed.
  # Assuming the endpoint reads from env or simple payload for now.
  # We send a dummy cookie payload because the endpoint expects it structure-wise,
  # though real auth happens via server-side session or improved flow.
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{ "cookies": { "ds_user_id": "WATCHDOG_AUTO" } }')
  
  echo "Response: $RESPONSE"
  
  echo "Sleeping ${INTERVAL}s..."
  sleep $INTERVAL
done
