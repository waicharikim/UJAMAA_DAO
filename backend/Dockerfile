# Use lightweight Node Alpine image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files first (for better caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY . .
COPY ./dist ./dist

# Expose default port
EXPOSE 4000

# Start the app
CMD ["node", "dist/index.js"]