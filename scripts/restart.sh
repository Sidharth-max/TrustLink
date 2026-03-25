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

# 1. Check for 'db' host in DATABASE_URL (common misconfiguration)
if [[ "$DATABASE_URL" == *"@db:"* ]]; then
  echo "⚠️  WARNING: Your DATABASE_URL contains '@db'. If you are not using Docker,"
  echo "   this will fail with 'getaddrinfo EAI_AGAIN db'."
  echo "   Please change '@db' to '@localhost' in your .env file."
  echo ""
fi

# 2. Kill existing process on the port (if any)
echo "Looking for processes on port $PORT..."
PID=""
if command -v lsof >/dev/null 2>&1; then
  PID=$(lsof -t -i:$PORT)
elif command -v fuser >/dev/null 2>&1; then
  PID=$(fuser $PORT/tcp 2>/dev/null | awk '{print $NF}')
fi

if [ -n "$PID" ]; then
  echo "Found process(es) $PID on port $PORT. Killing..."
  kill -9 $PID 2>/dev/null
  sleep 2
else
  # Fallback: kill any node process running our server
  pkill -f "node src/server.js" 2>/dev/null
  sleep 1
fi

# 2. Run migrations to ensure DB is up to date
echo "Running migrations..."
npm run migrate

# 3. Start the server in development mode (with nodemon)
echo "Starting server on port $PORT..."
npm run dev
