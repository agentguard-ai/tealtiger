# Copyright (c) 2026, TealTiger Team
#
# SPDX-License-Identifier: Apache-2.0

"""TealTiger governance middleware Extension for AG2 Beta.

Provides deterministic governance for AG2 Beta agents via the composable
middleware system. Intercepts tool calls, LLM requests, and agent turns to
enforce policies, track cost, detect PII, and produce structured audit
evidence (TEEC receipts).

No LLM in the governance path. All evaluation is deterministic with <5ms
overhead.

Maintainer: nagasatish007
Docs: https://github.com/agentguard-ai/tealtiger/tree/main/packages/ag2-tealtiger

Usage:
    from ag2_tealtiger.beta import TealTigerMiddleware

    agent = Agent(
        "assistant",
        config=OpenAIConfig("gpt-4o-mini"),
        middleware=[TealTigerMiddleware(mode="enforce", policies=[...])],
    )
"""

from ag2_tealtiger.beta.types import (
    GovernanceDecision,
    DecisionAction,
    DecisionSource,
    GovernanceMode,
    GovernancePolicy,
    TEECReceipt,
)

try:
    from ag2_tealtiger.beta.middleware import TealTigerMiddleware
except ImportError:
    TealTigerMiddleware = None  # type: ignore[assignment, misc]

__all__ = [
    "TealTigerMiddleware",
    "GovernanceDecision",
    "DecisionAction",
    "DecisionSource",
    "GovernanceMode",
    "GovernancePolicy",
    "TEECReceipt",
]
