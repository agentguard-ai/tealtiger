# TealTiger SDK - Multi-arch Container Image
# Published to GHCR and Docker Hub

FROM node:20-alpine

LABEL maintainer="TealTiger Team <reachout@tealtiger.ai>"
LABEL description="TealTiger - AI agent security SDK with guardrails, cost tracking, and policy management"
LABEL org.opencontainers.image.source="https://github.com/agentguard-ai/tealtiger"
LABEL org.opencontainers.image.url="https://tealtiger.ai"
LABEL org.opencontainers.image.documentation="https://docs.tealtiger.ai"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

# Install tealtiger from npm (production-ready)
RUN npm install tealtiger@latest && \
    npm cache clean --force

# Copy README for reference
COPY README.md ./

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production

CMD ["node"]
