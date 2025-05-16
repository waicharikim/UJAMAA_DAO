# Use full Node 22 Alpine base
FROM node:22-alpine

WORKDIR /usr/src/app

# Install all deps including dev
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# No build command; ts-node will run TS files directly in dev

# Expose port
EXPOSE 4000

CMD ["npm", "run", "dev"]