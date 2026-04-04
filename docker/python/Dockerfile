# TealTiger Python SDK — Production Image
FROM python:3.12-slim

LABEL maintainer="TealTiger Team <reachout@tealtiger.ai>"
LABEL org.opencontainers.image.title="TealTiger Python SDK"
LABEL org.opencontainers.image.description="AI agent security SDK for Python — guardrails, cost tracking, policy management"
LABEL org.opencontainers.image.version="1.1.1"
LABEL org.opencontainers.image.licenses="Apache-2.0"

WORKDIR /app

RUN pip install --no-cache-dir tealtiger && \
    pip cache purge

RUN useradd -m tealtiger && chown -R tealtiger:tealtiger /app
USER tealtiger

ENV PYTHONUNBUFFERED=1
CMD ["python"]
