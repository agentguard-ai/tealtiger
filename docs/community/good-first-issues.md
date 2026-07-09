# Good First Issues — Copy-Paste Ready

Create these at: https://github.com/agentguard-ai/tealtiger/issues/new

---

## Issue 1

**Title:** `[Good First Issue]: Add JSON export format for TealAudit decision logs`

**Labels:** `good-first-issue`, `enhancement`, `python`, `typescript`

**Body:**

### Description

TealAudit currently supports SARIF and JUnit XML export, but many teams just want a simple JSON array of governance decisions for feeding into their own dashboards, Datadog, or Splunk.

### What needs to be done

1. Add a `to_json()` method to the `TealAudit` class in both SDKs
2. Output should be a JSON array of decision objects with these fields:
   - `decision_id`
   - `timestamp`
   - `agent_id`
   - `action` (allow/deny/monitor)
   - `tool_name`
   - `reason_codes`
   - `risk_score`
   - `evaluation_time_ms`
3. Add a unit test verifying the output schema
4. Update the TealAudit section in `README.md`

### Example output

```json
[
  {
    "decision_id": "d-4a8b2c1f",
    "timestamp": "2026-06-16T14:30:00Z",
    "agent_id": "research-agent",
    "action": "deny",
    "tool_name": "web_scrape",
    "reason_codes": ["TOOL_NOT_ALLOWED"],
    "risk_score": 80,
    "evaluation_time_ms": 2.1
  }
]
```

### Relevant files

- TypeScript: `packages/tealtiger-sdk/src/core/audit/TealAudit.ts`
- Python: `packages/tealtiger-python/tealtiger/audit.py`
- Tests: `packages/tealtiger-sdk/src/core/audit/__tests__/`

### Acceptance criteria

- [ ] `to_json()` method added to both SDKs
- [ ] Unit test passes
- [ ] README updated with JSON export example

**Estimated effort:** 1–2 hours

---

## Issue 2

**Title:** `[Good First Issue]: Add Mistral AI model pricing to cost tracker`

**Labels:** `good-first-issue`, `enhancement`, `cost-tracking`

**Body:**

### Description

TealTiger's cost tracker supports pricing for OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI, and Cohere — but Mistral AI model pricing is missing. The provider adapter exists, so requests work, but costs show as `$0.00`.

### What needs to be done

1. Add Mistral model pricing entries to the cost tracker pricing table
2. Models to add:
   - `mistral-large-latest` — $2/M input, $6/M output
   - `mistral-medium-latest` — $2.7/M input, $8.1/M output  
   - `mistral-small-latest` — $0.2/M input, $0.6/M output
   - `open-mistral-nemo` — $0.15/M input, $0.15/M output
   - `codestral-latest` — $0.3/M input, $0.9/M output
3. Add a unit test that verifies cost calculation for at least one Mistral model
4. Verify pricing against https://mistral.ai/products#pricing

### Relevant files

- TypeScript: `packages/tealtiger-sdk/src/core/cost/pricing.ts`
- Python: `packages/tealtiger-python/tealtiger/cost/pricing.py`
- Tests: look at existing provider pricing tests for pattern

### Acceptance criteria

- [ ] All 5 Mistral models have correct pricing
- [ ] Unit test verifies calculation for `mistral-large-latest`
- [ ] Pricing values match official Mistral docs

**Estimated effort:** 30 minutes – 1 hour

---

## Issue 3

**Title:** `[Good First Issue]: Add policy validation CLI command`

**Labels:** `good-first-issue`, `enhancement`, `cli`, `developer-experience`

**Body:**

### Description

Users write TealTiger policy files (JSON/YAML), but there's no way to validate them without running the full application. A `tealtiger validate` CLI command would catch typos and schema errors early.

### What needs to be done

1. Add a `validate` subcommand to the existing CLI entry point
2. The command should:
   - Accept a file path: `tealtiger validate policy.json`
   - Validate the policy against the schema (correct fields, valid action types, valid condition operators)
   - Print ✓ success or ✗ errors with line numbers
   - Exit code 0 on valid, 1 on invalid
3. Add 2–3 test cases: one valid policy, one with unknown field, one with missing required field

### Example usage

```bash
$ tealtiger validate my-policy.json
✓ Policy 'production-allowlist' is valid (3 rules)

$ tealtiger validate broken-policy.json
✗ Error: Rule 2 has unknown action 'alllow' (did you mean 'allow'?)
✗ Error: Rule 3 missing required field 'condition'
```

### Relevant files

- CLI entry point: `packages/tealtiger-python/tealtiger/cli/`
- Policy schema: `packages/tealtiger-python/tealtiger/policy/`

### Acceptance criteria

- [ ] `tealtiger validate <path>` works from command line
- [ ] Clear error messages for invalid policies
- [ ] Tests cover valid and invalid cases
- [ ] Exit code is correct (0 or 1)

**Estimated effort:** 2–3 hours

---

## Issue 4

**Title:** `[Good First Issue]: Write integration example for LlamaIndex`

**Labels:** `good-first-issue`, `documentation`, `examples`, `integrations`

**Body:**

### Description

We have integration examples for LangChain, CrewAI, Vercel AI SDK, and AG2 — but none for LlamaIndex. LlamaIndex is one of the most popular RAG frameworks and users keep asking how to add governance to their RAG pipelines.

### What needs to be done

1. Create `examples/python/llamaindex_integration.py`
2. Show a simple RAG pipeline with TealTiger governance:
   - TealOpenAI as the LLM client (governs the LLM call)
   - A query engine that retrieves documents
   - TealTiger blocking queries containing PII or secrets before they hit the retriever
3. Add a `README.md` in the example folder explaining how to run it
4. Add the example to the root-level integration examples table in `docs/`

### Example structure

```python
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from tealtiger import TealOpenAI

# TealTiger governs all LLM calls in the pipeline
llm = TealOpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    guardrails={"pii_detection": True, "secret_detection": True},
    budget={"max_cost_per_session": 1.00},
)

documents = SimpleDirectoryReader("data").load_data()
index = VectorStoreIndex.from_documents(documents, llm=llm)

query_engine = index.as_query_engine()
response = query_engine.query("Summarize the Q4 earnings report")
```

### Acceptance criteria

- [ ] Example file runs without errors (with valid API key)
- [ ] README explains dependencies and setup
- [ ] Shows at least one governance scenario (PII block or cost limit)
- [ ] Code follows Google-style docstrings

**Estimated effort:** 1–2 hours

---

## Issue 5

**Title:** `[Good First Issue]: Add risk score breakdown to DENY responses`

**Labels:** `good-first-issue`, `enhancement`, `developer-experience`, `typescript`

**Body:**

### Description

When TealTiger denies a request, the developer gets a `reason_codes` array and a `risk_score` integer, but no breakdown of how the score was calculated. This makes debugging policies harder than it should be.

### What needs to be done

1. Add a `risk_breakdown` field to the `Decision` object
2. Each policy evaluation that contributed to the score should add an entry:
   ```typescript
   risk_breakdown: [
     { source: "secret_detection", score: 95, detail: "OpenAI API key pattern matched" },
     { source: "pii_detection", score: 40, detail: "Email address found in argument 'to'" }
   ]
   ```
3. The final `risk_score` remains the max of all individual scores (existing behavior)
4. Add a test that verifies breakdown is populated on DENY decisions
5. Breakdown should be empty array on ALLOW decisions (no overhead)

### Relevant files

- TypeScript: `packages/tealtiger-sdk/src/core/engine/`
- Types: `packages/tealtiger-sdk/src/core/types.ts`
- Tests: `packages/tealtiger-sdk/src/core/engine/__tests__/`

### Acceptance criteria

- [ ] `risk_breakdown` field added to Decision type
- [ ] Populated with source/score/detail for each triggered policy
- [ ] Empty array for ALLOW decisions (no performance impact)
- [ ] Unit test covers multi-policy DENY scenario
- [ ] Type exported in public API

**Estimated effort:** 2–3 hours

---

## Labels to create (if they don't exist)

- `good-first-issue` (green) — Good entry point for new contributors
- `cost-tracking` — Related to cost/budget features
- `cli` — Command-line interface
- `developer-experience` — Improves DX
- `integrations` — Framework integrations
- `examples` — Code examples and demos
