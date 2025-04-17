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

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Expose port 3000
EXPOSE 3000

# Command to run the application
CMD ["npm", "run", "dev"]
