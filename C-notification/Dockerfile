FROM node:20-alpine

WORKDIR /C-ticket-purchase

COPY notif-service.js .

COPY notif-worker.js .

EXPOSE 3004

CMD ["node", "notif-service.js", "&&", "notif-worker.js"]