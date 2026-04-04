# TealTiger TypeScript SDK — Production Image
FROM node:20-alpine

LABEL maintainer="TealTiger Team <reachout@tealtiger.ai>"
LABEL org.opencontainers.image.title="TealTiger TypeScript SDK"
LABEL org.opencontainers.image.description="AI agent security SDK for TypeScript — guardrails, cost tracking, policy management"
LABEL org.opencontainers.image.version="1.1.1"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

RUN npm install tealtiger@latest && npm cache clean --force

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
CMD ["node"]
