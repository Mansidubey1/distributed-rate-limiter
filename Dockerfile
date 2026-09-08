# Stage 1: Build React Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build TypeScript Backend
FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/public ./public
COPY --from=frontend-builder /app/backend/public/dashboard-dist ./public/dashboard-dist
RUN npx prisma generate
RUN npm run build

# Stage 3: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci --only=production

COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma ./node_modules/@prisma
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/public ./public
COPY --from=backend-builder /app/backend/src/repositories/lua ./dist/repositories/lua

EXPOSE 3000

CMD ["node", "dist/server.js"]
