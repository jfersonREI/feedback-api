FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
RUN addgroup -S app && adduser -S app -G app
USER app
EXPOSE 3001
CMD ["node", "src/index.js"]