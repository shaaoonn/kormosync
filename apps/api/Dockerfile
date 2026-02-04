# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies
RUN npm install

# Generate Prisma client with inline env var to allow build without DB connection
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Copy source code
COPY . .

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy everything from builder
COPY --from=builder /app ./

EXPOSE 8001

CMD ["npx", "ts-node", "src/server.ts"]
