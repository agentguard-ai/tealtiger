"""
TealTiger Haystack Pipeline Security Scanner

AST-analyses Python files for Haystack pipelines that lack TealTiger governance.
Detects:
  - unguarded-generator: LLM generators used without TealTiger cost/PII/injection guards
  - agent-loop: pipeline.run() called inside an unbounded loop without a budget guard
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Haystack LLM generator class names (v2 official + common third-party integrations)
_HAYSTACK_GENERATORS = frozenset(
    {
        "OpenAIGenerator",
        "OpenAIChatGenerator",
        "AnthropicChatGenerator",
        "GoogleAIGeminiChatGenerator",
        "GoogleAIGeminiGenerator",
        "GroqChatGenerator",
        "TogetherAIChatGenerator",
        "HuggingFaceLocalGenerator",
        "HuggingFaceAPIChatGenerator",
        "AmazonBedrockChatGenerator",
        "MistralChatGenerator",
        "CohereGenerator",
        "CohereChatGenerator",
        "DeepSeekChatGenerator",
    }
)

# TealTiger components/classes that make a pipeline "governed"
_TEALTIGER_GUARDS = frozenset(
    {
        "TealGovernance",
        "TealTigerGuardComponent",
        "TealTigerGovernanceComponent",
        "TealTigerCircuitBreaker",
        "TealTigerBudgetGuard",
        "BudgetManager",
        "PIIDetectionGuardrail",
        "TealEngine",
    }
)

# Budget/circuit-breaker classes sufficient to protect an agent loop
_BUDGET_GUARDS = frozenset(
    {
        "BudgetManager",
        "TealTigerCircuitBreaker",
        "TealTigerBudgetGuard",
        "TealTigerGovernanceComponent",
    }
)

_RECIPE_URL = (
    "https://github.com/agentguard-ai/tealtiger/blob/main"
    "/examples/haystack-governance/main.py"
)


@dataclass
class Finding:
    file: str
    line: int
    check: str
    message: str
    fix: str


# ---------------------------------------------------------------------------
# AST helpers
# ---------------------------------------------------------------------------


def _imported_and_referenced_names(tree: ast.Module) -> set[str]:
    """Return all names imported or referenced anywhere in the module."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                names.add(alias.asname or alias.name.split(".")[-1])
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                names.add(alias.asname or alias.name)
        elif isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
    return names


def _is_haystack_file(tree: ast.Module) -> bool:
    """Return True only if the file imports from haystack."""
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and "haystack" in node.module:
            return True
        if isinstance(node, ast.Import):
            for alias in node.names:
                if "haystack" in alias.name:
                    return True
    return False


def _call_name(node: ast.Call) -> Optional[str]:
    """Return the simple class/function name from a Call node, if determinable."""
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


# ---------------------------------------------------------------------------
# Check: unguarded-generator
# ---------------------------------------------------------------------------


def _check_unguarded_generator(
    path: str, tree: ast.Module, names: set[str]
) -> list[Finding]:
    """
    Warn when a Haystack LLM generator is instantiated in a file that contains
    no TealTiger governance component.
    """
    found: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = _call_name(node)
            if name and name in _HAYSTACK_GENERATORS:
                found.append((name, node.lineno))

    if not found:
        return []
    if names & _TEALTIGER_GUARDS:
        return []

    return [
        Finding(
            file=path,
            line=lineno,
            check="unguarded-generator",
            message=(
                f"Potential unguarded LLM generator at line {lineno}: "
                f"`{gen_name}` is used without a TealTiger governance component. "
                f"This pipeline has no cost cap, PII protection, or prompt-injection defence."
            ),
            fix=(
                f"Wrap `{gen_name}` with a `TealGovernance` component, or add "
                f"`BudgetManager` + `PIIDetectionGuardrail` before the generator. "
                f"See recipe: {_RECIPE_URL}"
            ),
        )
        for gen_name, lineno in found
    ]


# ---------------------------------------------------------------------------
# Check: agent-loop
# ---------------------------------------------------------------------------


def _loop_contains_pipeline_run(loop_node: ast.stmt) -> bool:
    """Return True if any statement inside the loop calls <something>.run()."""
    for child in ast.walk(loop_node):
        if isinstance(child, ast.Call):
            func = child.func
            if isinstance(func, ast.Attribute) and func.attr == "run":
                return True
    return False


def _check_agent_loop(
    path: str, tree: ast.Module, names: set[str]
) -> list[Finding]:
    """
    Warn when pipeline.run() is called inside an unbounded while-True loop
    without a TealTiger budget guard or circuit breaker in the same module.

    Design note: a bare `break` statement inside the loop does not suppress this
    warning because the check verifies governance intent, not control flow. A
    loop that exits via an arbitrary condition still has no cost cap if it runs
    for many iterations before hitting that condition. Only an explicit TealTiger
    budget guard in module scope suppresses the warning.
    """
    has_budget_guard = bool(names & _BUDGET_GUARDS)
    findings: list[Finding] = []

    for node in ast.walk(tree):
        if not isinstance(node, ast.While):
            continue
        # Only flag `while True:` (literal constant True)
        if not (isinstance(node.test, ast.Constant) and node.test.value is True):
            continue
        if not _loop_contains_pipeline_run(node):
            continue
        if has_budget_guard:
            continue
        findings.append(
            Finding(
                file=path,
                line=node.lineno,
                check="agent-loop",
                message=(
                    f"Potential runaway cost loop at line {node.lineno}: "
                    f"an unbounded `while True:` loop calls `pipeline.run()` with no "
                    f"TealTiger budget guard or circuit breaker. "
                    f"This can incur unlimited API spend."
                ),
                fix=(
                    "Add `BudgetManager(limit=0.50)` and check it before each iteration, "
                    "or wrap the agent with `TealTigerCircuitBreaker(max_cost_usd=0.50)`. "
                    f"See recipe: {_RECIPE_URL}"
                ),
            )
        )
    return findings


# ---------------------------------------------------------------------------
# File / directory scanning
# ---------------------------------------------------------------------------


def scan_file(path: str, checks: set[str]) -> list[Finding]:
    try:
        source = Path(path).read_text(encoding="utf-8")
        tree = ast.parse(source, filename=path)
    except (OSError, SyntaxError):
        return []

    if not _is_haystack_file(tree):
        return []

    names = _imported_and_referenced_names(tree)
    findings: list[Finding] = []

    if "unguarded-generator" in checks:
        findings.extend(_check_unguarded_generator(path, tree, names))
    if "agent-loop" in checks:
        findings.extend(_check_agent_loop(path, tree, names))

    return findings


def scan_path(root: str, checks: set[str]) -> list[Finding]:
    p = Path(root)
    if p.is_file():
        return scan_file(str(p), checks)
    return [
        finding
        for py_file in sorted(p.rglob("*.py"))
        for finding in scan_file(str(py_file), checks)
    ]


# ---------------------------------------------------------------------------
# GitHub PR comment
# ---------------------------------------------------------------------------


def _build_pr_comment(findings: list[Finding]) -> str:
    lines = [
        "## TealTiger Haystack Security Scan",
        "",
        f"Found **{len(findings)} warning(s)** in Haystack pipeline files.",
        "",
    ]
    for f in findings:
        lines += [
            f"### `{f.file}` — line {f.line}",
            "",
            f.message,
            "",
            f"**Fix:** {f.fix}",
            "",
            "---",
            "",
        ]
    lines.append(
        "_Powered by [TealTiger](https://github.com/agentguard-ai/tealtiger). "
        "Disable a check with `checks: agent-loop` to skip `unguarded-generator`._"
    )
    return "\n".join(lines)


def _post_pr_comment(body: str, token: str) -> None:
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    pr_number = os.environ.get("PR_NUMBER", "")
    if not repo or not pr_number:
        print("::warning::Skipping PR comment — GITHUB_REPOSITORY or PR_NUMBER not set.")
        return

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    payload = json.dumps({"body": body}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            if resp.status not in (200, 201):
                print(f"::warning::PR comment returned HTTP {resp.status}")
    except Exception as exc:
        print(f"::warning::Could not post PR comment: {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def _parse_checks(raw: str) -> set[str]:
    all_checks = {"unguarded-generator", "agent-loop"}
    if raw.strip().lower() == "all":
        return all_checks
    selected = {c.strip() for c in raw.split(",") if c.strip()}
    unknown = selected - all_checks
    for u in unknown:
        print(f"::warning::Unknown check '{u}' will be ignored.")
    return selected & all_checks


def _format_sarif(findings: list[Finding]) -> str:
    results = []
    for f in findings:
        results.append(
            {
                "ruleId": f.check,
                "message": {"text": f.message},
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {"uri": f.file},
                            "region": {"startLine": f.line},
                        }
                    }
                ],
            }
        )
    sarif = {
        "version": "2.1.0",
        "$schema": "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "tealtiger-haystack-scan",
                        "version": "1.0.0",
                        "rules": [
                            {
                                "id": "unguarded-generator",
                                "shortDescription": {
                                    "text": "Haystack LLM generator used without TealTiger governance"
                                },
                            },
                            {
                                "id": "agent-loop",
                                "shortDescription": {
                                    "text": "Unbounded agent loop without budget guard"
                                },
                            },
                        ],
                    }
                },
                "results": results,
            }
        ],
    }
    return json.dumps(sarif, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="TealTiger Haystack Pipeline Security Scanner"
    )
    parser.add_argument("--path", default=".", help="File or directory to scan")
    parser.add_argument(
        "--checks",
        default="all",
        help="Comma-separated checks (unguarded-generator,agent-loop) or 'all'",
    )
    parser.add_argument(
        "--fail-on-warning",
        default="false",
        help="Exit 1 if any warnings are found",
    )
    parser.add_argument(
        "--post-comment",
        default="true",
        help="Post findings as a PR comment (requires GITHUB_TOKEN)",
    )
    parser.add_argument(
        "--output-format",
        default="text",
        choices=["text", "json", "sarif"],
        help="Output format for local runs: text (default), json, or sarif",
    )
    parser.add_argument("--github-token", default="", help="GitHub token for PR comments")
    args = parser.parse_args()

    checks = _parse_checks(args.checks)
    findings = scan_path(args.path, checks)

    # Write GitHub Actions outputs
    github_output = os.environ.get("GITHUB_OUTPUT", "")
    if github_output:
        report_json = json.dumps(
            [
                {
                    "file": f.file,
                    "line": f.line,
                    "check": f.check,
                    "message": f.message,
                    "fix": f.fix,
                }
                for f in findings
            ]
        )
        with open(github_output, "a") as fh:
            fh.write(f"warnings={len(findings)}\n")
            fh.write(f"report={report_json}\n")

    # Console output — format selected by --output-format
    if args.output_format == "json":
        print(
            json.dumps(
                [
                    {
                        "file": f.file,
                        "line": f.line,
                        "check": f.check,
                        "message": f.message,
                        "fix": f.fix,
                    }
                    for f in findings
                ],
                indent=2,
            )
        )
    elif args.output_format == "sarif":
        print(_format_sarif(findings))
    else:
        if not findings:
            print("No unguarded Haystack pipeline components detected.")
        else:
            print(f"{len(findings)} warning(s) found:\n")
            for f in findings:
                print(f"  [{f.check}] {f.file}:{f.line}")
                print(f"    {f.message}")
                print(f"    Fix: {f.fix}\n")

    # Post PR comment if running in a pull_request event with findings.
    # argparse converts --post-comment to args.post_comment (hyphens become underscores).
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    if (
        findings
        and args.post_comment.lower() == "true"
        and event_name == "pull_request"
        and args.github_token
    ):
        _post_pr_comment(_build_pr_comment(findings), args.github_token)

    if args.fail_on_warning.lower() == "true" and findings:
        sys.exit(1)


if __name__ == "__main__":
    main()
