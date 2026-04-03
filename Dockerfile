# TealTiger SDK — Docker Image
# AI agent security with guardrails, cost tracking, and policy management
# https://tealtiger.ai | https://docs.tealtiger.ai

FROM node:20-alpine

LABEL maintainer="TealTiger Team <reachout@tealtiger.ai>"
LABEL org.opencontainers.image.title="TealTiger SDK"
LABEL org.opencontainers.image.description="AI agent security SDK with guardrails, cost tracking, and policy management for 7 LLM providers"
LABEL org.opencontainers.image.version="1.1.1"
LABEL org.opencontainers.image.vendor="TealTiger"
LABEL org.opencontainers.image.source="https://github.com/agentguard-ai/tealtiger"
LABEL org.opencontainers.image.url="https://tealtiger.ai"
LABEL org.opencontainers.image.documentation="https://docs.tealtiger.ai"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

# Install tealtiger from npm
RUN npm install tealtiger@latest && \
    npm cache clean --force

COPY README.md ./

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production

CMD ["node"]
