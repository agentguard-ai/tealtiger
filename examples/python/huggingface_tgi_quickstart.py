"""
TealTiger Hugging Face TGI quickstart.

Run with:

    HF_API_TOKEN=hf_... \
    HF_TGI_ENDPOINT=https://your-endpoint.endpoints.huggingface.cloud \
    python examples/python/huggingface_tgi_quickstart.py

The example shows:
    - Hugging Face TGI endpoint configuration.
    - Guardrail and cost tracking switches on the guarded provider config.
    - A prompt containing sample PII so the governance layer has a realistic
      input to evaluate when an engine is attached.
    - Response text, token usage, and a simple cost summary.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

from tealtiger.clients.new_providers import (
    HF_TGI_PRICING,
    ProviderConfig,
    TealHfTgi,
)


DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"


def estimate_cost(model: str, usage: dict[str, Any]) -> float:
    """Estimate request cost from HF TGI reference pricing."""
    pricing = HF_TGI_PRICING.get(model, HF_TGI_PRICING["custom-model"])
    prompt_tokens = int(usage.get("prompt_tokens", 0))
    completion_tokens = int(usage.get("completion_tokens", 0))
    return (
        (prompt_tokens / 1000) * pricing["input"]
        + (completion_tokens / 1000) * pricing["output"]
    )


async def main() -> None:
    """Create a guarded HF TGI client, send one prompt, and print metadata."""
    endpoint = os.getenv("HF_TGI_ENDPOINT", "http://localhost:8080")
    token = os.getenv("HF_API_TOKEN", "")
    model = os.getenv("HF_TGI_MODEL", DEFAULT_MODEL)

    if not token and not endpoint.startswith("http://localhost"):
        raise RuntimeError(
            "Set HF_API_TOKEN for hosted Hugging Face Inference Endpoints, "
            "or point HF_TGI_ENDPOINT at a local TGI server."
        )

    client = TealHfTgi(
        ProviderConfig(
            api_key=token,
            base_url=endpoint,
            model=model,
            agent_id="hf-tgi-quickstart-agent",
            enable_guardrails=True,
            enable_cost_tracking=True,
        )
    )

    response = await client.chat_completion(
        messages=[
            {
                "role": "system",
                "content": "Answer in one concise sentence.",
            },
            {
                "role": "user",
                "content": (
                    "My email is jane@example.com. Explain what TealTiger "
                    "does for a Hugging Face TGI deployment."
                ),
            },
        ],
        max_tokens=96,
    )

    usage = response.get("usage", {})
    estimated_cost = estimate_cost(model, usage)

    print("Response:", response["choices"][0]["message"]["content"])
    print("Prompt tokens:", usage.get("prompt_tokens", 0))
    print("Completion tokens:", usage.get("completion_tokens", 0))
    print("Total tokens:", usage.get("total_tokens", 0))
    print(f"Estimated cost: ${estimated_cost:.6f}")

    governance = response.get("governance", {})
    print("Provider:", governance.get("provider", "hf-tgi"))
    print("Correlation ID:", governance.get("correlation_id", "n/a"))


if __name__ == "__main__":
    asyncio.run(main())
