FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY .env ./
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
