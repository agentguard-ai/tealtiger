# TealTiger ↔ OWASP ASI Mapping

This document maps TealTiger's governance controls to the OWASP Top 10 for Agentic Applications (ASI-01 through ASI-10). TealTiger is an open-source SDK that provides deterministic governance for AI agents. OWASP ASI outlines the critical security risks specific to autonomous and semi-autonomous AI systems. This mapping serves as a reference for how TealTiger's modules address each ASI risk.

| ASI ID | Threat | TealTiger Module(s) | Controls/Features | Coverage | Gaps |
|--------|--------|---------------------|-------------------|----------|------|
| ASI-01 | Prompt Injection | TealGuard, TealClassifier  | Prompt injection detection, content filtering, ensemble ML detection | Partial | ML based detection not yet available |
| ASI-02 | Unsafe Tool/Function Execution | TealEngine, TealRegistry | Allowlisting, provenance verification, supply chain governance | Strong | None identified |
| ASI-03 | Tool/Function Poisoning | TealRegistry | Allowlisting, Tool verification | Strong | No detection mechanism for tools poisoned prior to registry approval |
| ASI-04 | Excessive Agency  | TealEngine, TealFlow | Evaluating policies, event driven pipelines | Partial | TealFlow not yet shipped (v1.3); governance limited to TealFlow pipelines, external orchestration frameworks require custom adapters |
| ASI-05 | Inadequate Sandboxing | TealEngine, TealCircuit | Preventing cascading failure, evaluating policies | Strong | No infrastructure-level execution environment isolation. Policy enforcement cannot substitute for true sandboxing |
| ASI-06 | Memory Poisoning | TealMemory | Write governance, read scope enforcement, memory classification  | Strong | No protection against direct vector store or external memory backend compromise, coverage limited to SDK-level memory operations |
| ASI-07 | Cascading Hallucination | TealCircuit, TealReliability | Circuit breakers, retry budgets, fallback chains | Partial | No factual accuracy or hallucination detection in model outputs |
| ASI-08 | Uncontrolled Autonomy | TealEngine, TealDrift | ENFORCE/MONITOR modes, behavioral drift detection, statistical baseline comparison | Partial | No built-in human notification mechanism for approval-required decisions. Requires external integrations |
| ASI-09 | Insufficient Logging & Monitoring | TealAudit, TealProof | Versioned governance logs, cryptographic proof chains   | Partial | Logging tracks agent identity but not the human user behind the request  |
| ASI-10 | Trust Boundary Violations | TealEngine, TealRegistry | Evaluating governance policies, allowlisting  | Strong | No response content validation against defined trust guidelines |