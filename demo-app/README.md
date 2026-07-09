# TealTiger Demo App

A multi-agent demo that showcases all TealTiger governance capabilities without requiring any API keys.

## What It Demonstrates

| Capability | What Happens |
|---|---|
| **observe()** | Single-line instrumentation wraps any LLM client |
| **Cost Tracking** | Real-time per-agent, per-session, per-request cost monitoring |
| **PII Detection** | Detects SSN, email, phone, credit card in responses |
| **Secret Scanning** | Catches API keys, AWS credentials, connection strings |
| **Behavioral Baseline** | Builds P50/P95/P99 stats, detects drift |
| **Injection Detection** | Identifies prompt injection and jailbreak attempts |
| **Freeze / Kill Switch** | Emergency circuit-breaker halts any agent instantly |
| **Multi-Provider** | OpenAI + Anthropic under unified governance |
| **Audit Trail** | Every decision logged with correlation IDs |

## Quick Start

```bash
cd demo-app
npm install
npm run demo
```

## How It Works

The demo uses **mock LLM providers** that simulate realistic API responses:
- Normal analytical responses
- Responses containing PII (names, SSNs, emails, credit cards)
- Responses containing secrets (AWS keys, API tokens, DB connection strings)
- Prompt injection attempts (jailbreaks, system prompt extraction)

TealTiger's `observe()` wraps these exactly like it would wrap a real OpenAI or Anthropic client. All governance logic runs locally and deterministically.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Demo Application                    │
├─────────────────────────────────────────────────────┤
│  Research Agent ──┐                                  │
│  Support Agent ───┼── observe() ── Mock Providers    │
│  Coding Agent ────┤                                  │
│  Admin Agent ─────┘                                  │
└────────────────────────┬────────────────────────────┘
                         │
                  TealTiger SDK
        ┌────────────────┼────────────────┐
        │                │                │
   Cost Tracker    PII Scanner     Freeze Registry
   Audit Logger    Secret Scan     Behavioral Baseline
```

## For Production

Replace mock providers with real SDK instances:

```ts
import OpenAI from 'openai';
import { observe } from 'tealtiger';

// One line to add governance to any client
const client = observe(new OpenAI());
```
