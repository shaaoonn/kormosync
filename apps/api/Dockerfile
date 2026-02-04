# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for ts-node)
RUN npm install

# Dummy DATABASE_URL for prisma generate (actual URL will be provided at runtime)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma client
RUN npx prisma generate

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
