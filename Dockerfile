FROM node:20-alpine

WORKDIR /app

# Install python3 and make for node-gyp (better-sqlite3 compilation)
RUN apk add --no-cache python3 make g++

# Copy package files from server folder
COPY server/package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy server source
COPY server/ ./

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start server
CMD ["node", "index.js"]
