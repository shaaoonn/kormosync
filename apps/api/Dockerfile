# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Ensure we are in development mode so devDependencies (like prisma) are installed
ENV NODE_ENV=development

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies strictly from lockfile
RUN npm ci

# Generate Prisma client with inline env var
# This ensures it uses the installed local prisma version, not the latest from internet
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Copy source code
COPY . .

# Stage 2: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL (Required for Prisma Client)
RUN apk add --no-cache openssl

# Copy everything from builder
COPY --from=builder /app ./

EXPOSE 8001

CMD ["npx", "ts-node", "src/server.ts"]
