"""LlamaIndex TealTiger — Deterministic governance callback for LlamaIndex RAG pipelines.

Add TealTiger governance to any LlamaIndex pipeline with a single callback:

    from llama_index.core import Settings
    from llamaindex_tealtiger import TealTigerCallback

    Settings.callback_manager.add_handler(TealTigerCallback())

Zero-config observe mode is the default — all events are logged with cost tracking and
PII detection, but nothing is blocked. Switch to ENFORCE mode to block policy violations
before tools or retrievers execute.

No LLM in the governance path. All policy evaluation is deterministic, adding <2ms latency.
"""

from llamaindex_tealtiger.callback import GovernanceDenyError, TealTigerCallback

__version__ = "0.1.0"
__all__ = [
    "TealTigerCallback",
    "GovernanceDenyError",
    "__version__",
]
