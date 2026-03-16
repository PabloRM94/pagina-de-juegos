FROM node:20-alpine

WORKDIR /app

# Install python3 and make for node-gyp
RUN apk add --no-cache python3 make g++

# Copy package files
COPY server/package*.json ./
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source
COPY server/ ./
COPY *.json ./

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
