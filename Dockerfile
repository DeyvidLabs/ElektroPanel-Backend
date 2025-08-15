# ===== Base =====
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ===== Development =====
FROM base AS dev
RUN npm install --force
COPY . .
EXPOSE 4601
CMD ["npm", "run", "start:dev"]

# ===== Production =====
FROM base AS prod
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main"]