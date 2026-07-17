"""TealTiger governance callbacks for Google Agent Development Kit (ADK).

Provides TealTigerCallback with before_tool/after_tool hooks that enforce
deterministic governance policies in Google ADK agents.

Usage:
    from google.adk import Agent
    from tealtiger_adk import TealTigerCallback

    governance = TealTigerCallback(
        policies=[
            {"type": "pii_block", "categories": ["ssn", "credit_card"]},
            {"type": "cost_limit", "max_per_session": 5.00},
        ],
        mode="ENFORCE",
    )

    agent = Agent(
        model="gemini-2.0-flash",
        tools=[search_tool],
        before_tool_callback=governance.before_tool,
        after_tool_callback=governance.after_tool,
    )
"""

__version__ = "0.1.0"

from tealtiger_adk.callback import TealTigerCallback

__all__ = ["TealTigerCallback", "__version__"]
