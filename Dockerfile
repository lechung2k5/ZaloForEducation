FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package.json for workspace definition
COPY package*.json ./

# Copy package.json of workspaces to cache dependencies
COPY packages/shared/package*.json ./packages/shared/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install

# Copy source code for building
COPY packages/shared ./packages/shared
COPY backend ./backend

# Build shared package and backend
RUN npm run build -w @zalo-edu/shared
RUN npm run build -w backend

# --- Production Image ---
FROM node:20-alpine AS runner
WORKDIR /app

# Copy package.json and built node_modules
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/backend ./backend

# Expose backend port
EXPOSE 3000

# Start command
CMD ["npm", "run", "start:prod", "-w", "backend"]
