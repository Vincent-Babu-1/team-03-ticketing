FROM node:20-alpine
WORKDIR /app
COPY redis.js ./redis.js

COPY C-refund/package*.json ./
RUN npm install
COPY C-refund/ .