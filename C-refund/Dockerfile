FROM node:20-alpine
WORKDIR /C-refund
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["node", "service.js"]