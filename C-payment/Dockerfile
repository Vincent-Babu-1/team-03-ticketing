FROM node:20-alpine

WORKDIR /C-ticket-purchase

COPY service.js .

COPY waitlist.js .

EXPOSE 3003

CMD ["node", "service.js", "&&", "waitlist.js"]
