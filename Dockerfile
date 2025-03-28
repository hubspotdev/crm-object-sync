# Use Node.js LTS version with Debian
FROM node:20-bullseye-slim

# Set working directory
WORKDIR /app

# Install OpenSSL and other required dependencies
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev pkg-config build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Remove any existing prisma installations to avoid conflicts
RUN rm -rf node_modules/@prisma node_modules/.prisma

# Install dependencies with exact matching versions
RUN npm install && \
    npm install --save-exact prisma@4.16.2 @prisma/client@4.16.2

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma@4.16.2 generate

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "dev"]
