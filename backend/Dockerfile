# Use full Node 22 Alpine base
FROM node:22-alpine

WORKDIR /usr/src/app

# Install runtime/build deps and netcat for wait script
RUN apk add --no-cache build-base python3 netcat-openbsd

# Install all deps including dev

RUN npm config set fetch-timeout 600000
RUN npm config set registry https://registry.npmjs.org/
RUN npm cache clean --force

COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

RUN chmod +x ./docker/postgrescheck.sh ./docker/start.sh || true

# Generate Prisma client
RUN npx prisma generate || true

# No build command; ts-node will run TS files directly in dev

# Expose port
EXPOSE 4000

CMD ["sh", "-c", "./docker/start.sh"]