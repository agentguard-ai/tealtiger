---
title: "Role-Based Governance"
description: "Define per-agent governance policies based on roles — each agent operates with minimum privilege for its function."
---

# Role-Based Governance

In multi-agent systems, not every agent should have the same permissions. A researcher needs web access but shouldn't write files. A writer needs file access but shouldn't make API calls. Role-based governance enforces least privilege per agent.

---

## The Problem

Without role-based governance, you have two options:

1. **One policy for all agents** — too permissive for some, too restrictive for others
2. **Per-agent policies** — doesn't scale when you have dozens of agents

Roles solve this by grouping agents with similar responsibilities under shared policies. Define the policy once per role, assign roles to agents.

---

## Role Definitions

TealTiger supports arbitrary role names. Common roles in multi-agent systems:

| Role | Typical Responsibilities | Typical Permissions |
|------|-------------------------|-------------------|
| `researcher` | Search, read, gather information | Web search, file read, API read |
| `writer` | Generate content, write files | File write, edit, create |
| `reviewer` | Review work, add feedback | File read, comment, approve |
| `coder` | Write and execute code | File write, execute, package install |
| `operator` | Deploy, configure, manage | All tools (elevated) |

---

## Configuration

### TypeScript

```typescript
import { perRole } from "tealtiger/policy";

const policy = perRole({
  researcher: {
    allowed_tools: ["web_search", "arxiv_search", "read_file", "google_scholar"],
    max_cost_per_session: 2.0,
    blocked_pii: ["ssn", "credit_card"],
    guardrails: { pre: { injection: true }, post: { pii: true } }
  },
  writer: {
    allowed_tools: ["write_file", "edit_file", "create_file"],
    max_cost_per_session: 0.5,
    blocked_pii: ["ssn", "credit_card", "phone"],
    guardrails: { pre: { pii: true }, post: { pii: true } }
  },
  reviewer: {
    allowed_tools: ["read_file", "add_comment", "approve"],
    max_cost_per_session: 0.2,
    blocked_pii: ["ssn", "credit_card", "email", "phone"],
    guardrails: { pre: { pii: true } }
  },
  coder: {
    allowed_tools: ["write_file", "execute_code", "npm_install", "read_file"],
    max_cost_per_session: 5.0,
    blocked_pii: ["ssn", "credit_card"],
    guardrails: { pre: { injection: true, secrets: true }, post: { secrets: true } }
  },
  operator: {
    allowed_tools: ["*"],  // All tools allowed
    max_cost_per_session: 10.0,
    blocked_pii: ["ssn"],
    guardrails: { pre: { secrets: true }, post: { secrets: true } }
  }
}, {
  default_deny: true  // Block agents with no matching role
});
```

### Python

```python
from tealtiger.policy import per_role

policy = per_role({
    "researcher": {
        "allowed_tools": ["web_search", "arxiv_search", "read_file"],
        "max_cost_per_session": 2.0,
        "blocked_pii": ["ssn", "credit_card"],
        "guardrails": {"pre": {"injection": True}, "post": {"pii": True}}
    },
    "writer": {
        "allowed_tools": ["write_file", "edit_file", "create_file"],
        "max_cost_per_session": 0.5,
        "blocked_pii": ["ssn", "credit_card", "phone"],
        "guardrails": {"pre": {"pii": True}, "post": {"pii": True}}
    },
    "reviewer": {
        "allowed_tools": ["read_file", "add_comment", "approve"],
        "max_cost_per_session": 0.2,
        "blocked_pii": ["ssn", "credit_card", "email", "phone"],
        "guardrails": {"pre": {"pii": True}}
    }
}, default_deny=True)
```

---

## Assigning Roles to Agents

### Via observe()

```typescript
import { observe } from "tealtiger";
import OpenAI from "openai";

const researcher = observe(new OpenAI(), { 
  agentId: "agent-research-01",
  role: "researcher"
});

const writer = observe(new OpenAI(), {
  agentId: "agent-writer-01", 
  role: "writer"
});
```

```python
from tealtiger import observe
from openai import OpenAI

researcher = observe(OpenAI(), agent_id="agent-research-01", role="researcher")
writer = observe(OpenAI(), agent_id="agent-writer-01", role="writer")
```

### Via Explicit Policy Binding

```typescript
import { TealEngine } from "tealtiger";

const engine = new TealEngine({
  policy: perRole({ /* ... */ }),
  agents: {
    "agent-research-01": { role: "researcher" },
    "agent-writer-01": { role: "writer" }
  }
});
```

---

## Tool Allowlists

When a tool call is evaluated, the governance engine checks the caller's role `allowed_tools` list:

```typescript
// Researcher tries to call "write_file"
// → DENY with reason code ROLE_TOOL_NOT_ALLOWED

// Researcher calls "web_search"
// → ALLOW (in their allowed_tools list)
```

### Pattern Matching

Tool allowlists support glob patterns:

```typescript
const policy = perRole({
  coder: {
    allowed_tools: [
      "read_*",          // All read operations
      "write_file",      // Specific write
      "execute_code",    // Specific execute
      "npm_*"            // All npm operations
    ]
  }
});
```

### Wildcard

The `"*"` pattern allows all tools:

```typescript
const policy = perRole({
  operator: {
    allowed_tools: ["*"]  // Full access
  }
});
```

---

## Budget Limits Per Role

Each role can have its own cost ceiling:

```typescript
const policy = perRole({
  researcher: { max_cost_per_session: 2.0 },  // $2 per session
  writer: { max_cost_per_session: 0.5 },       // $0.50 per session
  reviewer: { max_cost_per_session: 0.2 }      // $0.20 per session
});
```

When an agent exceeds its role's budget, subsequent requests are denied with reason code `ROLE_BUDGET_EXCEEDED`.

---

## PII Category Blocking Per Role

Different roles may handle different PII categories:

```typescript
const policy = perRole({
  researcher: {
    // Researchers can see emails (for citations) but not financial data
    blocked_pii: ["ssn", "credit_card"]
  },
  writer: {
    // Writers shouldn't handle any PII
    blocked_pii: ["ssn", "credit_card", "phone", "email"]
  },
  operator: {
    // Operators only blocked from the most sensitive data
    blocked_pii: ["ssn"]
  }
});
```

---

## Default Deny for Unrecognized Roles

When `default_deny: true` is set, agents with no matching role are blocked:

```typescript
const policy = perRole({
  researcher: { /* ... */ },
  writer: { /* ... */ }
}, {
  default_deny: true
});

// An agent with role "hacker" or no role → DENY all requests
// Reason code: ROLE_UNKNOWN
```

When `default_deny: false` (the default), unrecognized roles fall back to the global policy.

---

## Multi-Agent System Example

A complete multi-agent research pipeline with role-based governance:

```typescript
import { observe, freeze } from "tealtiger";
import { perRole } from "tealtiger/policy";
import OpenAI from "openai";

// Define role-based policies
const policy = perRole({
  researcher: {
    allowed_tools: ["web_search", "arxiv_search", "read_file"],
    max_cost_per_session: 3.0,
    blocked_pii: ["ssn", "credit_card"],
    guardrails: { post: { pii: true } }
  },
  synthesizer: {
    allowed_tools: ["read_file", "write_file"],
    max_cost_per_session: 1.0,
    blocked_pii: ["ssn", "credit_card", "phone"],
    guardrails: { pre: { pii: true }, post: { pii: true } }
  },
  reviewer: {
    allowed_tools: ["read_file", "add_comment"],
    max_cost_per_session: 0.5,
    blocked_pii: ["ssn", "credit_card", "email", "phone"],
    guardrails: { pre: { pii: true } }
  }
}, { default_deny: true });

// Create governed agents
const researcher = observe(new OpenAI(), {
  agentId: "research-agent",
  role: "researcher"
});

const synthesizer = observe(new OpenAI(), {
  agentId: "synth-agent",
  role: "synthesizer"
});

const reviewer = observe(new OpenAI(), {
  agentId: "review-agent",
  role: "reviewer"
});

// Each agent can only use tools allowed by their role
// Budget enforcement is automatic per role
// PII detection varies by role sensitivity
```

---

## Audit Integration

When role-based policies are active, every audit event includes the agent's role:

```json
{
  "eventType": "governance_decision",
  "agentId": "agent-research-01",
  "role": "researcher",
  "action": "DENY",
  "reason_codes": ["ROLE_TOOL_NOT_ALLOWED"],
  "tool_attempted": "write_file",
  "allowed_tools": ["web_search", "arxiv_search", "read_file"]
}
```

This provides full visibility into which role boundary was hit and why.

---

## Dashboard Integration

The [Agent Matrix](/dashboard/agents) panel groups agents by role and shows:

- Denial rates per role (which roles are hitting limits most?)
- Cost per role (which roles are most expensive?)
- Tool usage patterns per role
- Frozen agents by role

This enables fleet-level role policy tuning from the dashboard.
