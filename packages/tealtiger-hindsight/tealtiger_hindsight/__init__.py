"""TealTiger governance memory with Hindsight.

Stores governance decisions with importance-weighted retention and enables
contextual recall of past decisions for adaptive (but deterministic) governance.

Usage:
    from hindsight_client import Hindsight
    from tealtiger_hindsight import HindsightGovernanceMemory

    client = Hindsight(base_url="http://localhost:8888")
    memory = HindsightGovernanceMemory(client=client, bank_id="governance")

    # Store a governance decision
    memory.store(decision)

    # Recall similar past decisions for context
    past = memory.recall(agent_id="research-agent", context="tool:web_search")
"""

__version__ = "0.1.0"

from tealtiger_hindsight.memory import HindsightGovernanceMemory

__all__ = ["HindsightGovernanceMemory", "__version__"]
