FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./
COPY db ./db
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY views ./views
COPY public ./public
COPY images ./images
COPY logo.png mobile.png watches.png laptop.png shoes.png clothes.png electronics.png ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
