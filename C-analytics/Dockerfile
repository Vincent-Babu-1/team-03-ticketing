FROM node:18-alpine
WORKDIR /app
COPY C-analytics/package*.json ./
RUN npm install
COPY . .
CMD ["node", "C-analytics/worker.js"]