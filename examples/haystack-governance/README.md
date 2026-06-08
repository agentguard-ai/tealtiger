# TealTiger Haystack Governance Example

This example shows how to place TealTiger inside a Haystack RAG pipeline so
governance runs after retrieval and before generation.

```text
User Query
   |
   v
InMemoryBM25Retriever
   |
   v
TealGovernance
   |-- cost budget check
   |-- input PII guardrail
   |-- rate-limit check
   |
   +--> DENY: short-circuit and skip generator
   |
   v
GovernedAnswerGenerator
   |
   v
Answer
```

The demo generator is deterministic and offline. It records a TealTiger cost
entry when governance allows the query, and it reports `llm_called: False` when
TealTiger denies the request. In production, replace `GovernedAnswerGenerator`
with a real Haystack generator such as `OpenAIGenerator` while keeping
`TealGovernance` before the generator.

## Setup

Install the dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install "haystack-ai>=2.21" "tealtiger==1.3.0"
```

From this repository, you can run against the local Python SDK source:

```bash
PYTHONPATH=packages/tealtiger-python/src python examples/haystack-governance/main.py
```

Or run directly from the example directory:

```bash
cd examples/haystack-governance
PYTHONPATH=../../packages/tealtiger-python/src python main.py
```

When running in a sandboxed environment, set `HOME` to a writable directory so
Haystack can create its local configuration folder:

```bash
HOME=/tmp/tealtiger-haystack-home \
PYTHONPATH=packages/tealtiger-python/src \
python examples/haystack-governance/main.py
```

## What The Demo Shows

- A normal query passes governance, retrieves documents, calls the generator,
  and records deterministic cost.
- A query containing PII is blocked before generation.
- A low-budget pipeline blocks a query before generation because the estimated
  cost would exceed the TealTiger budget.
- A rate-limited pipeline blocks the second query in the same window.

Each denied case short-circuits the pipeline by passing empty context to the
generator and returning a TealTiger block response with `llm_called: False`.
