FROM node:20-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies for server
RUN cd server && npm install --omit=dev

# Copy server code
COPY server/index.js ./server/index.js
COPY server/routes ./server/routes
COPY server/services ./server/services
COPY server/middleware ./server/middleware
COPY server/config ./server/config

# Copy pre-built client distribution
COPY client/dist ./client/dist

EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production \
    CLICKHOUSE_HOST=clickhouse \
    CLICKHOUSE_PORT=8123 \
    CLICKHOUSE_USER=ch_user \
    CLICKHOUSE_PASSWORD=ch_password \
    CLICKHOUSE_DB=default

CMD ["node", "server/index.js"]
