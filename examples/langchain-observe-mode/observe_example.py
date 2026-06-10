"""LangChain observe-mode quickstart using TealTiger callback reporting."""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from langchain.agents import AgentType, initialize_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI

from langchain_tealtiger import TealTigerCallbackHandler


@tool
def lookup_customer_profile(customer_id: str) -> str:
    """Lookup public metadata for a support customer."""
    if customer_id == "cust_42":
        return "Customer name: Jamie Q. Example. Email: jamie.example@tealtiger.ai"
    return "Customer profile not found."


def _format_audit_trail(entries: Optional[List[Dict[str, Any]]]) -> None:
    if not entries:
        print("No audit rows were emitted.")
        return

    for i, entry in enumerate(entries, 1):
        cost = entry.get("cost_usd")
        action = entry.get("action")
        tool_name = entry.get("tool")
        pii = entry.get("pii_detected") or entry.get("pii") or []

        print(f"- [{i}] action={action}, tool={tool_name}, cost_usd={cost}")
        if pii:
            print(f"  pii_detected={pii}")


def main() -> None:
    if "OPENAI_API_KEY" not in os.environ:
        raise SystemExit("Set OPENAI_API_KEY before running this example.")

    handler = TealTigerCallbackHandler(mode="REPORT_ONLY")

    # A tiny LangChain agent with one tool call to keep output stable.
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        api_key=os.environ["OPENAI_API_KEY"],
    )
    agent = initialize_agent(
        tools=[lookup_customer_profile],
        llm=llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=False,
    )

    result = agent.invoke(
        {
            "input": (
                "Find support details for customer ID cust_42 and "
                "explain what to do next."
            ),
        },
        config={"callbacks": [handler]},
    )

    print("Agent output:")
    print(result.get("output"))

    print("\nObserved audit trail:")
    _format_audit_trail(handler.audit_trail)
    # Full payload is useful when inspecting fields per environment.
    print("\nRaw audit trail JSON:")
    print(handler.audit_trail)


if __name__ == "__main__":
    main()
