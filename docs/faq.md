# Frequently Asked Questions

## Does TealTiger call an LLM for governance decisions?

No. TealTiger evaluates governance decisions deterministically from the active
policy, request metadata, and runtime context. The same input and policy produce
the same decision every time, without asking a model to judge the request.

## Does TealTiger add latency to my requests?

TealTiger is designed to add less than 5ms per governance evaluation in normal
runtime paths. Provider network latency and model generation time usually
dominate the total request time.

## Do I need a server or sidecar?

No. TealTiger runs in-process with your application, so you can add governance
without deploying a separate service. Teams that want centralized collection or
dashboards can still export evidence and events to their own infrastructure.

## Which providers are supported?

TealTiger documents core provider clients for OpenAI, Anthropic, Google Gemini,
AWS Bedrock, Azure OpenAI, Cohere, and Mistral AI across the TypeScript and
Python SDKs. Additional v1.3 providers, including DeepSeek, Groq, Together AI,
Hugging Face TGI, and xAI/Grok, are currently supported in the Python SDK and
tracked as planned TypeScript SDK parity. Provider-specific keys should stay in
environment variables or other secret-management systems, not in source files.

## Is TealTiger free?

Yes. TealTiger is open source and licensed under Apache 2.0. That means you can
use, modify, and distribute it under the terms of the repository license.

## How do I report a security issue?

Follow the repository [Security Policy](../SECURITY.md). Do not open a public
GitHub issue for a vulnerability if the security policy asks for private
reporting first.

## Can I use TealTiger with my framework?

Usually, yes. The repository documents platform and framework integrations for
AWS Bedrock Agents, AWS AgentCore, Azure AI Agent Service, LangChain, CAMEL-AI,
Haystack, and the Vercel AI SDK, with additional framework adapters planned or
documented in the integration specs.

## What is the difference between ENFORCE, MONITOR, and REPORT_ONLY?

`ENFORCE` is the production-style mode: denied decisions can block or redact the
request. `MONITOR` evaluates policy and records decisions while allowing the
request through. `REPORT_ONLY` is for low-impact reporting workflows where teams
want governance output without changing runtime behavior.
