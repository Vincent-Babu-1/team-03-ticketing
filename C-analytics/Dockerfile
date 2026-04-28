FROM node:18-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY C-analytics/package*.json ./
RUN npm install
COPY . .
CMD ["node", "C-analytics/worker.js"]