# --- Stage 1: Build the React Frontend ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copy frontend dependencies
COPY package.json ./

# Install frontend dependencies
# We use a wildcard for @google/genai in package.json to avoid version errors
RUN npm install

# Copy source code
COPY . .

# Accept API Key from Docker Compose (defined in args)
ARG API_KEY
# Make it available to Vite during the build process
ENV API_KEY=$API_KEY

# Build the app (outputs to /app/dist)
RUN npm run build

# --- Stage 2: Setup the Backend Server ---
FROM node:18-alpine

# Install build tools required for better-sqlite3 (Python, Make, G++)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy backend dependencies
COPY server/package.json ./

# Install backend dependencies (production only)
RUN npm install --production

# Copy backend server code
COPY server/server.js ./

# Copy the built React app from Stage 1 to the server's public folder
COPY --from=builder /app/dist ./public

# Create data directory for SQLite
RUN mkdir -p /data

# Configuration
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/families.db

# Expose the port
EXPOSE 3000

# Start the Node server
CMD ["npm", "start"]
