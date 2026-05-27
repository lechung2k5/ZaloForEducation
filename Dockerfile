FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package.json for workspace definition
COPY package*.json ./

# Copy package.json of workspaces to cache dependencies
COPY packages/shared/package*.json ./packages/shared/
COPY backend/package*.json ./backend/
COPY apps/web/package*.json ./apps/web/

# Install dependencies
RUN npm install

# Copy source code for building
COPY packages/shared ./packages/shared
COPY backend ./backend
COPY apps/web ./apps/web

# Build shared package and backend
RUN npm run build -w @zalo-edu/shared
RUN npm run build -w backend

# Build frontend with VITE_API_URL pointing to Nginx /api
ENV VITE_API_URL=/api
RUN npm run build -w apps/web

# --- Production Image ---
FROM node:20-alpine AS backend
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

# --- Frontend Production Image ---
FROM nginx:alpine AS frontend
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
