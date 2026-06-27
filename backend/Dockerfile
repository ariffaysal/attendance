# Dockerfile for building and running the NestJS backend
# Multi-stage build: build TypeScript, then run production JS

FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm ci

# Copy source and build
COPY backend/ .
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package.json and built output
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Make sure uploads directory exists for ServeStaticModule
RUN mkdir -p /app/uploads

# Install production dependencies only
RUN npm ci --omit=dev

EXPOSE 3001

# Use PORT env var if provided by the host (many platforms set this)
CMD ["node", "dist/main"]
