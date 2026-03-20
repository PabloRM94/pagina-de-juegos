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

# Environment variables (configure in Railway dashboard):
# - TURSO_DATABASE_URL: libsql://trip-pablorm94.aws-ap-northeast-1.turso.io
# - TURSO_AUTH_TOKEN: <your-token>

# Start server
CMD ["node", "index.js"]
