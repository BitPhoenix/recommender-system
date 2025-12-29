FROM node:20-alpine

WORKDIR /app

COPY seeds/package*.json ./
RUN npm ci

COPY seeds/ ./
RUN npm run build

CMD ["node", "dist/seed.js"]
