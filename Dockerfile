# Multi-stage Dockerfile for CRM Object Sync Service
# This file defines the build process for development and production environments

# ---- Base Stage ----
# Common base image used by all stages
FROM node:20-bullseye-slim AS base
WORKDIR /app

# Install OpenSSL which is required for many Node.js applications
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files first to leverage Docker layer caching
# This means if package.json hasn't changed, we can reuse the cached node_modules
COPY package*.json ./

# ---- Development Stage ----
# Development environment with all dependencies and source code
FROM base AS development
# Install all dependencies including dev dependencies for development
RUN npm install --include=dev
# Copy all source code
COPY . .
# Generate Prisma client for database access
RUN npx prisma generate
# Development entrypoint uses `npm run dev` (defined in docker-compose.override.yml)

# ---- Builder Stage ----
# Compiles TypeScript/JavaScript code for production
FROM development AS builder
# Build the application
RUN npm run build

# ---- Dependencies Stage ----
# Separate stage for production dependencies only
# This helps keep the final image size smaller
FROM base AS deps
# Use npm ci instead of npm install for more reliable builds
# --omit=dev ensures we only install production dependencies
RUN npm ci --omit=dev

# ---- Production Stage ----
# Final production image - only includes what's needed to run the app
FROM node:20-bullseye-slim AS production
WORKDIR /app

# Install OpenSSL in production image
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy only the necessary files from previous stages
# This keeps the production image as small as possible
COPY --from=deps /app/node_modules ./node_modules  # Production dependencies
COPY --from=builder /app/dist ./dist               # Compiled application code
COPY --from=builder /app/package*.json ./          # Package configuration
COPY --from=builder /app/prisma ./prisma          # Prisma schema and migrations

# Generate Prisma client for production
RUN npx prisma generate

# Run as non-root user for security
USER node

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]

# Image metadata
LABEL maintainer="HubSpot"
LABEL description="CRM Object Sync Service"
LABEL version="1.0"
