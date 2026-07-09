TealTiger is officially listed in the [Haystack integrations catalog](https://haystack.deepset.ai/integrations/tealtiger).

This is our first listing in a major AI framework's official integration page.

## What it means

Any Haystack 2.0 pipeline can add deterministic governance with:

```bash
pip install tealtiger-haystack
```

```python
from haystack import Pipeline
from haystack.components.generators import OpenAIGenerator
from haystack_integrations.components.connectors.tealtiger import TealTigerGovernanceComponent

pipeline = Pipeline()
pipeline.add_component("governance", TealTigerGovernanceComponent())
pipeline.add_component("llm", OpenAIGenerator(model="gpt-4o-mini"))
pipeline.connect("governance.text", "llm.prompt")

result = pipeline.run({"governance": {"text": "What is the capital of France?"}})
```

## What you get (zero config, no policies needed)

- Cost tracking per request and session
- PII detection (email, SSN, credit card, phone)
- Audit trail with correlation IDs
- <2ms overhead, no LLM in the governance path

## Links

- 📖 Integration page: https://haystack.deepset.ai/integrations/tealtiger
- 📦 PyPI: https://pypi.org/project/tealtiger-haystack/
- 🐙 Source: `packages/haystack-tealtiger/` in this repo

## What's next

More framework integrations are in progress — OpenAI Cookbook, LlamaIndex, AG2, and CrewAI PRs are open. Will announce each as it lands.

Thanks to the deepset team for the review and listing. 🐯
