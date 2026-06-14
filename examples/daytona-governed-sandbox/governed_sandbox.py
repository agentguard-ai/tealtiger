"""
TealTiger × Daytona — Governed Code Execution Example.

Demonstrates defense-in-depth for AI agents:
- TealTiger: logic governance (secrets, PII, policy, cost)
- Daytona: infrastructure isolation (sandboxed execution)

Prerequisites:
    pip install tealtiger daytona-sdk openai
    export OPENAI_API_KEY=your-key
    export DAYTONA_API_KEY=your-daytona-key
"""

import os
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI

# ─── TealTiger Governance ──────────────────────────────────────────────────────
# In production, import from tealtiger directly. Here we use inline governance
# logic to keep the example self-contained and demonstrate the pattern.


@dataclass
class GovernanceDecision:
    """Decision record created BEFORE every sandbox execution."""

    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    action: str = "allow"  # allow, deny
    reason: str = ""
    risk_score: int = 0
    secrets_found: list = field(default_factory=list)
    pii_found: list = field(default_factory=list)
    evaluation_time_ms: float = 0.0


def scan_for_secrets(code: str) -> list[str]:
    """Detect secrets/credentials in generated code."""
    import re

    findings = []
    patterns = {
        "openai_key": re.compile(r"\b(sk-[a-zA-Z0-9]{20,})\b"),
        "aws_key": re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
        "github_pat": re.compile(r"\b(ghp_[a-zA-Z0-9]{36,})\b"),
        "generic_secret": re.compile(
            r"(?i)(password|secret|token|api_key)\s*=\s*['\"][^'\"]{8,}['\"]"
        ),
    }

    for name, pattern in patterns.items():
        if pattern.search(code):
            findings.append(name)

    return findings


def scan_for_pii(code: str) -> list[str]:
    """Detect PII in generated code."""
    import re

    findings = []
    patterns = {
        "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        "credit_card": re.compile(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b"),
        "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    }

    for name, pattern in patterns.items():
        if pattern.search(code):
            findings.append(name)

    return findings


def evaluate_governance(code: str) -> GovernanceDecision:
    """Evaluate governance policies before sandbox execution.

    This is the TealTiger governance gate. In production, use:
        from tealtiger import TealTiger
        decision = tealtiger.evaluate(code)
    """
    start = time.perf_counter()

    secrets = scan_for_secrets(code)
    pii = scan_for_pii(code)

    risk_score = 0
    if secrets:
        risk_score = max(risk_score, 95)
    if pii:
        risk_score = max(risk_score, 80)

    action = "allow"
    reason = "All checks passed"

    if secrets:
        action = "deny"
        reason = f"Secrets detected: {', '.join(secrets)}"
    elif pii:
        action = "deny"
        reason = f"PII detected: {', '.join(pii)}"

    evaluation_time_ms = (time.perf_counter() - start) * 1000

    return GovernanceDecision(
        action=action,
        reason=reason,
        risk_score=risk_score,
        secrets_found=secrets,
        pii_found=pii,
        evaluation_time_ms=evaluation_time_ms,
    )


# ─── Daytona Sandbox Execution ─────────────────────────────────────────────────


def execute_in_sandbox(code: str, decision: GovernanceDecision) -> Optional[str]:
    """Execute code in a Daytona sandbox (isolated environment).

    In production:
        from daytona_sdk import Daytona
        daytona = Daytona()
        sandbox = daytona.create()
        result = sandbox.process.code_run(code)
        daytona.remove(sandbox)
    """
    try:
        from daytona_sdk import Daytona

        daytona = Daytona()
        sandbox = daytona.create()

        print(f"  ⚙️  Sandbox created: {sandbox.id}")
        print(f"  🔒 Isolated: dedicated kernel, filesystem, network")

        # Execute the governed code
        result = sandbox.process.code_run(code)

        print(f"  ✅ Execution complete")

        # Clean up
        daytona.remove(sandbox)

        return result.output if hasattr(result, "output") else str(result)

    except ImportError:
        # Daytona SDK not installed — simulate for demo
        print("  ⚙️  [SIMULATED] Sandbox created")
        print("  🔒 [SIMULATED] Isolated execution environment")
        print("  ✅ [SIMULATED] Code executed safely")
        return "[Simulated output — install daytona-sdk for real execution]"

    except Exception as e:
        print(f"  ❌ Sandbox error: {e}")
        return None


# ─── Main Workflow ──────────────────────────────────────────────────────────────


def governed_agent_workflow(prompt: str, scenario: str):
    """Complete governed agent workflow: LLM → TealTiger → Daytona."""
    print(f"\n{'='*60}")
    print(f"Scenario: {scenario}")
    print(f"{'='*60}")
    print(f"Prompt: {prompt}\n")

    # Step 1: Generate code via LLM
    print("Step 1: LLM generates code...")

    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "sk-demo"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Generate Python code. Return only code, no markdown."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=500,
        )
        generated_code = response.choices[0].message.content
    except Exception:
        # Fallback for demo without API key
        if "secret" in prompt.lower() or "api key" in prompt.lower():
            generated_code = 'import os\napi_key = "sk-proj-abc123def456ghi789jkl012mno345"\nprint(f"Using key: {api_key}")'
        elif "ssn" in prompt.lower() or "social security" in prompt.lower():
            generated_code = 'user_data = {"name": "John", "ssn": "123-45-6789"}\nprint(user_data)'
        else:
            generated_code = 'result = sum(range(100))\nprint(f"Sum: {result}")'

    print(f"  Generated: {generated_code[:80]}...\n")

    # Step 2: TealTiger governance evaluation
    print("Step 2: TealTiger governance evaluation...")
    decision = evaluate_governance(generated_code)

    print(f"  Decision ID: {decision.decision_id}")
    print(f"  Action: {decision.action.upper()}")
    print(f"  Reason: {decision.reason}")
    print(f"  Risk Score: {decision.risk_score}/100")
    print(f"  Evaluation Time: {decision.evaluation_time_ms:.2f}ms")

    if decision.secrets_found:
        print(f"  🚨 Secrets: {decision.secrets_found}")
    if decision.pii_found:
        print(f"  🚨 PII: {decision.pii_found}")

    # Step 3: Execute or block
    if decision.action == "allow":
        print(f"\nStep 3: Daytona sandbox execution...")
        output = execute_in_sandbox(generated_code, decision)
        print(f"\n  Output: {output}")
    else:
        print(f"\n Step 3: BLOCKED — code will NOT execute")
        print(f"  🛡️ TealTiger prevented unsafe code from reaching the sandbox")

    # Step 4: Audit receipt
    print(f"\nStep 4: TEEC Audit Receipt")
    receipt = {
        "decision_id": decision.decision_id,
        "action": decision.action,
        "risk_score": decision.risk_score,
        "evaluation_time_ms": round(decision.evaluation_time_ms, 3),
        "secrets_detected": len(decision.secrets_found),
        "pii_detected": len(decision.pii_found),
        "sandbox_executed": decision.action == "allow",
    }
    print(f"  {json.dumps(receipt, indent=2)}")


def main():
    print("\n" + "=" * 60)
    print("  TealTiger × Daytona — Governed Code Execution")
    print("  Defense in depth: logic governance + infrastructure isolation")
    print("=" * 60)

    # Scenario 1: Clean code (passes governance, executes in sandbox)
    governed_agent_workflow(
        prompt="Write a Python function that calculates the fibonacci sequence up to n=10",
        scenario="Clean code — passes all checks",
    )

    # Scenario 2: Code with secrets (blocked by TealTiger)
    governed_agent_workflow(
        prompt="Write code that uses an API key to call a service",
        scenario="Secret detected — blocked before sandbox",
    )

    # Scenario 3: Code with PII (blocked by TealTiger)
    governed_agent_workflow(
        prompt="Write code that processes a user's social security number",
        scenario="PII detected — blocked before sandbox",
    )

    print("\n" + "=" * 60)
    print("  Summary")
    print("=" * 60)
    print("  • TealTiger: Logic governance (<5ms, deterministic)")
    print("  • Daytona: Infrastructure isolation (90ms cold start)")
    print("  • Together: Defense in depth — unsafe code never executes")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
