# ─────────────────────────────────────────
# WhatsApp Trust Manager — Dockerfile
# ─────────────────────────────────────────

FROM node:18-alpine

# Install dependencies needed for some node-gyp builds (if any)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install --production

# Copy application source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# App runs on 3000 by default
EXPOSE 3001

# Start command: run migrations then start server
# Using a shell form to allow environment variable expansion
CMD npm run migrate && npm start
