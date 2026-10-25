FROM node:20-alpine

WORKDIR /app

# Copy dependency files
COPY services/flight-generator/package*.json ./
RUN npm install --production

# Copy reused flight telemetry simulator and OpenSky live client from server
COPY server/services/adsbSimulator.js ./adsbSimulator.js
COPY server/services/openSkyService.js ./openSkyService.js

# Copy generator runner
COPY services/flight-generator/index.js ./index.js

ENV NODE_ENV=production
ENV KAFKA_BROKERS=kafka:29092
ENV KAFKA_TOPIC=flight-telemetry
ENV GENERATION_INTERVAL_MS=15000

CMD ["node", "index.js"]
