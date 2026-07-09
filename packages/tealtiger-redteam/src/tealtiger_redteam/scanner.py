"""Static scanner for Haystack pipeline risk patterns."""

from __future__ import annotations

import ast
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

INJECTION_RECIPE = "packages/haystack-tealtiger/docs/recipes/injection-defense.md"
CIRCUIT_RECIPE = "packages/haystack-tealtiger/docs/recipes/agent-circuit-breaker.md"
PII_RECIPE = "packages/haystack-tealtiger/docs/recipes/compliant-enterprise-rag.md"

SCENARIOS = (
    "prompt_injection",
    "indirect_injection",
    "infinite_loop",
    "pii_exfiltration",
    "token_bomb",
)


@dataclass(frozen=True)
class FixSuggestion:
    """Actionable fix metadata for one finding."""

    component: str
    snippet: str
    recipe: str


@dataclass(frozen=True)
class Finding:
    """One scanner finding."""

    id: str
    scenario: str
    severity: str
    status: str
    line: int | None
    message: str
    fix: FixSuggestion

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable finding."""
        data = asdict(self)
        data["fix"] = asdict(self.fix)
        return data


@dataclass(frozen=True)
class ScanReport:
    """Structured scanner report."""

    target: str
    summary: dict[str, Any]
    findings: list[Finding]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable report."""
        return {
            "target": self.target,
            "summary": self.summary,
            "findings": [finding.to_dict() for finding in self.findings],
        }


@dataclass(frozen=True)
class _SignalSnapshot:
    names: set[str]
    strings: list[tuple[str, int]]
    calls: list[tuple[str, int]]
    loops: list[int]
    keyword_values: dict[str, list[tuple[float, int]]]


class _SignalVisitor(ast.NodeVisitor):
    """Collect source-level signals without executing pipeline code."""

    def __init__(self) -> None:
        self.names: set[str] = set()
        self.strings: list[tuple[str, int]] = []
        self.calls: list[tuple[str, int]] = []
        self.loops: list[int] = []
        self.keyword_values: dict[str, list[tuple[float, int]]] = {}

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.names.add(alias.asname or alias.name.split(".")[-1])
            self.names.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        if node.module:
            self.names.add(node.module)
        for alias in node.names:
            self.names.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        self.names.add(node.id)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        self.names.add(node.attr)
        self.generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> None:
        if isinstance(node.value, str):
            self.strings.append((node.value, node.lineno))
        elif isinstance(node.value, int | float):
            self._record_numeric_constant(node.value, node.lineno)

    def visit_Call(self, node: ast.Call) -> None:
        call_name = _call_name(node.func)
        if call_name:
            self.calls.append((call_name, node.lineno))
            self.names.add(call_name)
        for keyword in node.keywords:
            if keyword.arg and isinstance(keyword.value, ast.Constant):
                value = keyword.value.value
                if isinstance(value, int | float):
                    self.keyword_values.setdefault(keyword.arg, []).append(
                        (float(value), node.lineno)
                    )
        self.generic_visit(node)

    def visit_While(self, node: ast.While) -> None:
        self.loops.append(node.lineno)
        self.generic_visit(node)

    def visit_For(self, node: ast.For) -> None:
        self.loops.append(node.lineno)
        self.generic_visit(node)

    def _record_numeric_constant(self, value: int | float, line: int) -> None:
        # Numeric constants are kept as a fallback for high-token fixtures.
        self.keyword_values.setdefault("__numeric__", []).append((float(value), line))

    def snapshot(self) -> _SignalSnapshot:
        """Return immutable signals for rule evaluation."""
        return _SignalSnapshot(
            names=set(self.names),
            strings=list(self.strings),
            calls=list(self.calls),
            loops=list(self.loops),
            keyword_values={key: list(values) for key, values in self.keyword_values.items()},
        )


def scan_file(path: str | Path) -> ScanReport:
    """Scan a Python file by path."""
    target = Path(path)
    source = target.read_text(encoding="utf-8")
    return scan_source(source, target=str(target))


def scan_source(source: str, *, target: str = "<source>") -> ScanReport:
    """Scan Python source and return a structured report."""
    tree = ast.parse(source, filename=target)
    visitor = _SignalVisitor()
    visitor.visit(tree)
    signals = visitor.snapshot()
    findings = _evaluate(signals)
    scenarios = dict.fromkeys(SCENARIOS, "safe")
    for finding in findings:
        scenarios[finding.scenario] = "vulnerable"

    return ScanReport(
        target=target,
        summary={
            "status": "vulnerable" if findings else "safe",
            "findings_total": len(findings),
            "scenarios": scenarios,
        },
        findings=findings,
    )


def _evaluate(signals: _SignalSnapshot) -> list[Finding]:
    names = signals.names
    haystackish = _has_any(names, "Pipeline", "haystack")
    has_guard = "TealTigerGuardComponent" in names
    has_redactor = "TealTigerPIIRedactor" in names
    has_breaker = "TealTigerCircuitBreaker" in names
    has_retriever = _has_signal(
        signals, ("retriever", "documentstore", "document_store", "bm25", "vector")
    )
    has_prompt = _has_signal(signals, ("prompt", "promptbuilder", "template"))
    has_generator = _has_signal(signals, ("generator", "openaigenerator", "llm", "chat", "model"))
    has_external = _has_signal(
        signals, ("url", "web", "email", "reader", "fetch", "external", "tool")
    )
    has_loop = bool(signals.loops)
    high_token_line = _high_token_line(signals)

    findings: list[Finding] = []
    if haystackish and has_prompt and has_generator and has_external and not has_guard:
        findings.append(_prompt_injection(signals))
    if haystackish and has_retriever and has_generator and not has_guard:
        findings.append(_indirect_injection(signals))
    if haystackish and has_loop and has_generator and not has_breaker:
        findings.append(_infinite_loop(signals))
    if haystackish and has_retriever and has_generator and not has_redactor:
        findings.append(_pii_exfiltration(signals))
    if (
        haystackish
        and not has_breaker
        and (high_token_line is not None or (has_loop and has_generator))
    ):
        findings.append(_token_bomb(signals, high_token_line))
    return findings


def _prompt_injection(signals: _SignalSnapshot) -> Finding:
    return Finding(
        id="TT-HAYSTACK-PROMPT-INJECTION",
        scenario="prompt_injection",
        severity="high",
        status="vulnerable",
        line=_first_signal_line(signals, ("prompt", "generator", "external", "reader", "url")),
        message=(
            "External or user-controlled text appears to reach a prompt or generator without "
            "TealTigerGuardComponent."
        ),
        fix=FixSuggestion(
            component="TealTigerGuardComponent",
            snippet='pipeline.add_component("guard", TealTigerGuardComponent(mode="refer"))',
            recipe=INJECTION_RECIPE,
        ),
    )


def _indirect_injection(signals: _SignalSnapshot) -> Finding:
    return Finding(
        id="TT-HAYSTACK-INDIRECT-INJECTION",
        scenario="indirect_injection",
        severity="high",
        status="vulnerable",
        line=_first_signal_line(signals, ("retriever", "document", "generator", "prompt")),
        message=(
            "Retriever output appears to reach a prompt or generator without "
            "TealTigerGuardComponent."
        ),
        fix=FixSuggestion(
            component="TealTigerGuardComponent",
            snippet='pipeline.add_component("guard", TealTigerGuardComponent(mode="refer"))',
            recipe=INJECTION_RECIPE,
        ),
    )


def _infinite_loop(signals: _SignalSnapshot) -> Finding:
    return Finding(
        id="TT-HAYSTACK-INFINITE-LOOP",
        scenario="infinite_loop",
        severity="high",
        status="vulnerable",
        line=signals.loops[0] if signals.loops else None,
        message="Agent or pipeline loop found without TealTigerCircuitBreaker.",
        fix=FixSuggestion(
            component="TealTigerCircuitBreaker",
            snippet=(
                'pipeline.add_component("circuit_breaker", '
                "TealTigerCircuitBreaker(max_cost_per_session=0.50, max_iterations=4))"
            ),
            recipe=CIRCUIT_RECIPE,
        ),
    )


def _pii_exfiltration(signals: _SignalSnapshot) -> Finding:
    return Finding(
        id="TT-HAYSTACK-PII-EXFILTRATION",
        scenario="pii_exfiltration",
        severity="high",
        status="vulnerable",
        line=_first_signal_line(signals, ("retriever", "document", "generator", "prompt")),
        message=(
            "Retrieved documents appear to reach a prompt or generator without "
            "TealTigerPIIRedactor."
        ),
        fix=FixSuggestion(
            component="TealTigerPIIRedactor",
            snippet='pipeline.add_component("pii_redactor", TealTigerPIIRedactor(action="redact"))',
            recipe=PII_RECIPE,
        ),
    )


def _token_bomb(signals: _SignalSnapshot, high_token_line: int | None) -> Finding:
    return Finding(
        id="TT-HAYSTACK-TOKEN-BOMB",
        scenario="token_bomb",
        severity="medium",
        status="vulnerable",
        line=high_token_line or (signals.loops[0] if signals.loops else None),
        message="High token or repeated generation signals found without session cost controls.",
        fix=FixSuggestion(
            component="TealTigerCircuitBreaker",
            snippet=(
                'pipeline.add_component("circuit_breaker", '
                "TealTigerCircuitBreaker(max_cost_per_session=0.50, max_iterations=4))"
            ),
            recipe=CIRCUIT_RECIPE,
        ),
    )


def _has_any(names: set[str], *needles: str) -> bool:
    lowered = {name.lower() for name in names}
    return any(needle.lower() in lowered for needle in needles)


def _has_signal(signals: _SignalSnapshot, needles: tuple[str, ...]) -> bool:
    haystack = " ".join([*signals.names, *(value for value, _line in signals.strings)]).lower()
    return any(needle in haystack for needle in needles)


def _first_signal_line(signals: _SignalSnapshot, needles: tuple[str, ...]) -> int | None:
    lowered_needles = tuple(needle.lower() for needle in needles)
    candidates: list[int] = []
    for name, line in signals.calls:
        if any(needle in name.lower() for needle in lowered_needles):
            candidates.append(line)
    for value, line in signals.strings:
        if any(needle in value.lower() for needle in lowered_needles):
            candidates.append(line)
    return min(candidates) if candidates else None


def _high_token_line(signals: _SignalSnapshot) -> int | None:
    thresholds = {
        "top_k": 25,
        "max_tokens": 8000,
        "max_new_tokens": 8000,
        "max_length": 8000,
    }
    lines: list[int] = []
    for key, threshold in thresholds.items():
        for value, line in signals.keyword_values.get(key, []):
            if value >= threshold:
                lines.append(line)
    return min(lines) if lines else None


def _call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parent = _call_name(node.value)
        return f"{parent}.{node.attr}" if parent else node.attr
    if isinstance(node, ast.Call):
        return _call_name(node.func)
    return None
