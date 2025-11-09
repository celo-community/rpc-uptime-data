FROM node:22.9.0 AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    pkg-config \
    libusb-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY yarn.lock ./
RUN yarn
COPY . .

RUN yarn build

FROM node:22.9.0 AS runtime

WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.dist ./.dist

RUN yarn install

ENV NETWORK_ID=development
ENV STARTING_BLOCK=17280
ENV CHUNK_SIZE=100
ENV NODE_ENV=production
ENV FORCE_SYNC=false
ENV DEBUG=false
ENV QUERY_LOGGING=false
ENV AUTH_API_IDENTIFIER=https://api.vido.atalma.io
ENV AUTH_ISSUER=https://dev-e4qmxpo7.us.auth0.com/
ENV DB_HOST=mysql_db
ENV DB_NAME=vido_rivera
ENV DB_USER=root
ENV UPTIME_BULK_INSERT_SIZE=17280
ENV BAKLAVA_EXTERNAL_NODE=https://baklava-forno.celo-testnet.org
ENV BAKLAVA_LOCAL_NODE=http://celo-baklava-fullnode:8547
ENV MAINNET_LOCAL_NODE=http://celo-mainnet-fullnode:8545
ENV RPC_TIMER_MS=300000

RUN useradd -m appuser
USER appuser

EXPOSE 3006
CMD ["node", ".dist/index.js"]