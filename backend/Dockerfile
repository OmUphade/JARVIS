FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Create directory for uploads
RUN mkdir -p public/uploads

EXPOSE 8080

ENV NODE_ENV=production

CMD ["node", "server.js"]
