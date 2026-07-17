"""Basic governance example with Google ADK.

Demonstrates how to add TealTiger governance to a Google ADK agent
with PII blocking, cost limits, and tool allowlisting.
"""

from google.adk import Agent
from tealtiger_adk import TealTigerCallback


# Define governance policies
governance = TealTigerCallback(
    policies=[
        # Block PII in tool arguments
        {"type": "pii_block", "categories": ["ssn", "credit_card", "email"]},
        # Limit session cost to $5
        {"type": "cost_limit", "max_per_session": 5.00},
        # Only allow specific tools
        {"type": "tool_allowlist", "allowed": ["google_search", "code_execution"]},
        # Detect leaked secrets
        {"type": "secret_detection"},
    ],
    mode="ENFORCE",
    agent_id="research-agent-v1",
)


# Define tools (simplified for example)
def google_search(query: str) -> str:
    """Search the web."""
    return f"Results for: {query}"


def code_execution(code: str) -> str:
    """Execute Python code."""
    return f"Executed: {code}"


# Create ADK agent with governance
agent = Agent(
    model="gemini-2.0-flash",
    name="governed_research_agent",
    instruction="You are a research assistant. Search for information and analyze it.",
    tools=[google_search, code_execution],
    before_tool_callback=governance.before_tool,
    after_tool_callback=governance.after_tool,
)


def main():
    """Run the governed agent."""
    # Run agent (in real usage, use ADK's runner)
    print(f"Agent '{agent.name}' ready with TealTiger governance")
    print(f"Mode: {governance.mode}")
    print(f"Policies: {len(governance.policies)}")
    print()

    # Simulate governance decisions
    # This would normally happen automatically via ADK's tool dispatch

    # Example 1: Normal tool call (ALLOW)
    result = governance.before_tool(None, "google_search", {"query": "AI safety papers"})
    print(f"1. google_search('AI safety papers') → {governance.decisions[-1]['action']}")

    # Example 2: PII in arguments (DENY in ENFORCE mode)
    result = governance.before_tool(None, "google_search", {"query": "Find info on SSN 123-45-6789"})
    print(f"2. google_search(SSN in query) → {governance.decisions[-1]['action']}")
    if result:
        print(f"   Blocked: {result['content'][:80]}...")

    # Example 3: Tool not in allowlist (DENY)
    result = governance.before_tool(None, "send_email", {"to": "user@example.com"})
    print(f"3. send_email (not allowed) → {governance.decisions[-1]['action']}")

    # Example 4: Secret in arguments (DENY)
    result = governance.before_tool(None, "code_execution", {"code": "key = 'sk-abc123def456ghi789jkl012'"})
    print(f"4. code_execution(secret key) → {governance.decisions[-1]['action']}")

    # Summary
    print()
    print(f"Total decisions: {len(governance.decisions)}")
    print(f"Allowed: {governance.allow_count}")
    print(f"Denied: {governance.deny_count}")
    print(f"Cost: ${governance.total_cost:.4f}")

    # Kill switch demo
    print()
    print("--- Kill Switch ---")
    governance.freeze()
    result = governance.before_tool(None, "google_search", {"query": "normal query"})
    print(f"After freeze: {governance.decisions[-1]['action']} (reason: AGENT_FROZEN)")
    governance.unfreeze()


if __name__ == "__main__":
    main()
