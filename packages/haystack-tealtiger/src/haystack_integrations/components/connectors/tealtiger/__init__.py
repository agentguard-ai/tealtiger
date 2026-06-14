"""TealTiger Governance Component for Haystack.

Add deterministic governance to any Haystack pipeline:

    from haystack import Pipeline
    from haystack_integrations.components.connectors.tealtiger import (
        TealTigerGovernanceComponent,
    )

    pipeline = Pipeline()
    pipeline.add_component("governance", TealTigerGovernanceComponent())
    pipeline.add_component("llm", some_generator)
    pipeline.connect("governance.text", "llm.prompt")

    # Zero-config mode: observe, track cost, detect PII, allow all
    result = pipeline.run({"governance": {"text": "Hello world"}})

    # Policy mode with TealEngine:
    from tealtiger import TealEngine

    engine = TealEngine(policies=[...])
    governed = TealTigerGovernanceComponent(engine=engine)

No LLM in the governance path. All policy evaluation is deterministic, adding <5ms latency.
"""

from haystack_integrations.components.connectors.tealtiger.governance_component import (
    TealTigerGovernanceComponent,
)
from haystack_integrations.components.connectors.tealtiger.pii_redactor import (
    TealTigerPIIRedactor,
)

__all__ = ["TealTigerGovernanceComponent", "TealTigerPIIRedactor"]
