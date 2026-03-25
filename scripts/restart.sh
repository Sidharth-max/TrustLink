#!/bin/bash

# scripts/restart.sh
# Kills the existing server process and starts a fresh instance.

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

PORT=${PORT:-3001}

echo "═══════════════════════════════════════"
echo "  WhatsApp Trust Manager — Restarting"
echo "═══════════════════════════════════════"

# 1. Kill existing process on the port (if any)
PID=$(lsof -t -i:$PORT)
if [ -n "$PID" ]; then
  echo "Found process $PID on port $PORT. Killing..."
  kill -9 $PID
  sleep 1
fi

# 2. Run migrations to ensure DB is up to date
echo "Running migrations..."
npm run migrate

# 3. Start the server in development mode (with nodemon)
echo "Starting server on port $PORT..."
npm run dev
