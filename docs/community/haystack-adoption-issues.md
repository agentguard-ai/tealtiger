# Haystack Adoption — GitHub Project Issues

> **Instructions:** Create a GitHub Project (Board view / Kanban) with columns:
> `Backlog` | `Ready` | `In Progress` | `Review` | `Done`
>
> Labels to create: `documentation`, `devrel`, `engineering`, `community`, `marketing`, `good-first-issue`, `priority:high`, `priority:medium`, `priority:low`, `haystack`
>
> Milestone: **Haystack Adoption Sprint 1** (2 weeks)

## File Location Rules

All code, docs, and examples for Haystack integration live inside the package:

```
packages/haystack-tealtiger/
├── src/haystack_integrations/components/connectors/tealtiger/  ← component code
├── examples/                                                    ← recipe scripts
├── docs/                                                        ← recipe docs (markdown)
│   ├── recipes/
│   │   ├── compliant-enterprise-rag.md
│   │   ├── agent-circuit-breaker.md
│   │   └── injection-defense.md
│   ├── templates/
│   └── guides/
├── tests/                                                       ← unit + property tests
├── README.md                                                    ← MUST be updated with recipes
└── pyproject.toml
```

**Rules:**
1. All example scripts go in `packages/haystack-tealtiger/examples/`
2. All recipe documentation goes in `packages/haystack-tealtiger/docs/`
3. The package `README.md` MUST be updated to reference new recipes/components
4. NO generic docs outside the package (keep everything co-located)
5. Component code goes in `src/haystack_integrations/components/connectors/tealtiger/`

---

## Issue 1: Recipe A — Compliant Enterprise RAG Pipeline (PII Redaction)

**Labels:** `documentation`, `engineering`, `haystack`, `priority:high`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create a complete, drop-in pipeline recipe showing TealTiger PII redaction between Haystack's document retriever and LLM generator.

### Problem Being Solved
Haystack TopK Document Retrievers pull dirty data (SSNs, API keys, customer PII) from vector databases and pass it to OpenAIGenerator unfiltered.

### Deliverables
- [ ] `TealTigerPIIRedactor` component in `packages/haystack-tealtiger/src/haystack_integrations/components/connectors/tealtiger/pii_redactor.py`
- [ ] Complete pipeline script: `packages/haystack-tealtiger/examples/compliant_enterprise_rag.py`
- [ ] Recipe doc: `packages/haystack-tealtiger/docs/recipes/compliant-enterprise-rag.md`
- [ ] Unit tests: `packages/haystack-tealtiger/tests/test_pii_redactor.py`
- [ ] **Update `packages/haystack-tealtiger/README.md`** — add Recipe A section with copy-paste code

### Technical Requirements
- Must use Haystack 2.x `@component` decorator pattern
- Input: `documents: List[Document]` → Output: `clean_documents: List[Document]`
- Detect: email, SSN, credit_card, phone_number, API keys
- Action modes: `redact` (replace with [REDACTED]) or `flag` (observe only)
- Export from package `__init__.py`

### Acceptance Criteria
- Pipeline runs end-to-end with `pip install haystack-ai tealtiger-haystack`
- PII is scrubbed AFTER retrieval, before LLM sees it
- Works with InMemoryDocumentStore and any vector DB retriever
- README.md updated with recipe reference

---

## Issue 2: Recipe B — Infinite Agent Loop Circuit Breaker

**Labels:** `documentation`, `engineering`, `haystack`, `priority:high`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create a drop-in circuit breaker component for Haystack multi-agent/tool-calling loops that prevents runaway costs.

### Problem Being Solved
Multi-agent Haystack pipelines with tool-calling loops can spiral out of control — agents bounce back and forth burning hundreds of dollars in API credits.

### Deliverables
- [ ] `TealTigerCircuitBreaker` component in `packages/haystack-tealtiger/src/haystack_integrations/components/connectors/tealtiger/circuit_breaker.py`
- [ ] Complete pipeline script: `packages/haystack-tealtiger/examples/agent_circuit_breaker.py`
- [ ] Recipe doc: `packages/haystack-tealtiger/docs/recipes/agent-circuit-breaker.md`
- [ ] Unit tests: `packages/haystack-tealtiger/tests/test_circuit_breaker.py`
- [ ] **Update `packages/haystack-tealtiger/README.md`** — add Recipe B section with copy-paste code

### Technical Requirements
- Configurable: `max_cost_per_session`, `max_consecutive_failures`, `max_iterations`
- Action on break: `terminate` or `refer` (human escalation)
- Tracks cost using TealTiger's built-in cost estimator
- Emits structured audit trail on break
- Export from package `__init__.py`

### Acceptance Criteria
- Agent loop terminates cleanly when cost exceeds threshold
- Clear error message: "Circuit breaker triggered: cost exceeded $0.50"
- Audit trail shows exactly which iteration caused the break
- README.md updated with recipe reference

---

## Issue 3: Recipe C — Inter-Agent Prompt Injection Defense

**Labels:** `documentation`, `engineering`, `haystack`, `priority:high`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create a TealGuard component that validates input between agents, blocking indirect prompt injections from untrusted data sources.

### Problem Being Solved
In multi-agent pipelines, Agent 1 may read untrusted content (emails, web pages) containing injection attacks targeting downstream agents.

### Deliverables
- [ ] `TealTigerGuardComponent` in `packages/haystack-tealtiger/src/haystack_integrations/components/connectors/tealtiger/guard_component.py`
- [ ] Complete pipeline script: `packages/haystack-tealtiger/examples/injection_defense.py`
- [ ] Recipe doc: `packages/haystack-tealtiger/docs/recipes/injection-defense.md`
- [ ] Unit tests: `packages/haystack-tealtiger/tests/test_guard_component.py`
- [ ] **Update `packages/haystack-tealtiger/README.md`** — add Recipe C section with copy-paste code

### Technical Requirements
- Detect: `prompt_injection`, `jailbreak`, `instruction_override`
- Modes: `enforce` (block) or `refer` (escalate to human)
- Input: any text/string field → Output: `clean_output` or blocked
- Must not alter legitimate tool output
- Export from package `__init__.py`

### Acceptance Criteria
- Known injection payloads (DAN, "ignore previous instructions") are caught
- Legitimate tool output passes through unchanged
- REFER mode emits structured escalation receipt
- README.md updated with recipe reference

---

## Issue 4: 1-Line Observe Mode Component

**Labels:** `engineering`, `haystack`, `priority:high`, `good-first-issue`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Build a zero-risk, zero-config `TealTigerObserver` component that sits in any pipeline, monitors everything, blocks nothing.

### Problem Being Solved
Developers fear that security tools will break their existing pipelines or add latency. They need a safe way to evaluate before committing.

### Deliverables
- [ ] `TealTigerObserver` component in `packages/haystack-tealtiger/src/haystack_integrations/components/connectors/tealtiger/observer.py`
- [ ] Example: `packages/haystack-tealtiger/examples/observe_mode.py`
- [ ] `.report()` method returning cost stats, PII detections, injection attempts
- [ ] Unit tests: `packages/haystack-tealtiger/tests/test_observer.py`
- [ ] **Update `packages/haystack-tealtiger/README.md`** — add "Observe Mode" section prominently (entry point for new users)
- [ ] Zero behavior change to the pipeline (passthrough)

### Marketing Hook
> "Drop this into your existing Haystack pipeline. It changes zero logic. Let it run for 48 hours. See exactly how much money you're wasting and where users are injecting prompts."

### Acceptance Criteria
- Adding the component changes zero pipeline output
- After N runs, `.report()` shows actionable telemetry
- <1ms additional latency per invocation

---

## Issue 5: Pre-Built Policy Templates

**Labels:** `engineering`, `documentation`, `haystack`, `priority:medium`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create 5 pre-configured guardrail templates mapped to popular enterprise use cases so developers can secure pipelines with one parameter.

### Templates to Build
- [ ] `healthcare-guard` — PHI/HIPAA compliance, PII redaction, data classification
- [ ] `financial-rag` — Injection blocking, data boundary enforcement
- [ ] `agent-loop-safe` — Budget limits, circuit breaker, iteration caps
- [ ] `eu-ai-act` — Audit trail, deterministic decisions, human escalation
- [ ] `zero-config` — Observe-only, full telemetry, zero blocking

### File Locations
- Template definitions: `packages/haystack-tealtiger/src/haystack_integrations/components/connectors/tealtiger/templates/`
- Template docs: `packages/haystack-tealtiger/docs/templates/`
- Example usage: `packages/haystack-tealtiger/examples/template_*.py`
- **Update `packages/haystack-tealtiger/README.md`** — add "Pre-Built Templates" section

### Usage Pattern
```python
from haystack_integrations.components.connectors.tealtiger import TealTigerGovernanceComponent
guard = TealTigerGovernanceComponent(preset='financial-rag')
```

### Acceptance Criteria
- Each template works with zero additional configuration
- Templates are well-documented with what they detect/block
- Unit tests for each template's policy behavior

---

## Issue 6: Haystack Quickstart Template Repository

**Labels:** `engineering`, `documentation`, `priority:high`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create a polished GitHub template repository that lets developers spin up a fully secured, cost-tracked Haystack agent in under 60 seconds.

### Deliverables
- [ ] Template repo: `tealtiger/haystack-secure-starter`
- [ ] Single command setup: `pip install -r requirements.txt && python quickstart.py`
- [ ] Includes: RAG pipeline + PII guard + cost tracker + circuit breaker
- [ ] Clear README with GIF/screenshot of terminal output
- [ ] GitHub "Use this template" button enabled
- [ ] Uses components from published `tealtiger-haystack` package
- [ ] Add `packages/haystack-tealtiger/docs/guides/quickstart.md` linking to the template repo
- [ ] **Update `packages/haystack-tealtiger/README.md`** — add "1-Minute Quickstart" link at top

### Acceptance Criteria
- Works in under 60 seconds from `git clone` to running pipeline
- Shows governance decisions in terminal output
- Includes sample data with mock PII to demonstrate redaction
- All imports use `haystack_integrations.components.connectors.tealtiger`
- Python 3.10+ compatible

---

## Issue 7: PR Cookbook to deepset/haystack-tutorials

**Labels:** `devrel`, `community`, `documentation`, `priority:high`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Open a Pull Request to the official Haystack tutorials repository with a Jupyter notebook demonstrating TealTiger integration.

### Deliverables
- [ ] Jupyter notebook: "Securing Multi-Agent Pipelines against Runaway Costs and PII Leaks using TealTiger"
- [ ] Follows deepset's tutorial format and style guide
- [ ] Includes: problem statement, before/after comparison, full runnable code
- [ ] PR submitted to `deepset-ai/haystack-tutorials`

### Prerequisites
- Recipes A, B, C must be complete (Issues 1-3)
- Package must be pip-installable

### Acceptance Criteria
- Notebook runs end-to-end in Google Colab
- Follows deepset's contribution guidelines
- PR description clearly explains value to Haystack community

---

## Issue 8: deepset Discord Community Engagement Plan

**Labels:** `devrel`, `community`, `priority:medium`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Develop a community engagement plan for the deepset Discord, targeting channels where developers discuss cost overruns, security, and agent issues.

### This is NOT a coding task

### Deliverables
- [ ] Identify top 10 relevant Discord threads from last 30 days
- [ ] Draft 5 response templates (helpful, non-spammy, includes pipeline recipe)
- [ ] Set up alerts/notifications for keywords: "cost", "budget", "PII", "injection", "loop", "infinite"
- [ ] Weekly engagement log template

### Guidelines
- Never spam — only respond to genuine pain points
- Always include runnable code
- Format: "We built an integration for exactly this. Here's the drop-in recipe: [code]"
- Link to official Haystack integration page

### Acceptance Criteria
- Response templates reviewed and approved
- At least 3 genuine, helpful replies posted in first week
- Zero complaints about spam or self-promotion

---

## Issue 9: "Governed by TealTiger" Badge & README Strategy

**Labels:** `marketing`, `community`, `priority:low`, `good-first-issue`
**Milestone:** Haystack Adoption Sprint 1
**Assignee:** _unassigned_

### Description
Create a clean markdown badge and encourage Haystack open-source developers to add it to their READMEs.

### Deliverables
- [ ] Badge SVG design (teal color, "Governed by TealTiger" text)
- [ ] Shields.io compatible badge URL
- [ ] Markdown snippet for copy-paste
- [ ] Add badge to our own haystack-tealtiger package README
- [ ] Outreach template for asking OSS projects to adopt the badge

### Badge Markdown
```markdown
[![Governed by TealTiger](https://img.shields.io/badge/Governed%20by-TealTiger-00897B?style=flat&logo=data:image/svg+xml;base64,...)](https://tealtiger.ai)
```

### Acceptance Criteria
- Badge renders correctly in GitHub markdown
- Looks professional alongside other common badges
- Links to tealtiger.ai integration page

---

## Issue 10: Haystack Cost Optimization GitHub Action

**Labels:** `engineering`, `community`, `priority:medium`
**Assignee:** _unassigned_

### Description
Build a free GitHub Action that scans Haystack pipeline files in PRs and warns about un-guarded components.

### Deliverables
- [ ] GitHub Action: `tealtiger/haystack-security-scan`
- [ ] Detects: un-guarded OpenAIGenerator, raw agent loops without circuit breakers
- [ ] Leaves PR comment with specific warning and fix suggestion
- [ ] Published to GitHub Actions Marketplace
- [ ] README with setup instructions (2-line workflow YAML)

### Example PR Comment
> ⚠️ **Potential Runaway Cost Loop** detected in `agent_routing.py` (line 42).
> Consider wrapping with a budget-enforcing component to cap maximum daily API exposure.
> [See recipe →](https://docs.tealtiger.ai/integrations/haystack/circuit-breaker)

### Technical Requirements
- Python-based action (runs fast, <30s)
- AST parsing of pipeline.py files
- Zero false positives on simple non-looping pipelines
- Configurable: can disable specific checks

### Acceptance Criteria
- Works on any repo with Haystack pipeline files
- No false positives on standard RAG pipelines
- Actionable suggestions with links to TealTiger recipes

---

## Issue 11: Haystack Vulnerability Simulator CLI

**Labels:** `engineering`, `devrel`, `priority:medium`
**Assignee:** _unassigned_

### Description
Build `tealtiger-redteam` — a CLI tool that simulates common attacks against a Haystack pipeline configuration.

### Deliverables
- [ ] CLI tool: `tealtiger-redteam scan pipeline.py`
- [ ] 5 built-in attack scenarios (prompt injection, indirect injection, infinite loop, PII exfiltration, token bomb)
- [ ] Structured audit report output (terminal + JSON)
- [ ] "Fix it" suggestions with TealTiger code snippets
- [ ] pip-installable: `pip install tealtiger-redteam`

### Example Output
```
🔴 VULNERABLE: Indirect Prompt Injection via retrieved documents
   → Agent can be hijacked through content in vector DB
   → Fix: Add TealTigerGuardComponent between retriever and LLM

🔴 VULNERABLE: No cost circuit breaker on agent loop
   → Loop at line 67 has no termination guard
   → Fix: Add TealTigerCircuitBreaker(max_cost=0.50)

🟢 SAFE: No PII detected in system prompts
```

### Acceptance Criteria
- Runs against any Haystack pipeline Python file
- Produces actionable, specific recommendations
- Each vulnerability links to the corresponding TealTiger recipe

---

## Issue 12: Co-Marketing Outreach to deepset DevRel

**Labels:** `devrel`, `marketing`, `priority:medium`
**Assignee:** _unassigned_

### Description
Reach out to deepset's developer relations team to propose co-branded content.

### This is NOT a coding task

### Deliverables
- [ ] Draft outreach email to deepset DevRel team
- [ ] Proposal: Co-branded webinar "Build an EU AI Act Compliant RAG App in 30 Min with Haystack + TealTiger"
- [ ] Proposal: Guest blog post on deepset blog (deterministic vs. probabilistic governance)
- [ ] Proposal: Joint live-coding session on Discord/YouTube

### Key Messaging
- "We want to provide high-value content for your community"
- "Show enterprise readiness of Haystack ecosystem"
- NOT: "Please promote our product"

### Acceptance Criteria
- Outreach email sent
- At least one proposal accepted/scheduled
- Content focuses on Haystack community value, not TealTiger marketing

---

## Issue 13: OWASP LLM Top 10 Mapping for Haystack

**Labels:** `documentation`, `marketing`, `priority:medium`
**Assignee:** _unassigned_

### Description
Create explicit mapping between TealTiger's Haystack integration and the OWASP Top 10 for LLMs, optimized for SEO.

### Deliverables
- [ ] Blog post / docs page: "Securing Haystack Pipelines against OWASP LLM Top 10"
- [ ] Table mapping each OWASP item to specific TealTiger component/recipe
- [ ] For each vulnerability: problem, Haystack-specific risk, TealTiger fix with code
- [ ] SEO-optimized title, meta, headers

### Target Keywords
- "Haystack OWASP Top 10"
- "secure Haystack pipelines"
- "Haystack prompt injection protection"
- "Haystack PII data leakage prevention"

### Acceptance Criteria
- Covers all 10 OWASP LLM vulnerabilities
- Each entry has a working Haystack pipeline code snippet
- Published on docs.tealtiger.ai with proper SEO tags

---

## Issue 14: "Deterministic vs. Probabilistic" Technical Blog Post

**Labels:** `devrel`, `documentation`, `marketing`, `priority:low`
**Assignee:** _unassigned_

### Description
Write a technical blog post explaining why LLM-judging-LLM architecture is wrong for production guardrails, positioned for Haystack developers.

### This is NOT a coding task (writing/research)

### Deliverables
- [ ] Blog post (1500-2000 words)
- [ ] Latency benchmarks: TealTiger <5ms vs. Llama Guard 200-500ms
- [ ] Cost comparison: zero additional API calls vs. 2x token spend
- [ ] Architecture diagrams showing both approaches in a Haystack pipeline
- [ ] Published on dev.to and docs.tealtiger.ai/blog

### Key Arguments
1. Probabilistic safety = flaky results (LLM may disagree with itself)
2. 2x token cost for judge model
3. 200-500ms additional latency per request
4. TealTiger: deterministic, <5ms, zero API calls, 100% predictable

### Acceptance Criteria
- Technically accurate benchmarks (not made up)
- Fair comparison (acknowledges where LLM judges are better, e.g., nuanced content)
- Clear call-to-action with Haystack integration link

---

## Issue 15: Target Haystack GitHub Power Users

**Labels:** `devrel`, `community`, `priority:low`
**Assignee:** _unassigned_

### Description
Identify and engage with the 50-100 core Haystack contributors working on agents, tool calling, and tracing.

### This is NOT a coding task (research/outreach)

### Deliverables
- [ ] List of top 20 Haystack GitHub contributors working on agent-related features
- [ ] List of 10 recent issues/PRs about multi-agent, cost, or security pain points
- [ ] 5 constructive, helpful responses posted on relevant issues
- [ ] Track engagement and follow-ups

### Guidelines
- Be genuinely helpful — solve their problem first
- Show lightweight, client-side architecture advantage
- Don't force TealTiger if it doesn't fit their use case
- Goal: become a trusted community member, not a vendor

### Acceptance Criteria
- At least 5 constructive comments posted
- Zero negative reactions
- At least 1 follow-up conversation started

---

## Project Board Columns

| Backlog | Ready | In Progress | Review | Done |
|---------|-------|-------------|--------|------|
| Issues 10-15 | Issues 5-9 | Issues 1-4 | — | — |

## Suggested Sprint Priorities

**Sprint 1 (Week 1-2):** Issues 1, 2, 3, 4, 6 (core recipes + quickstart)
**Sprint 2 (Week 3-4):** Issues 5, 7, 8, 9 (templates + community)
**Sprint 3 (Week 5-6):** Issues 10, 11, 12, 13, 14, 15 (distribution + marketing)
