FROM node:20-alpine
WORKDIR /app

# Copy shared redis.js from root
COPY redis.js ./redis.js

# Copy the notification service files
COPY C-notification/package*.json ./
RUN npm install
COPY C-notification/ .
